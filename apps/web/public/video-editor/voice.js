/* Mavi Kadraj — anlatım sesi iyileştirme (cihazda, tarayıcıdan bağımsız).
   Sıra: yüksek geçiren (uğultu) → spektral gürültü azaltma → ton dengesi (EQ) → hafif sıkıştırma → hafif yankı → seviye ve sınırlayıcı.
   Gürültü profili kaydın en sessiz kısımlarından çıkarılır; ayrı bir "gürültü örneği" gerekmez. */
(function (root) {
'use strict';
const TAU = Math.PI * 2, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- FFT (radix-2, yerinde) ----
function makeFFT(n) {
  const bits = Math.round(Math.log2(n)), rev = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) rev[i] = (rev[i >> 1] >> 1) | ((i & 1) << (bits - 1));
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(TAU * i / n); sin[i] = -Math.sin(TAU * i / n); }
  return (re, im, inverse) => {
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0, w = 0; k < half; k++, w += step) {
          const wr = cos[w], wi = inverse ? -sin[w] : sin[w], a = start + k, b = a + half;
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  };
}

// ---- RBJ çift ikinci derece süzgeçler ----
function biquad(type, f0, q, gainDb, fs) {
  const A = Math.pow(10, (gainDb || 0) / 40), w = TAU * f0 / fs, cw = Math.cos(w), sw = Math.sin(w), alpha = sw / (2 * (q || .707));
  let b0, b1, b2, a0, a1, a2;
  if (type === 'highpass') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
  else if (type === 'peaking') { b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; }
  else {
    const sq = 2 * Math.sqrt(A) * alpha;
    if (type === 'lowshelf') { b0 = A * ((A + 1) - (A - 1) * cw + sq); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - sq); a0 = (A + 1) + (A - 1) * cw + sq; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - sq; }
    else { b0 = A * ((A + 1) + (A - 1) * cw + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sq); a0 = (A + 1) - (A - 1) * cw + sq; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sq; }
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function filter(x, c) {
  const [b0, b1, b2, a1, a2] = c; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
}

// ---- Spektral gürültü azaltma ----
const tick = () => new Promise(r => setTimeout(r));
async function denoise(x, fs, amount, onTick) {
  if (amount <= .01 || x.length < 4096) return x;
  const N = 2048, H = 512, fft = makeFFT(N), win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = .5 - .5 * Math.cos(TAU * i / N);
  const frames = Math.ceil((x.length + N) / H) + 1, padded = new Float32Array(frames * H + N);
  padded.set(x, N / 2 | 0);
  // gürültü profili: en sessiz (en düşük enerjili) kareler
  const energy = new Float64Array(frames);
  for (let f = 0; f < frames; f++) { let s = 0; const o = f * H; for (let i = 0; i < N; i += 4) { const v = padded[o + i]; s += v * v; } energy[f] = s; }
  const order = Array.from(energy.keys()).sort((a, b) => energy[a] - energy[b]), pick = order.slice(0, clamp(Math.round(frames * .12), 6, 80));
  const bins = N / 2 + 1, noise = new Float64Array(bins), re = new Float64Array(N), im = new Float64Array(N);
  for (const f of pick) {
    const o = f * H; for (let i = 0; i < N; i++) { re[i] = padded[o + i] * win[i]; im[i] = 0; }
    fft(re, im, false); for (let k = 0; k < bins; k++) noise[k] += Math.hypot(re[k], im[k]) / pick.length;
  }
  const alpha = 1.1 + amount * 1.6, floor = Math.pow(10, -(8 + amount * 20) / 20), out = new Float32Array(padded.length), norm = new Float32Array(padded.length);
  const prev = new Float64Array(bins).fill(1), gain = new Float64Array(bins);
  for (let f = 0; f < frames; f++) {
    const o = f * H; for (let i = 0; i < N; i++) { re[i] = padded[o + i] * win[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 0; k < bins; k++) {
      const m = Math.hypot(re[k], im[k]) + 1e-12, g = Math.max(floor, (m - alpha * noise[k]) / m);
      gain[k] = g > prev[k] ? g : prev[k] * .55 + g * .45;     // hızlı açılış, yavaş kapanış: "müzikal gürültü"yü azaltır
    }
    for (let k = 0; k < bins; k++) { const g = (gain[Math.max(0, k - 1)] + 2 * gain[k] + gain[Math.min(bins - 1, k + 1)]) / 4; prev[k] = gain[k]; re[k] *= g; im[k] *= g; if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; } }
    fft(re, im, true);
    for (let i = 0; i < N; i++) { out[o + i] += re[i] * win[i]; norm[o + i] += win[i] * win[i]; }
    if (f % 150 === 149) { if (onTick) onTick(f / frames); await tick(); }
  }
  const res = new Float32Array(x.length), off = N / 2 | 0;
  for (let i = 0; i < x.length; i++) { const n = norm[i + off]; res[i] = n > 1e-6 ? out[i + off] / n : 0; }
  return res;
}

function compress(x, fs, amount) {
  if (amount <= .01) return;
  const thr = -26, ratio = 1 + amount * 3.5, atk = Math.exp(-1 / (fs * .008)), rel = Math.exp(-1 / (fs * .18)); let env = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]); env = a > env ? atk * env + (1 - atk) * a : rel * env + (1 - rel) * a;
    const over = 20 * Math.log10(env + 1e-9) - thr; if (over > 0) x[i] *= Math.pow(10, -(over * (1 - 1 / ratio)) / 20);
  }
}

