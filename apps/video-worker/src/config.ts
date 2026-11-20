import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSigningSecret } from "@siir/server-kit";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = process.env;
const int = (v: string | undefined, d: number) => (v && Number.isFinite(+v) ? +v : d);

export const production = env.NODE_ENV === "production";
const dataDir = path.resolve(env.SIIR_DATA_DIR ?? path.join(root, "..", "..", "private"));

/**
 * Video işçisi AYRI bir süreçtir. Ses modülüyle tek bağı: paylaşılan veri dizininde API'nin yazdığı
 * imzalı, kısa ömürlü ses başvurusu (okuma) ve ortak imza anahtarıdır. Ses modülünün koduna bağımlı değildir.
 */
export const config = {
  port: int(env.VIDEO_PORT, 5172),
  /** Varsayılan günlük video sınırı (varsayım; karar bekliyor). */
  maxVideosPerDay: int(env.MAX_VIDEOS_PER_DAY, 5),
  maxAudioSec: int(env.MAX_VIDEO_AUDIO_SEC, 10 * 60),
  outputTtlMs: int(env.VIDEO_OUTPUT_TTL_MS, 30 * 60_000),
  sweepEveryMs: int(env.SWEEP_EVERY_MS, 30_000),
  maxConcurrentRender: int(env.MAX_CONCURRENT_RENDER, 1),
  downloadTokenTtlSec: 120,
  renderTimeoutMs: int(env.RENDER_TIMEOUT_MS, 20 * 60_000),
  ffmpegPath: env.FFMPEG_PATH ?? "",
  dataDir,
  /** API'nin dışa aktarma çıktılarını (ve meta dosyalarını) yazdığı dizin — YALNIZCA OKUNUR. */
  exportDir: path.join(dataDir, "tmp"),
  /** Video işçisinin kendi geçici dizini. */
  workDir: path.join(dataDir, "video-tmp"),
  fontsDir: path.join(root, "fonts"),
  signingSecret: "",
};
config.signingSecret = loadSigningSecret({ dataDir, env: env.SIGNING_SECRET, production });
mkdirSync(config.workDir, { recursive: true });
