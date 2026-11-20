// İstemcideki ses yüksekliği ölçümünün (BS.1770) ffmpeg `ebur128` ile uyumu.
import "./env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { measureLufs } from "../../web/src/audio/fx/loudness.js";
import { speechLike, noise, sine } from "../../web/test/helpers.js";
import { loudness, TMP } from "./util.js";

function writeStereo24(file: string, L: Float32Array, R: Float32Array) {
  const n = L.length, data = Buffer.alloc(n * 6);
  for (let i = 0; i < n; i++) {
    data.writeIntLE(Math.round(Math.max(-1, Math.min(1, L[i])) * 8388607), i * 6, 3);
    data.writeIntLE(Math.round(Math.max(-1, Math.min(1, R[i])) * 8388607), i * 6 + 3, 3);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(48000, 24); h.writeUInt32LE(48000 * 6, 28);
  h.writeUInt16LE(6, 32); h.writeUInt16LE(24, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

test("istemci LUFS ölçümü ffmpeg ebur128 ile ±0,3 LU içinde uyuşur (konuşma, gürültü, sinüs)", async () => {
  const cases: [string, Float32Array, Float32Array][] = [];
  const sp = speechLike(20, 0.2); cases.push(["konuşma benzeri", sp, sp]);
  cases.push(["gürültü", noise(48000 * 12, 0.15, 7), noise(48000 * 12, 0.15, 99)]);
  const s = sine(48000 * 8, 440, 0.2); cases.push(["sinüs", s, s]);
  const quiet = new Float32Array(48000 * 20); quiet.set(speechLike(8, 0.3)); quiet.set(speechLike(8, 0.003), 48000 * 10); cases.push(["gürültülü + çok kısık bölüm (kapılama)", quiet, quiet]);
  for (const [name, L, R] of cases) {
    const f = path.join(TMP, "xl.wav"); writeStereo24(f, L, R);
    const ref = (await loudness(f)).lufs, mine = measureLufs(48000, L, R);
    assert.ok(Math.abs(ref - mine) <= 0.3, `${name}: ffmpeg ${ref} · bizim ${mine.toFixed(2)}`);
  }
});
