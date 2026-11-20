import { linToDb } from "./dsp";

export type Analysis = {
  sampleRate: number; durationSec: number;
  peakDb: number; rmsDb: number;
  /** 50 ms çerçeve RMS'lerinin %90'ı: konuşma düzeyi. %10'u: gürültü tabanı. */
  speechDb: number; noiseFloorDb: number;
  clippedSamples: number;
  /** 50 ms çerçevelerin doğrusal RMS değerleri (konuşma bölümü tespiti ve altyazı zamanlaması için). */
  frameRms: Float32Array; frameMs: number;
  /** En gürültülü 8 sn'lik pencere (seviye eşleştirme örneği). */
  loudestWindowSec: number;
  flags: { silent: boolean; tooQuiet: boolean; clipping: boolean };
};

/** Akışlı çözümleme: bloklar sırayla verilir, bellekte yalnızca çerçeve RMS'leri tutulur. */
export class Analyzer {
  private frame: number; private acc = 0; private cnt = 0;
  private frames: number[] = []; private peak = 0; private sumSq = 0; private n = 0; private clipped = 0;
  constructor(private fs: number, frameMs = 50) { this.frame = Math.round((frameMs * fs) / 1000); }
  push(x: Float32Array) {
    for (let i = 0; i < x.length; i++) {
      const v = x[i], a = Math.abs(v);
      if (a > this.peak) this.peak = a;
      if (a >= 0.9995) this.clipped++;
      this.sumSq += v * v; this.n++;
      this.acc += v * v;
      if (++this.cnt === this.frame) { this.frames.push(Math.sqrt(this.acc / this.cnt)); this.acc = 0; this.cnt = 0; }
    }
  }
  result(): Analysis {
    if (this.cnt > this.frame / 2) this.frames.push(Math.sqrt(this.acc / this.cnt));
    const db = this.frames.map((r) => linToDb(r));
    const sorted = [...db].sort((a, b) => a - b);
    const pct = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : -120);
    const peakDb = linToDb(this.peak), speechDb = pct(0.9), floor = pct(0.1);
    // en yüksek 8 sn'lik pencere (160 çerçeve)
    const W = Math.min(160, this.frames.length);
    let best = 0, bestSum = -1, run = 0;
    for (let i = 0; i < this.frames.length; i++) {
      run += this.frames[i] ** 2;
      if (i >= W) run -= this.frames[i - W] ** 2;
      if (i >= W - 1 && run > bestSum) { bestSum = run; best = i - W + 1; }
    }
    const silent = this.n === 0 || peakDb < -55 || speechDb < -58;
    return {
      sampleRate: this.fs, durationSec: this.n / this.fs, peakDb,
      rmsDb: this.n ? linToDb(Math.sqrt(this.sumSq / this.n)) : -120,
      speechDb, noiseFloorDb: floor, clippedSamples: this.clipped, frameRms: Float32Array.from(this.frames), frameMs: (this.frame / this.fs) * 1000,
      loudestWindowSec: (best * this.frame) / this.fs,
      flags: { silent, tooQuiet: !silent && speechDb < -36, clipping: this.clipped >= 3 },
    };
  }
}
