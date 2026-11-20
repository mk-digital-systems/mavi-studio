import { newToken, safeEqual, signRef, signToken, verifyToken } from "@siir/server-kit";
import { config, production } from "./config.js";

export { newToken, safeEqual };

/** Kısa ömürlü indirme adresi imzası: jobId + son kullanma. Dosya yolu veya müzik bilgisi içermez. */
export const signDownload = (jobId: string, ttlSec = config.downloadTokenTtlSec, now = Date.now()) => signToken(config.signingSecret, jobId, ttlSec, now);
export const verifyDownload = (jobId: string, token: string, now = Date.now()) => verifyToken(config.signingSecret, jobId, token, now);
/** Video işçisine verilen ses başvurusu (süreçler arası, imzalı, kısa ömürlü). */
export const signAudioRef = (jobId: string, ttlSec: number, now = Date.now()) => signRef(config.signingSecret, jobId, ttlSec, now);

/**
 * Bot koruması (Cloudflare Turnstile). Gizli anahtar yoksa yalnızca geliştirmede atlanır;
 * üretimde anahtar zorunludur (config.ts başlangıçta durdurur).
 */
export async function verifyBot(token: string | undefined, ip: string): Promise<boolean> {
  if (!config.turnstileSecret) return !production;
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: config.turnstileSecret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    const j = (await r.json()) as { success?: boolean };
    return j.success === true;
  } catch { return false; }
}

export const isSessionId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
