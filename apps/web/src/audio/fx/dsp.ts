// Saf (DOM'suz) DSP modülleri. Float32Array üzerinde yerinde çalışır; Node'da test edilebilir.
// Her modülün durumu vardır (filtre belleği vb.), bu yüzden bloklar sırayla verilmelidir.

export const dbToLin = (db: number) => Math.pow(10, db / 20);
export const linToDb = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));
const coef = (ms: number, fs: number) => Math.exp(-1 / Math.max(1, (ms * fs) / 1000));
const fin = (v: number) => (Number.isFinite(v) ? v : 0);

// ---------- Biquad (RBJ Audio EQ Cookbook) ----------
export type BqType = "highpass" | "lowpass" | "peak" | "lowshelf" | "highshelf";
export type Coeffs = { b0: number; b1: number; b2: number; a1: number; a2: number };

export function biquadCoeffs(type: BqType, fs: number, f0: number, q: number, gainDb = 0): Coeffs {
  const f = Math.min(Math.max(f0, 10), fs * 0.45);
  const w0 = (2 * Math.PI * f) / fs, cos = Math.cos(w0), sin = Math.sin(w0);
  const A = Math.pow(10, gainDb / 40), alpha = sin / (2 * q);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  switch (type) {
    case "highpass": b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    case "lowpass": b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    case "peak": b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A; break;
    case "lowshelf": {
      const s = 2 * Math.sqrt(A) * (sin / 2) * Math.SQRT2;
      b0 = A * (A + 1 - (A - 1) * cos + s); b1 = 2 * A * (A - 1 - (A + 1) * cos); b2 = A * (A + 1 - (A - 1) * cos - s);
      a0 = A + 1 + (A - 1) * cos + s; a1 = -2 * (A - 1 + (A + 1) * cos); a2 = A + 1 + (A - 1) * cos - s; break;
    }
    case "highshelf": {
      const s = 2 * Math.sqrt(A) * (sin / 2) * Math.SQRT2;
      b0 = A * (A + 1 + (A - 1) * cos + s); b1 = -2 * A * (A - 1 + (A + 1) * cos); b2 = A * (A + 1 + (A - 1) * cos - s);
      a0 = A + 1 - (A - 1) * cos + s; a1 = 2 * (A - 1 - (A + 1) * cos); a2 = A + 1 - (A - 1) * cos - s; break;
    }
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

export class Biquad {
  private z1 = 0; private z2 = 0;
  constructor(private c: Coeffs) {}
  step(v: number) {
    const c = this.c, y = c.b0 * v + this.z1;
    this.z1 = c.b1 * v - c.a1 * y + this.z2;
    this.z2 = c.b2 * v - c.a2 * y;
    return y;
  }
  process(x: Float32Array) { for (let i = 0; i < x.length; i++) x[i] = this.step(x[i]); }
}

// ---------- 1) Giriş / çıkış kazancı ----------
export function applyGain(x: Float32Array, db: number) {
  if (Math.abs(db) < 0.001) return;
  const g = dbToLin(db);
  for (let i = 0; i < x.length; i++) x[i] *= g;
}

// ---------- 2) DC ve çok düşük frekans temizliği ----------
export class DcBlocker {
  private x1 = 0; private y1 = 0; private R: number;
  constructor(fs: number, hz = 8) { this.R = 1 - (2 * Math.PI * hz) / fs; }
  process(x: Float32Array) {
    for (let i = 0; i < x.length; i++) {
      const v = x[i], y = v - this.x1 + this.R * this.y1;
      this.x1 = v; this.y1 = y; x[i] = y;
    }
  }
}

// ---------- 3) High-pass (2 kademe = 24 dB/oktav) ----------
export class HighPass {
  private a: Biquad; private b: Biquad;
  constructor(fs: number, hz: number) {
    this.a = new Biquad(biquadCoeffs("highpass", fs, hz, 0.5412));
    this.b = new Biquad(biquadCoeffs("highpass", fs, hz, 1.3066)); // Butterworth 4. derece
  }
  process(x: Float32Array) { this.a.process(x); this.b.process(x); }
}

// ---------- 4) Hafif gürültü kapısı (aşağı yönlü expander) ----------
export type ExpanderParams = { thrDb: number; ratio: number; rangeDb: number };
export class Expander {
  private env = 0; private g = 1;
  private aA: number; private aR: number; private gO: number; private gC: number;
  constructor(fs: number, private p: ExpanderParams) {
    this.aA = coef(2, fs); this.aR = coef(120, fs); this.gO = coef(8, fs); this.gC = coef(160, fs);
  }
  process(x: Float32Array) {
    const { thrDb, ratio, rangeDb } = this.p;
    if (rangeDb <= 0.05) return; // etkisiz
    for (let i = 0; i < x.length; i++) {
      const a = Math.abs(x[i]);
      const c = a > this.env ? this.aA : this.aR;
      this.env = c * this.env + (1 - c) * a;
      const lvl = linToDb(this.env);
      const tgtDb = lvl < thrDb ? -Math.min(rangeDb, (thrDb - lvl) * (ratio - 1)) : 0;
      const tg = dbToLin(tgtDb);
      const k = tg < this.g ? this.gC : this.gO;
      this.g = k * this.g + (1 - k) * tg;
      x[i] *= this.g;
    }
  }
}

// ---------- 6) Kompresör (yumuşak diz, ileri beslemeli) ----------
export type CompParams = { thrDb: number; ratio: number; kneeDb: number; attMs: number; relMs: number; makeupDb: number };
export class Compressor {
  private env = 0; private gr = 0;
  private dA: number; private dR: number; private gA: number; private gR: number;
  constructor(fs: number, private p: CompParams) {
    this.dA = coef(2, fs); this.dR = coef(60, fs); this.gA = coef(p.attMs, fs); this.gR = coef(p.relMs, fs);
  }
  process(x: Float32Array) {
    const { thrDb, ratio, kneeDb, makeupDb } = this.p, W = Math.max(0.01, kneeDb), s = 1 / ratio - 1;
    for (let i = 0; i < x.length; i++) {
      const v = x[i], a = Math.abs(v);
      const c = a > this.env ? this.dA : this.dR;
      this.env = c * this.env + (1 - c) * a;
      const over = linToDb(this.env) - thrDb;
      let g = 0;
      if (2 * over > W) g = s * over;
      else if (2 * over > -W) g = (s * (over + W / 2) * (over + W / 2)) / (2 * W);
      const k = g < this.gr ? this.gA : this.gR;
      this.gr = k * this.gr + (1 - k) * g;
      x[i] = v * dbToLin(this.gr + makeupDb);
    }
  }
}

// ---------- 7) Basit de-esser (bölünmüş bant; etkin değilken tam şeffaf) ----------
export type DeEssParams = { maxRedDb: number; ratioThr: number };
export class DeEsser {
  private h1: Biquad; private h2: Biquad;
  private eb = 0; private ef = 0; private g = 1;
  private eA: number; private eR: number; private gA: number; private gR: number;
  constructor(fs: number, private p: DeEssParams, hz = 5500) {
    this.h1 = new Biquad(biquadCoeffs("highpass", fs, hz, 0.5412));
    this.h2 = new Biquad(biquadCoeffs("highpass", fs, hz, 1.3066));
    this.eA = coef(0.5, fs); this.eR = coef(25, fs); this.gA = coef(0.5, fs); this.gR = coef(20, fs);
  }
  process(x: Float32Array) {
    if (this.p.maxRedDb <= 0.1) return;
    const thrDb = linToDb(this.p.ratioThr);
    for (let i = 0; i < x.length; i++) {
      const v = x[i], b = this.h2.step(this.h1.step(v));
      const ab = Math.abs(b), af = Math.abs(v);
      this.eb = (ab > this.eb ? this.eA : this.eR) * this.eb + (1 - (ab > this.eb ? this.eA : this.eR)) * ab;
      this.ef = (af > this.ef ? this.eA : this.eR) * this.ef + (1 - (af > this.ef ? this.eA : this.eR)) * af;
      let tgDb = 0;
      if (this.ef > 1e-4) { // sessizlikte oran anlamsız → dokunma
        const r = this.eb / this.ef;
        const d = linToDb(r) - thrDb;
        if (d > 0) tgDb = -Math.min(this.p.maxRedDb, d * 1.5);
      }
      const tg = dbToLin(tgDb);
      const k = tg < this.g ? this.gA : this.gR;
      this.g = k * this.g + (1 - k) * tg;
      x[i] = v - b * (1 - this.g);
    }
  }
}

// ---------- 9) Reverb: tamamen uygulama içi matematiksel FDN (impulse response dosyası YOK) ----------
export type ReverbParams = {
  decaySec: number; predelayMs: number; damping: number; size: number;
  erGain: number; slapMs: number; slapGain: number;
};
/** Dürtü yanıtı enerjisi (L+R ortalaması) birime normalleştirilir: wet=1 ⇒ ıslak enerji ≈ kuru enerji. */
const normCache = new Map<string, number>();
const BASE_MS = [29.7, 37.1, 41.1, 43.7, 53.3, 59.9, 67.7, 71.3];
const SIGN_L = [1, -1, 1, -1, 1, -1, 1, -1];
const SIGN_R = [1, 1, -1, -1, 1, 1, -1, -1];
const ER_TAPS: [number, number, number][] = [ // [ms, gain, pan(-1..1)]
  [7, 0.8, -0.7], [11.5, 0.7, 0.8], [17, 0.6, -0.4], [23.5, 0.5, 0.5], [31, 0.4, -0.9], [41, 0.3, 0.9],
];

export class Reverb {
  private lines: Float32Array[]; private idx = new Int32Array(8); private lens: Int32Array;
  private g: Float64Array; private damp = new Float64Array(8); private k: number;
  private pre: Float32Array; private preI = 0;
  private er: Float32Array; private erI = 0; private slapN: number;
  private hp: Biquad; private lp: Biquad; private norm: number;
  constructor(private fs: number, private p: ReverbParams, calibrating = false) {
    this.lens = new Int32Array(8);
    this.g = new Float64Array(8);
    this.lines = BASE_MS.map((ms, i) => {
      const n = Math.max(32, Math.round((ms * p.size * fs) / 1000));
      this.lens[i] = n;
      this.g[i] = Math.pow(10, (-3 * (n / fs)) / Math.max(0.1, p.decaySec));
      return new Float32Array(n);
    });
    this.k = Math.min(0.95, Math.max(0, p.damping));
    this.pre = new Float32Array(Math.max(1, Math.round((p.predelayMs * fs) / 1000)));
    this.slapN = Math.round((p.slapMs * fs) / 1000);
    this.er = new Float32Array(Math.round(0.06 * fs) + this.slapN + 8);
    this.hp = new Biquad(biquadCoeffs("highpass", fs, 240, 0.707));  // çamuru önlemek için düşük kesim
    this.lp = new Biquad(biquadCoeffs("lowpass", fs, 7000, 0.707));
    this.norm = 1;
    if (!calibrating) {
      const key = [fs, p.decaySec, p.predelayMs, p.damping, p.size, p.erGain, p.slapMs, p.slapGain].join("|");
      let v = normCache.get(key);
      if (v === undefined) {
        const n = Math.round(fs * Math.max(0.6, p.decaySec * 1.4 + p.predelayMs / 1000));
        const imp = new Float32Array(n); imp[0] = 1;
        const L = new Float32Array(n), R = new Float32Array(n);
        new Reverb(fs, p, true).process(imp, L, R);
        let e = 0; for (let i = 0; i < n; i++) e += (L[i] * L[i] + R[i] * R[i]) / 2;
        v = 1 / Math.sqrt(Math.max(e, 1e-9)); normCache.set(key, v);
      }
      this.norm = v;
    }
  }
  /** `dry` mono girişi okur; yalnızca ıslak sinyali (ölçeksiz) outL/outR'ye yazar. */
  process(dry: Float32Array, outL: Float32Array, outR: Float32Array) {
    const fs = this.fs, n = dry.length, inj = 0.35;
    const taps = ER_TAPS.map(([ms, g, pan]) => ({ d: Math.round((ms * fs) / 1000), gl: g * (0.5 - pan * 0.5), gr: g * (0.5 + pan * 0.5) }));
    const y = new Float64Array(8), f = new Float64Array(8);
    for (let i = 0; i < n; i++) {
      const x = this.lp.step(this.hp.step(dry[i]));
      // ön gecikme
      const xp = this.pre[this.preI]; this.pre[this.preI] = x; this.preI = (this.preI + 1) % this.pre.length;
      // erken yansımalar
      const L = this.er.length;
      this.er[this.erI] = xp;
      let eL = 0, eR = 0;
      for (const t of taps) { const v = this.er[(this.erI - t.d + L) % L]; eL += v * t.gl; eR += v * t.gr; }
      if (this.slapN > 0) { const v = this.er[(this.erI - this.slapN + L) % L] * this.p.slapGain; eL += v; eR += v * 0.8; }
      this.erI = (this.erI + 1) % L;
      // FDN
      for (let j = 0; j < 8; j++) {
        const v = this.lines[j][this.idx[j]];
        y[j] = v;
        this.damp[j] = (1 - this.k) * v + this.k * this.damp[j];
        if (Math.abs(this.damp[j]) < 1e-20) this.damp[j] = 0;
        f[j] = this.damp[j];
      }
      // 8 noktalı Hadamard (ortogonal, 1/√8)
      for (let h = 1; h < 8; h <<= 1)
        for (let a = 0; a < 8; a += h << 1)
          for (let b = a; b < a + h; b++) { const u = f[b], w = f[b + h]; f[b] = u + w; f[b + h] = u - w; }
      const sc = 1 / Math.sqrt(8);
      let oL = 0, oR = 0;
      for (let j = 0; j < 8; j++) {
        const sgn = j % 2 ? -1 : 1;
        this.lines[j][this.idx[j]] = fin(inj * sgn * xp + this.g[j] * f[j] * sc);
        this.idx[j] = (this.idx[j] + 1) % this.lens[j];
        oL += SIGN_L[j] * y[j]; oR += SIGN_R[j] * y[j];
      }
      outL[i] = (oL * 0.5 + eL * this.p.erGain) * this.norm;
      outR[i] = (oR * 0.5 + eR * this.p.erGain) * this.norm;
    }
  }
}

// ---------- 10) Lookahead limiter: örnek tepe garantisi ----------
/**
 * Garanti: her çıkış örneği |y| ≤ ceiling.
 * g[n] = hedef kazanç; m[k] = min(g[k..k+N]); s[k] = ortalama(m[k-N..k]) ≤ g[k] (her m[k-i] pencere içinde k'yi kapsar).
 * Ek olarak yavaş bırakma (release) yalnızca kazancı azaltabilir (min), bu yüzden garanti bozulmaz.
 * Gecikme: N örnek (`latency`). Gerçek tepe (inter-sample) ölçülmez: tavan −1,5 dBFS ile pay bırakılır.
 */
export class Limiter {
  readonly latency: number;
  private N: number; private ceil: number; private rel: number;
  private bufL: Float32Array; private bufR: Float32Array; private gT: Float32Array; private mR: Float32Array;
  private dq: Int32Array; private head = 0; private tail = 0; // monoton kuyruk (indeksler)
  private n = 0; private sum = 0; private gOut = 1; private size: number;
  /** Uygulanan en küçük kazanç (dB) — test/raporlama için. */
  minGainDb = 0;
  constructor(fs: number, ceilingDb = -1.5, lookMs = 2, releaseMs = 80) {
    this.N = Math.max(1, Math.round((lookMs * fs) / 1000));
    this.latency = this.N;
    this.ceil = dbToLin(ceilingDb);
    this.rel = coef(releaseMs, fs);
    this.size = this.N + 1;
    this.bufL = new Float32Array(this.size); this.bufR = new Float32Array(this.size);
    this.gT = new Float32Array(this.size).fill(1); this.mR = new Float32Array(this.size).fill(1);
    this.dq = new Int32Array(this.size + 2);
    this.sum = this.size; // m ring başlangıçta 1
    // ilk N örnek için kuyruğu 1.0 ile doldurmaya gerek yok: n<0 örnekler yok sayılır
  }
  /** l/r yerinde değiştirilir; çıkış girişten `latency` örnek geridedir. */
  process(l: Float32Array, r: Float32Array) {
    const N = this.N, S = this.size, Q = this.dq.length;
    for (let i = 0; i < l.length; i++) {
      let a = fin(l[i]), b = fin(r[i]);
      const pk = Math.max(Math.abs(a), Math.abs(b));
      const g = pk > this.ceil ? this.ceil / pk : 1;
      const slot = this.n % S;
      this.bufL[slot] = a; this.bufR[slot] = b; this.gT[slot] = g;
      const rs = (this.n + 1) % S; // (n-N) numaralı örneğin yuvası (halka N+1)
      const outL = this.bufL[rs], outR = this.bufR[rs];
      // monoton kuyruk: pencere [n-N, n]
      while (this.tail !== this.head && this.gAt(this.dq[(this.tail - 1 + Q) % Q]) >= g) this.tail = (this.tail - 1 + Q) % Q;
      this.dq[this.tail] = this.n; this.tail = (this.tail + 1) % Q;
      while (this.dq[this.head] < this.n - N) this.head = (this.head + 1) % Q;
      const m = this.gAt(this.dq[this.head]); // = min g[n-N..n] = m[n-N]
      const old = this.mR[slot];
      this.mR[slot] = m; this.sum += m - old;
      const s = this.sum / S; // ortalama(m[n-2N..n-N]) → n-N örneğine uygulanır
      this.gOut = Math.min(s, this.rel * this.gOut + (1 - this.rel));
      if (this.gOut < 1) this.minGainDb = Math.min(this.minGainDb, linToDb(this.gOut));
      const k = this.n >= N ? this.gOut : 0; // ilk N çıkış: henüz gerçek örnek yok
      l[i] = outL * k; r[i] = outR * k;
      this.n++;
    }
  }
  private gAt(idx: number) { return this.gT[idx % this.size]; }
}
