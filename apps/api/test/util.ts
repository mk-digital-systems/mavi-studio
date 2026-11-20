import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runFfmpeg } from "../src/ffmpeg.js";

export const TMP = path.join(process.env.TEMP ?? ".", "siir-api-tests");
mkdirSync(TMP, { recursive: true });

/** Konuşma benzeri sentetik ses: [başlangıç,bitiş] sn aralıklarında 3 kHz + 4,3 kHz tonlar (müzikten ayrışsın diye). */
export function makeVoiceWav(file: string, opts: { sec: number; bursts: [number, number][]; amp?: number; bits?: 16 | 24; channels?: 1 | 2; rate?: number }) {
  const { sec, bursts, amp = 0.25, bits = 24, channels = 2, rate = 48000 } = opts;
  const n = Math.round(sec * rate), bps = bits / 8, frame = bps * channels;
  const data = Buffer.alloc(n * frame);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const on = bursts.some(([a, b]) => t >= a && t < b);
    let v = on ? amp * (Math.sin(2 * Math.PI * 3000 * t) + 0.4 * Math.sin(2 * Math.PI * 4300 * t)) / 1.4 : 0;
    v = Math.max(-1, Math.min(1, v));
    for (let c = 0; c < channels; c++) {
      const o = i * frame + c * bps;
      if (bits === 16) data.writeInt16LE(Math.round(v * 32767), o); else data.writeIntLE(Math.round(v * 8388607), o, 3);
    }
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * frame, 28);
  h.writeUInt16LE(frame, 32); h.writeUInt16LE(bits, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

/** Belirli aralıkta (düşük geçiren filtreyle) ortalama seviye, dB. */
export async function levelDb(file: string, start: number, end: number, lowpassHz = 700): Promise<number> {
  const r = await runFfmpeg(["-i", file, "-af", `atrim=start=${start}:end=${end},lowpass=f=${lowpassHz}:poles=2,lowpass=f=${lowpassHz}:poles=2,lowpass=f=${lowpassHz}:poles=2,volumedetect`, "-f", "null", "-"]);
  const m = /mean_volume:\s*(-?[\d.]+|-inf)/.exec(r.stderr);
  return m ? (m[1] === "-inf" ? -120 : +m[1]) : NaN;
}

/** EBU R128 entegre seviye (LUFS) ve gerçek tepe (dBTP). */
export async function loudness(file: string): Promise<{ lufs: number; tp: number }> {
  const r = await runFfmpeg(["-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const tail = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  const i = /I:\s+(-?[\d.]+)\s+LUFS/.exec(tail), p = /Peak:\s+(-?[\d.]+)\s+dBFS/.exec(tail);
  return { lufs: i ? +i[1] : NaN, tp: p ? +p[1] : NaN };
}

export async function probe(file: string) {
  const r = await runFfmpeg(["-i", file, "-f", "null", "-"]);
  const dur = /Duration:\s+(\d+):(\d+):([\d.]+)/.exec(r.stderr);
  return { text: r.stderr, durationSec: dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : NaN };
}
