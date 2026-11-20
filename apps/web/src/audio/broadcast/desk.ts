// Yayın ses masası: ayrı kanallar (mikrofon · fon · kayıtlı şiir · efektler) → ana çıkış (limiter) → bilgisayarın ses çıkışı.
// ÖNEMLİ: Bu modül HİÇBİR ŞEYİ KAYDETMEZ. Kayıt mekanizması (MediaRecorder, çalışma iş parçacığıyla örnek toplama vb.) burada kullanılmaz;
// mikrofon yalnızca seviye göstergesi, konuşma önceliği ve (isteğe bağlı) canlı çıkış için dinlenir.
import type { BroadcastSettings, ChannelId } from "../../shared/settings";
import type { SfxItem } from "../../storage/sfx";
import { Ducker, OverloadDetector, sliderToGain } from "./ducking";

export const CHANNELS: { id: ChannelId; label: string; color: string }[] = [
  { id: "mic", label: "Mikrofon", color: "#e5675a" },
  { id: "music", label: "Fon müziği", color: "#5aa7e5" },
  { id: "voice", label: "Kayıtlı şiir", color: "#e0a458" },
  { id: "sfx", label: "Ses efektleri", color: "#8fb59a" },
];

type Ch = { gain: GainNode; an: AnalyserNode; volume: number; muted: boolean; def: number };
type Media = { el: HTMLAudioElement; url: string; node: MediaElementAudioSourceNode; fade: GainNode; id: string };
type SfxVoice = { src: AudioBufferSourceNode; gain: GainNode; startedAt: number };

export type DeskHooks = { onWarning?: (msg: string) => void; onChange?: () => void };

export class Desk {
  /** Bu masa hiçbir koşulda kayıt yapmaz (test ve arayüz bu bayrağa dayanır). */
  static readonly recordsAudio = false;
  readonly ctx: AudioContext;
  private master: GainNode; private limiter: DynamicsCompressorNode; private masterAn: AnalyserNode;
  readonly ch: Record<ChannelId, Ch>;
  private duck: GainNode; ducker: Ducker; private overload = new OverloadDetector();
  private micStream: MediaStream | null = null; private micNode: MediaStreamAudioSourceNode | null = null; private micOut: GainNode;
  private music: Media | null = null; private voice: Media | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private sfxVoices = new Map<string, SfxVoice[]>();
  private timer = 0; private disposed = false; private warned = 0;
  micToOutput = false;
  onVoiceEnded: (() => void) | null = null;

  constructor(private cfg: BroadcastSettings, private hooks: DeskHooks = {}) {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.limiter = this.ctx.createDynamicsCompressor(); // ana çıkış sınırlayıcısı (limiter)
    this.limiter.threshold.value = -2; this.limiter.knee.value = 0; this.limiter.ratio.value = 20; this.limiter.attack.value = 0.003; this.limiter.release.value = 0.12;
    this.masterAn = this.ctx.createAnalyser(); this.masterAn.fftSize = 1024;
    this.master.connect(this.limiter).connect(this.masterAn).connect(this.ctx.destination);
    const mk = (id: ChannelId): Ch => {
      const gain = this.ctx.createGain(), an = this.ctx.createAnalyser(); an.fftSize = 1024;
      const v = cfg.volumes[id]; gain.gain.value = sliderToGain(v);
      return { gain, an, volume: v, muted: false, def: v };
    };
    this.ch = { mic: mk("mic"), music: mk("music"), voice: mk("voice"), sfx: mk("sfx") };
    this.duck = this.ctx.createGain();
    this.ch.music.gain.connect(this.ch.music.an); // fon: ... → duck → kanal kazancı → analiz → ana
    this.duck.connect(this.ch.music.gain);
    for (const id of ["voice", "sfx"] as const) this.ch[id].gain.connect(this.ch[id].an);
    for (const id of ["music", "voice", "sfx"] as const) this.ch[id].an.connect(this.master);
    this.micOut = this.ctx.createGain(); this.micOut.gain.value = 0; this.micOut.connect(this.master);
    this.ch.mic.gain.connect(this.ch.mic.an); this.ch.mic.an.connect(this.micOut);
    this.ducker = new Ducker({ ...cfg.duck, holdMs: 450 });
    this.micToOutput = cfg.micToOutput; this.micOut.gain.value = 0;
    this.timer = window.setInterval(() => this.tick(), 50);
  }

