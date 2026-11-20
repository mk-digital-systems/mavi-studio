import type { FxSettings } from "@siir/contracts";
import { claim, release } from "../../shared/exclusive";
import type { TakeReader } from "../../storage/takeReader";
import type { Analysis } from "./analysis";
import { buildChain, estimateMatchDb, FxChain } from "./chain";
import { dbToLin, linToDb } from "./dsp";
import { tailSeconds } from "./settings";

// Test edilebilirlik için AudioContext'in kullandığımız asgari yüzeyi.
export interface GainLike { gain: { value: number; setTargetAtTime(v: number, t: number, tc: number): void; cancelScheduledValues(t: number): void; setValueAtTime(v: number, t: number): void; linearRampToValueAtTime(v: number, t: number): void }; connect(n: unknown): void; disconnect(): void }
export interface SourceLike { buffer: unknown; connect(n: unknown): void; disconnect(): void; start(when: number): void; stop(when?: number): void; onended: (() => void) | null }
export interface CtxLike {
  currentTime: number; sampleRate: number; destination: unknown; state: string;
  createGain(): GainLike; createBufferSource(): SourceLike;
  createBuffer(ch: number, len: number, sr: number): { getChannelData(c: number): Float32Array; duration: number };
  resume(): Promise<void>; suspend(): Promise<void>; close(): Promise<void>;
}

const SEG_SEC = 1;          // her parça 1 sn
const LOOKAHEAD_SEC = 2.5;  // önceden hazırlanan süre
const PREROLL_SEC = 1.5;    // ayar değişince filtre/reverb belleğini ısıtmak için
const START_DELAY = 0.12;   // yeniden başlatmada işlem payı
const FADE = 0.04;
const HOP = 0.05;           // seviye ölçüm adımı

type Meter = { t0: number; inPk: Float32Array; outPk: Float32Array };
type Gen = {
  dead: boolean; finished: boolean; pumping: boolean;
  chain: FxChain | null; anchorCtx: number; anchorPos: number; outScheduled: number; // çıkış örneği sayısı
  nextIn: number; skip: number; tailLeft: number; flushed: boolean;
  fadeProc: GainLike; fadeOrig: GainLike; sources: SourceLike[]; meters: Meter[];
};

export type Levels = { inDb: number; outDb: number; maxOutDb: number };

/**
 * Kayıt yeniden oluşturulmadan efektli/efektsiz önizleme.
 * - Kaynak diskten 1 sn'lik parçalarla okunur, her an bellekte ≈ 3–4 sn tutulur.
 * - Ayar değişince yeni bir "nesil" kısa çapraz geçişle devreye girer.
 * - Önce/Sonra: iki yol aynı anda hazırdır; geçiş anlıktır ve seviye eşleştirilir.
 */
export class FxPlayer {
  private ctx: CtxLike;
  private master: GainLike; private busProc: GainLike; private busOrig: GainLike;
  private gens: Gen[] = [];
  private settings: FxSettings;
  private mode: "processed" | "original" = "processed";
  private matchLin = 1;
  private timer = 0; private debounce = 0;
  private playing = false; private disposed = false;
  private pausedPos = 0;
  private maxOut = 0;
  onEnded: () => void = () => {};
  onError: (m: string) => void = () => {};

  constructor(
    private reader: TakeReader, private analysis: Analysis, settings: FxSettings,
    public readonly id: string, ctxFactory: () => CtxLike = () => new AudioContext({ sampleRate: reader.sampleRate }) as unknown as CtxLike,
  ) {
    this.ctx = ctxFactory();
    this.settings = settings;
    this.master = this.ctx.createGain(); this.busProc = this.ctx.createGain(); this.busOrig = this.ctx.createGain();
    this.busProc.connect(this.master); this.busOrig.connect(this.master); this.master.connect(this.ctx.destination);
    this.applyMode(true);
    this.refreshMatch();
  }

  get isPlaying() { return this.playing; }
  get duration() { return this.reader.totalSamples / this.reader.sampleRate; }
  get currentMode() { return this.mode; }

  // ---------- konum ----------
  position(): number {
    if (!this.playing) return this.pausedPos;
    const t = this.ctx.currentTime;
    for (let i = this.gens.length - 1; i >= 0; i--) {
      const g = this.gens[i];
      if (!g.dead && g.anchorCtx <= t) return Math.min(this.duration, g.anchorPos + (t - g.anchorCtx));
    }
    // henüz hiçbir nesil başlamadı (başlangıç gecikmesi): hedef konumu göster, eski konumu değil
    const last = this.gens[this.gens.length - 1];
    return last && !last.dead ? last.anchorPos : this.pausedPos;
  }

  // ---------- kontrol ----------
  async play(fromSec?: number) {
    if (this.disposed) return;
    claim(this.id, () => this.pause());
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const pos = Math.min(Math.max(0, fromSec ?? (this.pausedPos >= this.duration - 0.05 ? 0 : this.pausedPos)), this.duration);
    this.playing = true;
    this.startGeneration(pos, true);
    if (!this.timer) this.timer = window.setInterval(() => this.tick(), 120);
  }
  pause() {
    if (!this.playing) return;
    this.pausedPos = this.position();
    this.killAll();
    this.playing = false;
    release(this.id);
  }
  seek(sec: number) {
    if (this.playing) this.startGeneration(Math.min(Math.max(0, sec), this.duration), false);
    else this.pausedPos = Math.min(Math.max(0, sec), this.duration);
  }
  setMode(m: "processed" | "original") { this.mode = m; this.applyMode(false); }

