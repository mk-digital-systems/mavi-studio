import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Konuya (ör. iş kimliği) bağlı, kısa ömürlü HMAC belirteci: "<bitiş>.<imza>". Veri içermez, yalnızca doğrular. */
export function signToken(secret: string, subject: string, ttlSec: number, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSec;
  return `${exp}.${createHmac("sha256", secret).update(`${subject}.${exp}`).digest("base64url")}`;
}
export function verifyToken(secret: string, subject: string, token: string, now = Date.now()): boolean {
  const [expS, sig] = String(token).split(".");
  const exp = +expS;
  if (!Number.isFinite(exp) || !sig || exp < Math.floor(now / 1000)) return false;
  const want = createHmac("sha256", secret).update(`${subject}.${exp}`).digest();
  let got: Buffer;
  try { got = Buffer.from(sig, "base64url"); } catch { return false; }
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Süreçler arası başvuru: "<id>.<bitiş>.<imza>" (id yalnızca [0-9a-f-]). */
export function signRef(secret: string, id: string, ttlSec: number, now = Date.now()): string {
  return `${id}.${signToken(secret, `ref:${id}`, ttlSec, now)}`;
}
/** Geçerliyse id'yi, değilse null döner. */
export function verifyRef(secret: string, ref: string, now = Date.now()): string | null {
  const i = String(ref).indexOf(".");
  if (i < 0) return null;
  const id = ref.slice(0, i);
  if (!/^[0-9a-f-]{8,64}$/i.test(id)) return null;
  return verifyToken(secret, `ref:${id}`, ref.slice(i + 1), now) ? id : null;
}
export const newToken = () => randomBytes(24).toString("base64url");
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
