import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runFfmpeg } from "@siir/server-kit";

export const TMP = path.join(process.env.TEMP ?? ".", "siir-video-tests");
mkdirSync(TMP, { recursive: true });

/** 48 kHz 16-bit mono WAV: belirli aralıklarda 3 kHz ton (konuşma benzeri). */
export function makeWav(file: string, sec: number, bursts: [number, number][] = [[0, sec]], amp = 0.25) {
  const n = Math.round(sec * 48000), data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / 48000, on = bursts.some(([a, b]) => t >= a && t < b);
    data.writeInt16LE(Math.round((on ? amp * Math.sin(2 * Math.PI * 3000 * t) : 0) * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(48000, 24); h.writeUInt32LE(96000, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

export async function probe(file: string) {
  const r = await runFfmpeg(["-i", file]); // çıktı verilmediği için kod ≠ 0; bilgi stderr'de
  const text = r.stderr;
  const dur = /Duration:\s+(\d+):(\d+):([\d.]+)/.exec(text);
  const vid = /Video: (\w+)[^\n]*?, (yuv\w+)[^\n]*?, (\d+)x(\d+)[^\n]*?, (\d+(?:\.\d+)?) fps/.exec(text);
  return {
    text, durationSec: dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : NaN,
    vcodec: vid?.[1], pixfmt: vid?.[2], width: vid ? +vid[3] : NaN, height: vid ? +vid[4] : NaN, fps: vid ? +vid[5] : NaN,
    acodec: /Audio: (\w+)/.exec(text)?.[1],
  };
}

/** Karenin orta şeridinde, belirli andaki ortalama parlaklık (YAVG): beyaz yazı görününce artar. */
export async function centerLuma(file: string, atSec: number): Promise<number> {
  const r = await runFfmpeg(["-ss", String(atSec), "-i", file, "-frames:v", "1", "-vf", "crop=iw:ih/3:0:ih/3,signalstats,metadata=print:file=-", "-f", "null", "-"]);
  const m = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(r.stdout + r.stderr);
  return m ? +m[1] : NaN;
}

/** Orta şeritte en parlak piksel (YMAX). Beyaz yazı ≈ 235; koyu degrade ≤ ~120: animasyondan etkilenmeyen yazı göstergesi. */
export async function centerYmax(file: string, atSec: number): Promise<number> {
  const r = await runFfmpeg(["-ss", String(atSec), "-i", file, "-frames:v", "1", "-vf", "crop=iw:ih/3:0:ih/3,signalstats,metadata=print:file=-", "-f", "null", "-"]);
  const m = /lavfi\.signalstats\.YMAX=([\d.]+)/.exec(r.stdout + r.stderr);
  return m ? +m[1] : NaN;
}