  /** Ayar değişti: kısa gecikmeyle (kaydırıcı sürüklenirken yığılmasın) yeni nesil. */
  setSettings(s: FxSettings) {
    this.settings = s;
    clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => {
      this.refreshMatch();
      if (this.playing) this.startGeneration(this.position(), false);
    }, 60);
  }

  levels(): Levels {
    const t = this.ctx.currentTime;
    let inPk = 0, outPk = 0;
    for (const g of this.gens) {
      for (const m of g.meters) {
        const i = Math.floor((t - m.t0) / HOP);
        if (i >= 0 && i < m.inPk.length) { inPk = m.inPk[i]; outPk = m.outPk[i]; }
      }
    }
    return { inDb: linToDb(inPk), outDb: linToDb(outPk), maxOutDb: linToDb(this.maxOut) };
  }
  resetMax() { this.maxOut = 0; }

  /** AudioContext'i kapatır, düğümleri ayırır, zamanlayıcıları temizler. Tekrar çağrılabilir. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.timer); clearTimeout(this.debounce); this.timer = 0;
    this.killAll();
    this.playing = false;
    release(this.id);
    try { this.master.disconnect(); this.busProc.disconnect(); this.busOrig.disconnect(); } catch { /* yoksay */ }
    void this.ctx.close().catch(() => {});
  }

  // ---------- iç işleyiş ----------
  private applyMode(initial: boolean) {
    const t = this.ctx.currentTime;
    const set = (g: GainLike, v: number) => (initial ? void (g.gain.value = v) : g.gain.setTargetAtTime(v, t, 0.008));
    set(this.busProc, this.mode === "processed" ? 1 : 0);
    set(this.busOrig, this.mode === "original" ? this.matchLin : 0);
  }
  private async refreshMatch() {
    try {
      const fs = this.reader.sampleRate, a = this.analysis;
      const start = a.loudestWindowSec * fs, n = Math.min(this.reader.totalSamples - start, 6 * fs);
      const ex = await this.reader.read(start, Math.max(0, n));
      if (this.disposed) return;
      const db = estimateMatchDb(this.settings, ex, fs, a);
      // orijinalin tepesi 0 dBFS'i aşmasın
      const pk = dbToLin(a.peakDb), lin = Math.min(dbToLin(-db), 0.95 / Math.max(pk, 1e-6) , 4);
      this.matchLin = a.flags.silent ? 1 : Math.max(0.25, lin);
      this.applyMode(false);
    } catch { /* eşleştirme başarısızsa 1 kalır */ }
  }

  private startGeneration(pos: number, immediate: boolean) {
    const now = this.ctx.currentTime;
    const t0 = now + (immediate ? 0.03 : START_DELAY);
    // eskileri çapraz geçişle sustur
    for (const g of this.gens) if (!g.dead) this.fadeOut(g, t0);
    const fadeProc = this.ctx.createGain(), fadeOrig = this.ctx.createGain();
    fadeProc.connect(this.busProc); fadeOrig.connect(this.busOrig);
    for (const f of [fadeProc, fadeOrig]) { f.gain.setValueAtTime(0, now); f.gain.setValueAtTime(0, t0); f.gain.linearRampToValueAtTime(1, t0 + FADE); }
    const fs = this.reader.sampleRate;
    const enabled = this.settings.enabled;
    const chain = enabled ? buildChain(this.settings, fs, this.analysis) : null;
    const pre = Math.min(Math.round(PREROLL_SEC * fs), Math.round(pos * fs));
    const gen: Gen = {
      dead: false, finished: false, pumping: false, chain,
      anchorCtx: t0, anchorPos: pos, outScheduled: 0,
      nextIn: Math.round(pos * fs) - pre, skip: pre + (chain?.latency ?? 0), tailLeft: Math.round(tailSeconds(this.settings, this.analysis) * fs), flushed: false,
      fadeProc, fadeOrig, sources: [], meters: [],
    };
    this.gens.push(gen);
    void this.pump(gen);
  }
  private fadeOut(g: Gen, at: number) {
    for (const f of [g.fadeProc, g.fadeOrig]) { f.gain.cancelScheduledValues(at); f.gain.setValueAtTime(1, at); f.gain.linearRampToValueAtTime(0, at + FADE); }
    g.finished = true;
    window.setTimeout(() => this.kill(g), Math.max(0, (at + FADE - this.ctx.currentTime) * 1000) + 120);
  }
  private kill(g: Gen) {
    if (g.dead) return;
    g.dead = true;
    for (const s of g.sources) { s.onended = null; try { s.stop(); } catch { /* başlamamış olabilir */ } try { s.disconnect(); } catch { /* */ } }
    g.sources = []; g.meters = [];
    try { g.fadeProc.disconnect(); g.fadeOrig.disconnect(); } catch { /* */ }
    this.gens = this.gens.filter((x) => x !== g);
  }
  private killAll() { for (const g of [...this.gens]) this.kill(g); }

  private tick() {
    if (this.disposed) return;
    const live = this.gens.filter((g) => !g.dead && !g.finished);
    for (const g of live) void this.pump(g);
    // bitiş denetimi
    const g = this.gens[this.gens.length - 1];
    if (this.playing && g && !g.dead && g.flushed && this.ctx.currentTime >= g.anchorCtx + g.outScheduled / this.reader.sampleRate) {
      this.pausedPos = this.duration; this.killAll(); this.playing = false; release(this.id); this.onEnded();
    }
  }

  private async pump(g: Gen) {
    if (g.pumping || g.dead) return;
    g.pumping = true;
    const fs = this.reader.sampleRate;
    try {
      while (!g.dead && !g.flushed) {
        const ahead = g.anchorCtx + g.outScheduled / fs - this.ctx.currentTime;
        if (ahead > LOOKAHEAD_SEC) break;
        await this.renderNext(g, fs);
      }
    } catch (e) {
      this.onError(e instanceof Error ? e.message : "Ses okunamadı.");
      this.pause();
    } finally { g.pumping = false; }
  }

  private async renderNext(g: Gen, fs: number) {
    const N = Math.round(SEG_SEC * fs), total = this.reader.totalSamples;
    // 1) girdi: gerçek ses; bitince sessizlik (yankı kuyruğu), sonra limiter gecikmesinin boşaltılması
    let inp: Float32Array;
    if (g.nextIn < total) {
      const got = await this.reader.read(Math.max(0, g.nextIn), Math.min(N, total - g.nextIn));
      if (g.dead) return;
      inp = new Float32Array(N); inp.set(got);
      g.tailLeft = Math.max(0, g.tailLeft - (N - got.length)); // dolgu sessizliği kuyruktan sayılır
    } else if (g.tailLeft > 0) {
      const k = Math.min(N, g.tailLeft); inp = new Float32Array(k); g.tailLeft -= k;
    } else if (g.chain && g.chain.latency > 0 && !g.flushed) {
      inp = new Float32Array(g.chain.latency); g.flushed = true;
    } else { g.flushed = true; return; }
    g.nextIn += inp.length;

    // 2) işle (kaynak diziye dokunulmaz); ısınma ve gecikme çıktısını at
    let l: Float32Array, r: Float32Array;
    if (g.chain) { const o = g.chain.process(inp); l = o.l; r = o.r; } else { l = inp; r = inp; }
    let from = 0;
    if (g.skip > 0) { from = Math.min(g.skip, l.length); g.skip -= from; }
    const len = l.length - from;
    if (len <= 0) return;
    const L = l.subarray(from), R = r.subarray(from);
    // orijinal yol: çıkışla aynı zaman ekseni, diskten (sonrası sessizlik)
    const pos0 = Math.round(g.anchorPos * fs) + g.outScheduled;
    const orig = new Float32Array(len);
    if (pos0 < total) { const o = await this.reader.read(pos0, len); if (g.dead) return; orig.set(o.subarray(0, len)); }

    // 3) zamanla ve çal
    const buf = this.ctx.createBuffer(2, len, fs);
    buf.getChannelData(0).set(L); buf.getChannelData(1).set(R);
    const bo = this.ctx.createBuffer(2, len, fs);
    bo.getChannelData(0).set(orig); bo.getChannelData(1).set(orig);

    let when = g.anchorCtx + g.outScheduled / fs;
    const now = this.ctx.currentTime;
    if (when < now + 0.01) { g.anchorCtx += now + 0.02 - when; when = now + 0.02; } // yetişemedi: kaymayı kabul et
    const sp = this.ctx.createBufferSource(), so = this.ctx.createBufferSource();
    sp.buffer = buf; so.buffer = bo; sp.connect(g.fadeProc); so.connect(g.fadeOrig);
    sp.start(when); so.start(when);
    sp.onended = () => { try { sp.disconnect(); so.disconnect(); } catch { /* */ } g.sources = g.sources.filter((s) => s !== sp && s !== so); };
    g.sources.push(sp, so);
    g.outScheduled += len;

    // 4) seviye ölçümü (50 ms adımlarla)
    const hops = Math.ceil(len / (HOP * fs)), inPk = new Float32Array(hops), outPk = new Float32Array(hops);
    const h = Math.round(HOP * fs);
    for (let k = 0; k < hops; k++) {
      let a = 0, b = 0;
      for (let i = k * h; i < Math.min(len, (k + 1) * h); i++) {
        a = Math.max(a, Math.abs(orig[i])); b = Math.max(b, Math.abs(L[i]), Math.abs(R[i]));
      }
      inPk[k] = a; outPk[k] = b; if (b > this.maxOut) this.maxOut = b;
    }
    g.meters.push({ t0: when, inPk, outPk });
    if (g.meters.length > 8) g.meters.shift();
  }
}
