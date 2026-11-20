import { existsSync } from "node:fs";
import path from "node:path";
import { dirs, production } from "./config.js";
import { runFfmpeg } from "./ffmpeg.js";
import type { TrackRecord } from "./catalog.js";

const inflight = new Map<string, Promise<string>>();

/**
 * Tam kaliteli ana (master) dosya yolu. Yalnızca sunucu içinde kullanılır; hiçbir yanıtta dönmez.
 * Gerçek parçalar `private/music/master/<id>.flac|wav` altında beklenir.
 * Yer tutucu (placeholder) parçalar yalnızca geliştirmede, sentetik olarak üretilir ve üretimde ASLA.
 */
export async function resolveMaster(t: TrackRecord): Promise<string> {
  for (const ext of ["flac", "wav"]) {
    const p = path.join(dirs.music, "master", `${t.id}.${ext}`);
    if (existsSync(p)) return p;
  }
  if (t.license.type !== "placeholder" || production) throw new Error("Parçanın ana dosyası bulunamadı.");
  const out = path.join(dirs.music, "master", `${t.id}.wav`);
  let job = inflight.get(t.id);
  if (!job) {
    job = synthesize(t, out).finally(() => inflight.delete(t.id));
    inflight.set(t.id, job);
  }
  return job;
}

async function synthesize(t: TrackRecord, out: string): Promise<string> {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(path.dirname(out), { recursive: true });
  const f = t.baseHz;
  // 120 sn, 48 kHz stereo sentetik akor (gerçek müzik değil)
  const expr = (k: number) => `0.12*sin(2*PI*${(f * k).toFixed(2)}*t)*(0.6+0.4*sin(2*PI*${(0.05 * k).toFixed(3)}*t))`;
  const r = await runFfmpeg([
    "-y", "-f", "lavfi", "-i", `aevalsrc=${expr(1)}+${expr(1.2599)}+${expr(1.4983)}|${expr(1)}+${expr(1.1892)}+${expr(1.7818)}:s=48000:d=120`,
    "-c:a", "pcm_s24le", out + ".part.wav",
  ], 120_000);
  if (r.code !== 0) throw new Error("Yer tutucu müzik üretilemedi.");
  const { renameSync } = await import("node:fs");
  renameSync(out + ".part.wav", out);
  return out;
}