  async resume() { if (this.ctx.state !== "running") await this.ctx.resume(); }

  // ---------- Kanal kontrolleri ----------
  private apply(id: ChannelId) { const c = this.ch[id]; c.gain.gain.setTargetAtTime(c.muted ? 0 : sliderToGain(c.volume), this.ctx.currentTime, 0.015); this.hooks.onChange?.(); }
  setVolume(id: ChannelId, v: number) { this.ch[id].volume = Math.min(1, Math.max(0, v)); this.apply(id); }
  setMuted(id: ChannelId, m: boolean) { this.ch[id].muted = m; this.apply(id); }
  resetChannel(id: ChannelId) { this.ch[id].volume = this.ch[id].def; this.ch[id].muted = false; this.apply(id); }
  setDuck(cfg: Partial<BroadcastSettings["duck"]>) { Object.assign(this.ducker.cfg, cfg); this.hooks.onChange?.(); }
  setMicToOutput(on: boolean) { this.micToOutput = on; this.micOut.gain.setTargetAtTime(on && this.micOn ? 1 : 0, this.ctx.currentTime, 0.02); this.hooks.onChange?.(); }

  /** Seviye (dBFS tepe). */
  levelDb(id: ChannelId | "master"): number {
    const an = id === "master" ? this.masterAn : this.ch[id].an, buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    let p = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > p) p = a; }
    return 20 * Math.log10(Math.max(p, 1e-6));
  }
  get ducking() { return this.duck.gain.value < 0.99; }

  // ---------- Mikrofon (yalnızca dinleme: kayıt YOK) ----------
  get micOn() { return !!this.micStream; }
  async openMic() {
    if (this.micStream) return;
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
    if (this.disposed) { s.getTracks().forEach((t) => t.stop()); return; }
    this.micStream = s; this.micNode = this.ctx.createMediaStreamSource(s); this.micNode.connect(this.ch.mic.gain);
    this.setMicToOutput(this.micToOutput);
  }
  closeMic() {
    this.micNode?.disconnect(); this.micNode = null;
    this.micStream?.getTracks().forEach((t) => t.stop()); this.micStream = null;
    this.micOut.gain.value = 0; this.hooks.onChange?.();
  }

  // ---------- Çalma kanalları (fon ve kayıtlı şiir) ----------
  private makeMedia(blob: Blob, id: string, target: AudioNode): Media {
    const url = URL.createObjectURL(blob), el = new Audio(url);
    el.preload = "auto";
    const node = this.ctx.createMediaElementSource(el), fade = this.ctx.createGain();
    node.connect(fade).connect(target);
    return { el, url, node, fade, id };
  }
  private drop(m: Media | null) {
    if (!m) return;
    m.el.pause(); m.node.disconnect(); m.fade.disconnect(); m.el.removeAttribute("src"); m.el.load(); URL.revokeObjectURL(m.url);
  }
  get musicId() { return this.music?.id ?? null; }
  get musicPlaying() { return !!this.music && !this.music.el.paused; }
  /** Aynı parça zaten çalıyorsa ikinci kez BAŞLATILMAZ (yanlışlıkla çift başlatma engeli). */
  async playMusic(blob: Blob, id: string, opt: { startSec?: number; fadeInSec?: number; loop?: boolean } = {}) {
    await this.resume();
    if (this.music && this.music.id === id && !this.music.el.paused) return;
    this.drop(this.music);
    const m = (this.music = this.makeMedia(blob, id, this.duck));
    m.el.loop = opt.loop ?? true;
    await new Promise<void>((res) => { if (m.el.readyState >= 1) res(); else m.el.addEventListener("loadedmetadata", () => res(), { once: true }); });
    const d = m.el.duration; if (opt.startSec && Number.isFinite(d) && d > 0) m.el.currentTime = opt.startSec % d;
    const fi = opt.fadeInSec ?? 0, t = this.ctx.currentTime;
    m.fade.gain.cancelScheduledValues(t); m.fade.gain.setValueAtTime(fi > 0 ? 0 : 1, t);
    if (fi > 0) m.fade.gain.linearRampToValueAtTime(1, t + fi);
    await m.el.play(); this.hooks.onChange?.();
    if (this.ctx.state !== "running") throw new Error("Tarayıcı sesi başlatmadı. Sayfada bir yere tıklayıp fonu tekrar çal.");
  }
  pauseMusic() { this.music?.el.pause(); this.hooks.onChange?.(); }
  async resumeMusic() { if (this.music && this.music.el.paused) { await this.resume(); await this.music.el.play(); this.hooks.onChange?.(); } }
  /** Yumuşak durdurma. */
  stopMusic(fadeSec = 1.5) {
    const m = this.music; if (!m) return;
    if (fadeSec <= 0) { this.drop(m); this.music = null; this.hooks.onChange?.(); return; }
    const t = this.ctx.currentTime;
    m.fade.gain.cancelScheduledValues(t); m.fade.gain.setValueAtTime(m.fade.gain.value, t); m.fade.gain.linearRampToValueAtTime(0, t + fadeSec);
    window.setTimeout(() => { if (this.music === m) { this.drop(m); this.music = null; this.hooks.onChange?.(); } }, fadeSec * 1000 + 40);
  }

  get voiceLoaded() { return !!this.voice; }
  get voicePlaying() { return !!this.voice && !this.voice.el.paused && !this.voice.el.ended; }
  get voicePosition() { return this.voice?.el.currentTime ?? 0; }
  get voiceDuration() { const d = this.voice?.el.duration; return Number.isFinite(d) ? (d as number) : 0; }
  async loadVoice(blob: Blob, id: string) {
    this.drop(this.voice);
    const m = (this.voice = this.makeMedia(blob, id, this.ch.voice.gain));
    m.el.onended = () => { this.hooks.onChange?.(); this.onVoiceEnded?.(); };
    await new Promise<void>((res, rej) => { if (m.el.readyState >= 1) res(); else { m.el.addEventListener("loadedmetadata", () => res(), { once: true }); m.el.addEventListener("error", () => rej(new Error("Ses yüklenemedi.")), { once: true }); } });
    this.hooks.onChange?.();
  }
  async playVoice() { if (!this.voice || this.voicePlaying) return; await this.resume(); await this.voice.el.play(); this.hooks.onChange?.(); }
  pauseVoice() { this.voice?.el.pause(); this.hooks.onChange?.(); }
  restartVoice() { if (this.voice) { this.voice.el.currentTime = 0; } }
  seekVoice(t: number) { if (this.voice) this.voice.el.currentTime = Math.max(0, Math.min(t, this.voiceDuration || t)); }
  unloadVoice() { this.drop(this.voice); this.voice = null; this.hooks.onChange?.(); }

  // ---------- Ses efektleri ----------
  private async buffer(id: string, load: () => Promise<Blob>) {
    let b = this.buffers.get(id);
    if (!b) { b = await this.ctx.decodeAudioData(await (await load()).arrayBuffer()); this.buffers.set(id, b); }
    return b;
  }
  sfxPlaying(id: string) { return (this.sfxVoices.get(id)?.length ?? 0) > 0; }
  get anySfxPlaying() { return [...this.sfxVoices.values()].some((v) => v.length > 0); }
  /**
   * Dokununca çalar. Zaten çalıyorsa ve tek ses izniyse DURDURUR (aç/kapa). Aynı efekt 120 ms içinde iki kez
   * tetiklenmez (çift dokunma/tuş tekrarı). Üst üste binme `maxVoices` ile sınırlıdır; tüm kanal limiter'dan geçer.
   */
  async playSfx(item: SfxItem, load: () => Promise<Blob>) {
    const now = performance.now(), cur = this.sfxVoices.get(item.id) ?? [];
    if (cur.length && now - cur[cur.length - 1].startedAt < 120) return;
    if (cur.length && item.maxVoices <= 1) { this.stopSfx(item.id); return; }
    if (cur.length >= item.maxVoices) { this.stopSfx(item.id, 1); }
    await this.resume();
    const buf = await this.buffer(item.id, load), src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf; src.loop = item.loop;
    const t = this.ctx.currentTime, v = Math.min(1, item.defaultVolume), fi = Math.min(item.fadeInSec, buf.duration / 2), fo = Math.min(item.fadeOutSec, buf.duration / 2);
    g.gain.setValueAtTime(fi > 0 ? 0 : v, t); if (fi > 0) g.gain.linearRampToValueAtTime(v, t + fi);
    if (!item.loop && fo > 0) { g.gain.setValueAtTime(v, t + Math.max(fi, buf.duration - fo)); g.gain.linearRampToValueAtTime(0, t + buf.duration); }
    src.connect(g).connect(this.ch.sfx.gain);
    const voice: SfxVoice = { src, gain: g, startedAt: now };
    const list = this.sfxVoices.get(item.id) ?? []; list.push(voice); this.sfxVoices.set(item.id, list);
    src.onended = () => { const l = this.sfxVoices.get(item.id) ?? []; this.sfxVoices.set(item.id, l.filter((x) => x !== voice)); try { g.disconnect(); } catch { /* */ } this.hooks.onChange?.(); };
    src.start(); this.hooks.onChange?.();
  }
  stopSfx(id: string, count = Infinity) {
    const list = this.sfxVoices.get(id) ?? [], t = this.ctx.currentTime;
    for (const v of list.splice(0, Math.min(count, list.length))) {
      try { v.gain.gain.cancelScheduledValues(t); v.gain.gain.setTargetAtTime(0, t, 0.01); v.src.stop(t + 0.06); } catch { /* zaten durdu */ }
    }
    this.hooks.onChange?.();
  }

  /** "Tüm Sesleri Durdur": bütün kanallar anında susar. */
  panic() {
    const t = this.ctx.currentTime;
    for (const id of [...this.sfxVoices.keys()]) this.stopSfx(id);
    this.sfxVoices.forEach((v) => v.splice(0));
    this.drop(this.music); this.music = null;
    this.voice?.el.pause(); if (this.voice) this.voice.el.currentTime = 0;
    this.micOut.gain.cancelScheduledValues(t); this.micOut.gain.setValueAtTime(0, t);
    this.micToOutput = false; this.hooks.onChange?.();
  }

  private tick() {
    if (this.disposed) return;
    const now = performance.now();
    const speech = Math.max(this.ch.mic.muted ? -120 : this.levelDb("mic"), this.voicePlaying && !this.ch.voice.muted ? this.levelDb("voice") : -120);
    const target = this.ducker.update(speech, now);
    this.duck.gain.setTargetAtTime(target, this.ctx.currentTime, target < 1 ? 0.08 : 0.4); // hızlı kıs, yavaş geri getir
    if (this.overload.update(this.levelDb("master"), now) && now - this.warned > 4000) {
      this.warned = now; this.hooks.onWarning?.("Ses çok yüksek: ana çıkış sınırda. Kanal seviyelerini düşür.");
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; window.clearInterval(this.timer);
    this.panic(); this.closeMic(); this.drop(this.voice); this.voice = null;
    void this.ctx.close().catch(() => {});
  }
}
