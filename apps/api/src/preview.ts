import { randomBytes } from "node:crypto";

const TTL_MS = 10 * 60_000;
const sessions = new Map<string, { trackId: string; hz: number; exp: number; uses: number }>();

export function createSession(trackId: string, hz: number) {
  const token = randomBytes(18).toString("base64url");
  sessions.set(token, { trackId, hz, exp: Date.now() + TTL_MS, uses: 0 });
  return { token, expiresInSec: TTL_MS / 1000 };
}
export function useSession(token: string) {
  const s = sessions.get(token);
  if (!s || s.exp < Date.now() || s.uses >= 20) return null;
  s.uses++;
  return s;
}
setInterval(() => { for (const [k, v] of sessions) if (v.exp < Date.now()) sessions.delete(k); }, 60_000).unref();

/**
 * YER TUTUCU ön izleme: gerçek müzik yok; düşük kalite (11,025 kHz, 16-bit, mono, 40 sn)
 * sentetik ambient akor. Gerçek parçalarda burası özel depodan düşük kaliteli türevi okuyacak.
 */
export function syntheticPreviewWav(hz: number): Buffer {
  const sr = 11025, secs = 40, n = sr * secs;
  const pcm = Buffer.alloc(n * 2);
  const ratios = [1, 1.2599, 1.4983, 1.8877]; // yumuşak akor
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    ratios.forEach((r, k) => (v += Math.sin(2 * Math.PI * hz * r * t + k) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.07 * (k + 1) * t))));
    const fade = Math.min(1, t / 2, (secs - t) / 2);
    pcm.writeInt16LE(Math.round((v / 4) * 0.5 * fade * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
