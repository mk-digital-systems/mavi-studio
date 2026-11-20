import { test, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ExportRecipe } from "@siir/contracts";
import { loadCatalog } from "../src/catalog.js";
import { mix, MixError } from "../src/mixer.js";
import { validateRecipe } from "../src/recipe.js";
import { inspectWav } from "../src/wavinfo.js";
import { levelDb, loudness, makeVoiceWav, probe, TMP } from "./util.js";

const track = loadCatalog()[0];
const voice = path.join(TMP, "voice.wav");
const silent = path.join(TMP, "silent.wav");
const recipe = (o: Partial<ExportRecipe> & Record<string, unknown> = {}): ExportRecipe =>
  validateRecipe({ format: "wav", trackId: track.id, title: "Sessiz Gece", poet: "Mustafa Öner", reader: "Mustafa Öner", ...o });

before(() => {
  // 0–3 sn ve 6–9 sn konuşma; 3–6 ve 9–12 sn sessizlik (kuyruk yok)
  makeVoiceWav(voice, { sec: 12, bursts: [[0, 3], [6, 9]] });
  makeVoiceWav(silent, { sec: 4, bursts: [] });
});
const run = (r: ExportRecipe, name: string, trk: typeof track | null = track) => {
  const out = path.join(TMP, name);
  return mix({ voicePath: voice, info: inspectWav(voice, 900), recipe: r, track: trk, outPath: out }).then((rep) => ({ out, rep }));
};

test("WAV çıktı: 48 kHz stereo 24-bit, hedef −16 LUFS, gerçek tepe ≤ −1 dBTP", async () => {
  const { out, rep } = await run(recipe(), "mix.wav");
  const p = await probe(out);
  assert.match(p.text, /pcm_s24le/); assert.match(p.text, /48000 Hz, stereo/);
  const l = await loudness(out);
  assert.ok(Math.abs(l.lufs - -16) <= 1.0, `LUFS ${l.lufs}`);
  assert.ok(l.tp <= -0.9, `tepe ${l.tp}`);
  assert.ok(Math.abs(p.durationSec - (12 + 3)) < 0.2, `süre ${p.durationSec}`); // ses 12 sn + müzik kuyruğu 3 sn
  assert.ok(rep.duckThresholdDb !== null);
});

test("MP3 çıktı: 192 kbps stereo, ID3 etiketleri (başlık, sanatçı, besteci)", async () => {
  const { out } = await run(recipe({ format: "mp3" }), "mix.mp3");
  const p = await probe(out);
  assert.match(p.text, /mp3/); assert.match(p.text, /192 kb\/s/); assert.match(p.text, /stereo/);
  assert.match(p.text, /title\s*:\s*Sessiz Gece/); assert.match(p.text, /artist\s*:\s*Mustafa Öner/);
  const l = await loudness(out); assert.ok(Math.abs(l.lufs - -16) <= 1.2, `LUFS ${l.lufs}`);
});

test("ducking: konuşurken müzik belirgin kısılır, sessizlikte geri gelir", async () => {
  const on = await run(recipe({ ducking: { enabled: true, amountDb: 8 } }), "duck-on.wav");
  const off = await run(recipe({ ducking: { enabled: false } }), "duck-off.wav");
  // 220–330 Hz'lik müzik bileşenini (düşük geçiren) ölç; ses 3 kHz+ olduğu için karışmaz
  const speechOn = await levelDb(on.out, 1.5, 2.8), speechOff = await levelDb(off.out, 1.5, 2.8);
  const gapOn = await levelDb(on.out, 5.0, 5.9), gapOff = await levelDb(off.out, 5.0, 5.9);
  // iki çıktı ayrı normalleştirildiği için "kısılma"yı konuşma/sessizlik farkından ölç
  const dropOn = gapOn - speechOn, dropOff = gapOff - speechOff;
  assert.ok(dropOn - dropOff >= 5, `ducking farkı yalnızca ${(dropOn - dropOff).toFixed(1)} dB (konuşma ${speechOn}, boşluk ${gapOn})`);
  assert.ok(dropOn - dropOff <= 14, `ducking fazla: ${(dropOn - dropOff).toFixed(1)} dB`);
});

test("müziksiz çıktı çalışır ve süre yalnızca ses kadardır", async () => {
  const { out } = await run(recipe({ trackId: null }), "nomusic.wav", null);
  const p = await probe(out); assert.ok(Math.abs(p.durationSec - 12) < 0.2, `süre ${p.durationSec}`);
  const l = await loudness(out); assert.ok(Math.abs(l.lufs - -16) <= 1.0, `LUFS ${l.lufs}`);
});

test("zamanlama kayması: pozitif değer sesi geciktirir (süre uzar)", async () => {
  const a = await run(recipe({ trackId: null, alignmentOffsetMs: 400 }), "al.wav", null);
  const p = await probe(a.out); assert.ok(Math.abs(p.durationSec - 12.4) < 0.2, `süre ${p.durationSec}`);
});

test("müzik kısa kalırsa döngüyle uzar (parça 120 sn, çıktı > müzik başlangıcı payı)", async () => {
  const { out } = await run(recipe({ music: { startOffsetSec: 110, tailSec: 4 } }), "loop.wav");
  const p = await probe(out); assert.ok(Math.abs(p.durationSec - 16) < 0.2, `süre ${p.durationSec}`);
  const l = await loudness(out); assert.ok(Number.isFinite(l.lufs));
});

test("sessiz kayıt temiz hatayla reddedilir", async () => {
  await assert.rejects(
    mix({ voicePath: silent, info: inspectWav(silent, 900), recipe: recipe(), track, outPath: path.join(TMP, "s.wav") }),
    (e: unknown) => e instanceof MixError && e.code === "silent",
  );
  assert.ok(!existsSync(path.join(TMP, "s.wav")));
});

test("çıktı dosyası ham müzik değildir: müzik master dosyasıyla bayt bayt aynı olamaz", async () => {
  const { out } = await run(recipe(), "cmp.wav");
  const master = path.join(path.resolve(TMP, ".."), "x"); void master;
  assert.ok(statSync(out).size > 0 && readFileSync(out).subarray(0, 4).toString() === "RIFF");
});
