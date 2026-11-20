import { loadSigningSecret } from "@siir/server-kit";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = process.env;
const int = (v: string | undefined, d: number) => (v && Number.isFinite(+v) ? +v : d);

export const production = env.NODE_ENV === "production";

/** Onaylı sınırlar (plan bölüm 16). Test için ortamdan kısaltılabilir; üretimde varsayılanlar geçerlidir. */
export const config = {
  port: int(env.PORT, 5171),
  maxExportsPerDay: int(env.MAX_EXPORTS_PER_DAY, 10),
  maxRecordingSec: 15 * 60,
  maxTailSec: 10,                                   // yankı kuyruğu payı
  uploadTtlMs: int(env.UPLOAD_TTL_MS, 60 * 60_000),  // yüklenen ses en fazla 1 saat
  outputTtlMs: int(env.OUTPUT_TTL_MS, 30 * 60_000),  // çıktı en fazla 30 dk
  awaitUploadMs: 10 * 60_000,                        // iş açıldıktan sonra yükleme için süre
  sweepEveryMs: int(env.SWEEP_EVERY_MS, 30_000),
  maxConcurrentMix: int(env.MAX_CONCURRENT_MIX, 2),
  downloadTokenTtlSec: 120,
  /** 48 kHz · 24-bit · stereo · 15 dk + kuyruk ≈ 262 MB; biraz pay. */
  maxUploadBytes: int(env.MAX_UPLOAD_BYTES, 280 * 1024 * 1024),
  dataDir: path.resolve(env.SIIR_DATA_DIR ?? path.join(root, "..", "..", "private")),
  ffmpegPath: env.FFMPEG_PATH ?? "",
  turnstileSecret: env.TURNSTILE_SECRET ?? "",
  signingSecret: env.SIGNING_SECRET ?? "",
};

// Üretimde ortamdan zorunlu; geliştirmede API ve video işçisi aynı anahtarı veri dizininden paylaşır.
config.signingSecret = loadSigningSecret({ dataDir: config.dataDir, env: config.signingSecret, production });
if (production && !config.turnstileSecret) throw new Error("Üretimde TURNSTILE_SECRET zorunludur (bot koruması).");

export const dirs = {
  tmp: path.join(config.dataDir, "tmp"),          // yüklenen ses + çıktılar (kısa ömürlü)
  music: path.join(config.dataDir, "music"),      // özel müzik depolaması (master dosyalar)
};
for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true });
