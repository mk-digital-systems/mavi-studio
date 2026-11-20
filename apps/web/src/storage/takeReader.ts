import type { Take } from "@siir/contracts";
import { s24ToF32 } from "../audio/wav";
import { store, wrap } from "./db";

/** Ses, diskten (IndexedDB) istenen aralık kadar okunur; tüm kayıt belleğe alınmaz. */
export interface TakeReader {
  sampleRate: number;
  totalSamples: number;
  read(start: number, count: number): Promise<Float32Array>;
}

const range = (id: string, a = 0, b = Number.MAX_SAFE_INTEGER) => IDBKeyRange.bound([id, a], [id, b]);

export async function openTakeReader(take: Take): Promise<TakeReader> {
  // Duraklatmada kısa parçalar oluşabileceği için parça uzunlukları bir kez taranır (yalnızca sayı tutulur).
  const { s } = await store("audioChunks", "readonly");
  const lens: number[] = [];
  await new Promise<void>((res, rej) => {
    const rq = s.openCursor(range(take.id));
    rq.onsuccess = () => { const c = rq.result; if (c) { lens.push((c.value as Uint8Array).length / 3); c.continue(); } else res(); };
    rq.onerror = () => rej(rq.error);
  });
  const offsets = new Float64Array(lens.length + 1);
  lens.forEach((n, i) => (offsets[i + 1] = offsets[i] + n));
  const total = offsets[lens.length];

  const chunkAt = (sample: number) => { // son i: offsets[i] <= sample
    let lo = 0, hi = lens.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (offsets[mid] <= sample) lo = mid; else hi = mid - 1; }
    return lo;
  };

  return {
    sampleRate: take.sampleRate,
    totalSamples: total,
    async read(start, count) {
      const a = Math.max(0, Math.floor(start)), b = Math.min(total, a + Math.max(0, Math.floor(count)));
      const out = new Float32Array(Math.max(0, b - a));
      if (out.length === 0 || lens.length === 0) return out;
      const i0 = chunkAt(a), i1 = chunkAt(b - 1);
      const { s: st } = await store("audioChunks", "readonly");
      const rows = (await wrap(st.getAll(range(take.id, i0, i1)))) as Uint8Array[];
      let w = 0;
      rows.forEach((bytes, k) => {
        const idx = i0 + k, cStart = offsets[idx];
        const from = Math.max(a, cStart) - cStart, to = Math.min(b, cStart + lens[idx]) - cStart;
        w += s24ToF32(bytes, out, w, from * 3, to * 3);
      });
      return out;
    },
  };
}

/** Tüm kaydı sırayla (5 sn'lik bloklarla) okuyup çözümler. */
export async function analyzeReader(
  r: TakeReader, analyzerFactory: (fs: number) => { push(x: Float32Array): void; result(): unknown }, onProgress?: (p: number) => void,
) {
  const an = analyzerFactory(r.sampleRate), step = r.sampleRate * 5;
  for (let p = 0; p < r.totalSamples; p += step) {
    an.push(await r.read(p, step));
    onProgress?.(Math.min(1, (p + step) / Math.max(1, r.totalSamples)));
  }
  return an.result();
}
