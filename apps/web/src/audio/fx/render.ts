import type { FxSettings } from "@siir/contracts";
import type { TakeReader } from "../../storage/takeReader";
import { resampleReader } from "../resample";
import { wav24 } from "../wav";
import type { Analysis } from "./analysis";
import { FxChain } from "./chain";
import { LoudnessMeter } from "./loudness";
import { resolveParams, tailSeconds } from "./settings";

export type RenderOptions = {
  /** true: önce ölçülür, sonra −16 LUFS'a ayarlanır (çıkış sınırlayıcı tavanı yine geçerli). */
  normalize?: boolean; targetLufs?: number;
  onProgress?: (fraction: number) => void; signal?: AbortSignal;
};
export type RenderResult = { blob: Blob; durationSec: number; lufs: number; appliedGainDb: number };

const BLOCK_SEC = 5;
export class RenderAborted extends Error { constructor() { super("İşlem iptal edildi."); } }

/** Efektleri kalıcı olarak uygulayıp stereo 48 kHz 24-bit WAV üretir. Kaynak kayıt ve ayarlar değişmez. */
export async function renderTakeToWav(source: TakeReader, settings: FxSettings, analysis: Analysis, opt: RenderOptions = {}): Promise<RenderResult> {
  // Çıktı her zaman 48 kHz: cihaz 48 kHz vermediyse (ör. 44,1 kHz) kayıt burada çevrilir.
  const fs = 48000, reader = resampleReader(source, fs);
  const tail = Math.round(tailSeconds(settings, analysis) * fs);
  const base = resolveParams(settings, analysis);

  /** Tek geçiş: zinciri baştan sona akıtır. `collect` ise 24-bit stereo parçaları biriktirir. */
  async function pass(gainDb: number, collect: boolean, from: number, span: number) {
    const chain = new FxChain({ ...base, outputDb: base.outputDb + gainDb }, fs);
    const meter = new LoudnessMeter(fs, 2), parts: Uint8Array[] = [];
    let skip = chain.latency, total = 0;
    const emit = (l: Float32Array, r: Float32Array) => {
      let off = 0;
      if (skip > 0) { off = Math.min(skip, l.length); skip -= off; }
      if (off >= l.length) return;
      const L = l.subarray(off), R = r.subarray(off);
      meter.push(L, R); total += L.length;
      if (collect) {
        const out = new Uint8Array(L.length * 6);
        for (let i = 0, o = 0; i < L.length; i++) {
          for (const ch of [L, R]) {
            const c = Math.max(-1, Math.min(1, ch[i]));
            const v = Math.round(c < 0 ? c * 0x800000 : c * 0x7fffff);
            out[o++] = v & 255; out[o++] = (v >> 8) & 255; out[o++] = (v >> 16) & 255;
          }
        }
        parts.push(out);
      }
    };
    const N = BLOCK_SEC * fs, end = reader.totalSamples;
    for (let p = 0; p < end; p += N) {
      if (opt.signal?.aborted) throw new RenderAborted();
      const x = await reader.read(p, Math.min(N, end - p));
      const o = chain.process(x); emit(o.l, o.r);
      opt.onProgress?.((from + (span * Math.min(end, p + N)) / Math.max(1, end + tail)));
      await new Promise((r) => setTimeout(r, 0)); // arayüze nefes aldır
    }
    for (let p = 0; p < tail; p += N) { const o = chain.process(new Float32Array(Math.min(N, tail - p))); emit(o.l, o.r); }
    const f = chain.flush(); emit(f.l, f.r);
    return { meter, parts, total };
  }

  let gain = 0;
  if (opt.normalize) {
    const m = await pass(0, false, 0, 0.45);
    const lufs = m.meter.integrated();
    if (Number.isFinite(lufs)) gain = Math.max(-12, Math.min(12, (opt.targetLufs ?? -16) - lufs));
  }
  const r = await pass(gain, true, opt.normalize ? 0.45 : 0, opt.normalize ? 0.55 : 1);
  opt.onProgress?.(1);
  return { blob: wav24(r.parts, fs, 2), durationSec: r.total / fs, lufs: r.meter.integrated(), appliedGainDb: gain };
}