// Schroeder yankısı (4 comb + 2 allpass): ucuz ve doğal; yalnızca küçük karışım oranlarında kullanılır
function reverb(x, fs, amount) {
  if (amount <= .005) return x;
  const sc = fs / 44100, combs = [1557, 1617, 1491, 1422].map(d => ({ buf: new Float32Array(Math.round(d * sc)), i: 0 })), aps = [225, 556].map(d => ({ buf: new Float32Array(Math.round(d * sc)), i: 0 }));
  const fb = .8, wet = amount * .5, out = new Float32Array(x.length);
  for (let n = 0; n < x.length; n++) {
    const v = x[n]; let s = 0;
    for (const c of combs) { const y = c.buf[c.i]; c.buf[c.i] = v + y * fb; c.i = (c.i + 1) % c.buf.length; s += y; }
    s /= 4;
    for (const a of aps) { const y = a.buf[a.i], z = s + y * .5; a.buf[a.i] = z; s = y - z * .5; a.i = (a.i + 1) % a.buf.length; }
    out[n] = v + s * wet;
  }
  return out;
}

// Seviye: konuşulan kısımların RMS değeri hedef dBFS'e getirilir; yumuşak sınırlayıcı kırpmayı önler
function normalize(x, fs, targetDb) {
  const blk = Math.round(fs * .05), nb = Math.floor(x.length / blk), rms = new Float64Array(nb); let peak = 0;
  for (let b = 0; b < nb; b++) { let s = 0; for (let i = b * blk; i < (b + 1) * blk; i++) s += x[i] * x[i]; rms[b] = Math.sqrt(s / blk); if (rms[b] > peak) peak = rms[b]; }
  let sum = 0, cnt = 0; for (let b = 0; b < nb; b++) if (rms[b] > peak * .2) { sum += rms[b] * rms[b]; cnt++; }
  if (!cnt || sum <= 0) return x;
  const cur = 20 * Math.log10(Math.sqrt(sum / cnt)), g = Math.pow(10, clamp(targetDb - cur, -12, 30) / 20);
  let mx = 0; for (let i = 0; i < x.length; i++) { let v = x[i] * g; const a = Math.abs(v); if (a > .7) v = Math.sign(v) * (.7 + .3 * Math.tanh((a - .7) / .3)); x[i] = v; if (Math.abs(v) > mx) mx = Math.abs(v); }
  if (mx > .89) { const k = .89 / mx; for (let i = 0; i < x.length; i++) x[i] *= k; }
  return x;
}

const PRESETS = {
  off: { name: 'Kapalı' },
  dogal: { name: 'Doğal', hp: 80, denoise: 60, eq: [], comp: 25, reverb: 0, target: -19 },
  net: { name: 'Net Anlatım', hp: 90, denoise: 70, eq: [['peaking', 250, 1, -2], ['peaking', 3200, 1, 2.5], ['highshelf', 9000, .7, 1.5]], comp: 50, reverb: 0, target: -17 },
  sicak: { name: 'Sıcak Şiir', hp: 70, denoise: 60, eq: [['lowshelf', 180, .7, 2], ['peaking', 3000, 1, 1], ['highshelf', 8000, .7, -1.5]], comp: 40, reverb: 8, target: -18 }
};
// ayarlar: { preset, denoise (0–100), reverb (0–40), comp (0–100, isteğe bağlı), level (bool) }
function resolve(opts) { const p = PRESETS[opts && opts.preset] || PRESETS.off, o = opts || {}; return { ...p, denoise: o.denoise != null ? o.denoise : p.denoise, reverb: o.reverb != null ? o.reverb : p.reverb, comp: o.comp != null ? o.comp : p.comp, level: o.level !== false }; }
async function enhance(input, fs, opts, onTick) {
  if (!opts || opts.preset === 'off' || !PRESETS[opts.preset]) return input;
  const s = resolve(opts);
  let x = new Float32Array(input);
  if (s.hp) { filter(x, biquad('highpass', s.hp, .707, 0, fs)); filter(x, biquad('highpass', s.hp, .707, 0, fs)); }
  x = await denoise(x, fs, (s.denoise || 0) / 100, onTick);
  for (const [t, f, q, g] of s.eq || []) filter(x, biquad(t, f, q, g, fs));
  compress(x, fs, (s.comp || 0) / 100);
  x = reverb(x, fs, (s.reverb || 0) / 100);
  if (s.level) x = normalize(x, fs, s.target || -18);
  return x;
}
const api = { enhance, denoise, normalize, PRESETS, resolve, makeFFT };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Voice = api;
})(typeof self !== 'undefined' ? self : this);
