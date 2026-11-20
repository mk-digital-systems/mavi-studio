export const FS = 48000;
export function noise(n: number, amp = 0.1, seed = 12345) {
  const x = new Float32Array(n); let s = seed;
  for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; x[i] = ((s / 4294967296) * 2 - 1) * amp; }
  return x;
}
export function sine(n: number, hz: number, amp = 0.3, fs = FS) {
  const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * hz * i) / fs); return x;
}
/** Konuşma benzeri: genlik zarflı karışık harmonikler + sessizlik aralıkları. */
export function speechLike(sec: number, amp = 0.25) {
  const n = Math.round(sec * FS), x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / FS, env = Math.max(0, Math.sin(2 * Math.PI * 2.5 * t)) ** 2;
    x[i] = amp * env * (Math.sin(2 * Math.PI * 140 * t) + 0.5 * Math.sin(2 * Math.PI * 280 * t) + 0.3 * Math.sin(2 * Math.PI * 2800 * t));
  }
  return x;
}
export const peak = (x: Float32Array) => { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); return p; };
export const rms = (x: Float32Array) => { let s = 0; for (const v of x) s += v * v; return Math.sqrt(s / Math.max(1, x.length)); };
