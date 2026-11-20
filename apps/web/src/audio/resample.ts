import type { TakeReader } from "../storage/takeReader";

const A = 8; // Lanczos penceresi (taraf başına 8 örnek)
const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const lanczos = (x: number) => (Math.abs(x) >= A ? 0 : sinc(x) * sinc(x / A));

/**
 * Durumsuz (rastgele erişimli) yeniden örnekleyici: kaynağı `to` Hz'e çevirir (Lanczos-8).
 * Aşağı örneklemede kesim frekansı hedefin Nyquist'ine ölçeklenir. Aynı hızda kaynağı olduğu gibi döndürür.
 * Kullanım: 44,1 kHz gibi 48 kHz vermeyen cihazlarda dışa aktarmadan önce.
 */
export function resampleReader(src: TakeReader, to: number): TakeReader {
  if (src.sampleRate === to) return src;
  const ratio = src.sampleRate / to, scale = Math.max(1, ratio), half = A * scale;
  const total = Math.floor(src.totalSamples / ratio);
  return {
    sampleRate: to, totalSamples: total,
    async read(start, count) {
      const a = Math.max(0, Math.floor(start)), b = Math.min(total, a + Math.max(0, Math.floor(count)));
      const out = new Float32Array(Math.max(0, b - a));
      if (!out.length) return out;
      const s0 = Math.max(0, Math.floor(a * ratio - half) - 1);
      const s1 = Math.min(src.totalSamples, Math.ceil(b * ratio + half) + 1);
      const x = await src.read(s0, s1 - s0);
      for (let j = 0; j < out.length; j++) {
        const t = (a + j) * ratio;
        let acc = 0, wsum = 0;
        for (let i = Math.ceil(t - half); i <= Math.floor(t + half); i++) {
          const k = i - s0; if (k < 0 || k >= x.length) continue;
          const w = lanczos((t - i) / scale);
          acc += x[k] * w; wsum += w;
        }
        out[j] = wsum !== 0 ? acc / wsum : 0;
      }
      return out;
    },
  };
}
