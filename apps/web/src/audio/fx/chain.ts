import type { FxSettings } from "@siir/contracts";
import {
  applyGain, Biquad, biquadCoeffs, Compressor, DcBlocker, DeEsser, Expander, HighPass, Limiter, Reverb, dbToLin, linToDb,
} from "./dsp";
import { LIMITS, resolveParams, type ChainParams } from "./settings";
import type { Analysis } from "./analysis";

export type Stereo = { l: Float32Array; r: Float32Array };

/**
 * Sıra: 1 giriş kazancı → 2 DC → 3 high-pass → 4 gürültü kapısı → 5 EQ → 6 kompresör → 7 de-esser →
 *       8 çıkış kazancı → 9 reverb → 10 limiter.
 * Mono giriş, stereo çıkış. Girdi dizisine DOKUNMAZ (kopya üzerinde çalışır) — orijinal ses asla değişmez.
 * Çıkış girişe göre `latency` örnek gecikmelidir (limiter lookahead).
 */
export class FxChain {
  readonly latency: number;
  readonly limiter: Limiter;
  private dc: DcBlocker; private hp: HighPass; private gate: Expander; private eq: Biquad[]; private comp: Compressor;
  private ds: DeEsser; private rev: Reverb;
  private eqLp: Biquad | null;
  constructor(readonly params: ChainParams, private fs: number) {
    const p = params, e = p.eq;
    this.dc = new DcBlocker(fs);
    this.hp = new HighPass(fs, p.hpfHz);
    this.gate = new Expander(fs, p.expander);
    this.eq = [
      new Biquad(biquadCoeffs("lowshelf", fs, 180, 0.7, e.lowShelfDb)),
      new Biquad(biquadCoeffs("peak", fs, 320, 1.0, e.mudDb)),
      new Biquad(biquadCoeffs("peak", fs, 3200, 0.9, e.presenceDb)),
      new Biquad(biquadCoeffs("highshelf", fs, 9500, 0.7, e.airDb)),
    ];
    this.eqLp = e.lpHz > 0 ? new Biquad(biquadCoeffs("lowpass", fs, e.lpHz, 0.707)) : null;
    this.comp = new Compressor(fs, p.comp);
    this.ds = new DeEsser(fs, p.deess);
    this.rev = new Reverb(fs, p.reverb);
    this.limiter = new Limiter(fs, LIMITS.limiterCeilingDb);
    this.latency = this.limiter.latency;
  }

  process(mono: Float32Array): Stereo {
    const p = this.params, b = p.bypass;
    const x = new Float32Array(mono); // kopya: kaynak korunur
    applyGain(x, p.inputDb);                                     // 1
    this.dc.process(x);                                          // 2 (her zaman açık)
    if (!b.highpass) this.hp.process(x);                         // 3
    if (!b.gate) this.gate.process(x);                           // 4
    if (!b.eq) { for (const f of this.eq) f.process(x); this.eqLp?.process(x); } // 5
    if (!b.compressor) this.comp.process(x);                     // 6
    if (!b.deesser) this.ds.process(x);                          // 7
    applyGain(x, p.outputDb);                                    // 8
    const n = x.length, l = new Float32Array(x), r = new Float32Array(x);
    if (!b.reverb && p.wet > 0.0005) {                           // 9
      const wl = new Float32Array(n), wr = new Float32Array(n);
      this.rev.process(x, wl, wr);
      const w = p.stereoWidth;
      for (let i = 0; i < n; i++) {
        const m = (wl[i] + wr[i]) / 2, s = ((wl[i] - wr[i]) / 2) * w;
        l[i] += (m + s) * p.wet; r[i] += (m - s) * p.wet;
      }
    }
    this.limiter.process(l, r);                                  // 10 (her zaman açık)
    return { l, r };
  }
  /** Limiter gecikmesini boşaltır (girdinin sonunda çağrılır). */
  flush(): Stereo { return this.process(new Float32Array(this.latency)); }
}

export function buildChain(settings: FxSettings, fs: number, analysis?: Analysis) {
  return new FxChain(resolveParams(settings, analysis), fs);
}

/**
 * Tüm girdiyi (kısa) bir seferde işler; gecikme telafili, girdiyle aynı uzunlukta + yankı kuyruğu.
 * Testlerde ve seviye eşleştirmede kullanılır.
 */
export function renderAll(settings: FxSettings, input: Float32Array, fs: number, analysis?: Analysis, tailSec = 0): Stereo {
  const chain = buildChain(settings, fs, analysis);
  const tail = Math.round(tailSec * fs);
  const padded = new Float32Array(input.length + tail); padded.set(input);
  const a = chain.process(padded), f = chain.flush();
  const L = chain.latency, n = padded.length;
  const l = new Float32Array(n), r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i + L;
    l[i] = j < n ? a.l[j] : f.l[j - n]; r[i] = j < n ? a.r[j] : f.r[j - n];
  }
  return { l, r };
}

/** İşlenmiş sesin orijinale göre yaklaşık seviye farkı (dB); önce/sonra karşılaştırmasını adil kılar. */
export function estimateMatchDb(settings: FxSettings, excerpt: Float32Array, fs: number, analysis?: Analysis): number {
  if (!settings.enabled || excerpt.length === 0) return 0;
  const out = renderAll(settings, excerpt, fs, analysis, 0);
  const rms = (x: Float32Array) => { let s = 0; for (const v of x) s += v * v; return Math.sqrt(s / Math.max(1, x.length)); };
  const mid = new Float32Array(excerpt.length);
  for (let i = 0; i < mid.length; i++) mid[i] = (out.l[i] + out.r[i]) / 2;
  const a = rms(excerpt), b = rms(mid);
  if (a < 1e-6 || b < 1e-6) return 0;
  return Math.max(-9, Math.min(9, linToDb(b) - linToDb(a)));
}
export { dbToLin };
