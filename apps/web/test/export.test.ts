import { test } from "node:test";
import assert from "node:assert/strict";
import { Analyzer } from "../src/audio/fx/analysis";
import { LoudnessMeter, measureLufs } from "../src/audio/fx/loudness";
import { RenderAborted, renderTakeToWav } from "../src/audio/fx/render";
import { dbToLin } from "../src/audio/fx/dsp";
import { applyPreset, defaultFx, LIMITS, PRESET_ORDER } from "../src/audio/fx/settings";
import { defaultMix, sanitizeMix, toRecipe } from "../src/shared/mix";
import { migrateProject } from "../src/storage/migrate";
import type { TakeReader } from "../src/storage/takeReader";
import { validateRecipe } from "../../api/src/recipe";
import { FS, sine, speechLike } from "./helpers";

const readerOf = (sig: Float32Array): TakeReader => ({ sampleRate: FS, totalSamples: sig.length, async read(a, n) { return sig.slice(Math.max(0, a), Math.max(0, a) + Math.max(0, n)); } });
const analyze = (x: Float32Array) => { const a = new Analyzer(FS); a.push(x); return a.result(); };

async function decode(blob: Blob) {
  const b = Buffer.from(await blob.arrayBuffer());
  const ch = b.readUInt16LE(22), sr = b.readUInt32LE(24), bits = b.readUInt16LE(34), len = b.readUInt32LE(40);
  const frames = len / (3 * ch), L = new Float32Array(frames), R = new Float32Array(frames);
  for (let i = 0; i < frames; i++) { L[i] = b.readIntLE(44 + i * 3 * ch, 3) / 8388608; R[i] = b.readIntLE(44 + i * 3 * ch + 3 * (ch - 1), 3) / 8388608; }
  return { ch, sr, bits, len, frames, L, R, total: b.length };
}
const peakOf = (...a: Float32Array[]) => Math.max(...a.map((x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));

test("ses yüksekliği ölçümü BS.1770 referanslarıyla uyuşur", () => {
  const s = sine(FS * 6, 997, 1.0), z = sine(FS * 6, 997, 0.1);
  assert.ok(Math.abs(measureLufs(FS, s) - -3.01) < 0.1, "tek kanal 0 dBFS 997 Hz ≈ −3,01 LUFS");
  assert.ok(Math.abs(measureLufs(FS, z, z) - -20.0) < 0.15, "iki kanal −20 dBFS ≈ −20 LUFS");
  assert.equal(measureLufs(FS, new Float32Array(FS * 3), new Float32Array(FS * 3)), -Infinity);
  // kapılama: çok sessiz bölüm sonucu etkilemez
  const loud = sine(FS * 10, 997, 0.1), quiet = sine(FS * 10, 997, 0.001), both = new Float32Array(FS * 20);
  both.set(loud); both.set(quiet, FS * 10);
  assert.ok(Math.abs(measureLufs(FS, both, both) - -20) < 0.3, "göreli kapı sessiz bölümü dışlamalı");
  assert.throws(() => new LoudnessMeter(44100, 2));
});

test("blok bölme ölçümü değiştirmez", () => {
  const x = speechLike(8, 0.2), m = new LoudnessMeter(FS, 1);
  for (let i = 0; i < x.length; i += 7777) m.push(x.subarray(i, Math.min(x.length, i + 7777)));
  assert.ok(Math.abs(m.integrated() - measureLufs(FS, x)) < 1e-9);
});

test("çevrimdışı render: stereo 48 kHz 24-bit WAV, −16 LUFS'a normalleşir, tavan aşılmaz, kaynak değişmez", async () => {
  const sig = speechLike(6, 0.04), copy = new Float32Array(sig); // çok kısık kayıt → yükseltilmeli
  const prog: number[] = [];
  const r = await renderTakeToWav(readerOf(sig), defaultFx("small-hall"), analyze(sig), { normalize: true, targetLufs: -16, onProgress: (p) => prog.push(p) });
  const d = await decode(r.blob);
  assert.equal(d.ch, 2); assert.equal(d.sr, 48000); assert.equal(d.bits, 24); assert.equal(d.total, 44 + d.len);
  assert.ok(d.frames / FS > 6 && d.frames / FS < 6 + 4, "kayıt + yankı kuyruğu");
  const l = measureLufs(FS, d.L, d.R);
  assert.ok(Math.abs(l - -16) <= 1.0, `LUFS ${l}`);
  assert.ok(Math.abs(r.lufs - l) < 0.05, "rapor edilen değer ölçümle tutarlı");
  assert.ok(peakOf(d.L, d.R) <= dbToLin(LIMITS.limiterCeilingDb) + 1e-4, "tepe tavanı");
  assert.deepEqual(sig, copy, "kaynak kayıt değişmemeli");
  assert.ok(prog.length > 2 && prog[prog.length - 1] === 1 && prog.every((p, i) => i === 0 || p >= prog[i - 1] - 0.5), "ilerleme bildirimi");
});

test("tüm atmosferler: render sonlu, tavan altında; normalleştirme kapalıysa kazanç 0", async () => {
  const sig = speechLike(3, 0.3), a = analyze(sig);
  for (const id of PRESET_ORDER) {
    const r = await renderTakeToWav(readerOf(sig), applyPreset(defaultFx(), id), a, { normalize: false });
    const d = await decode(r.blob);
    assert.equal(r.appliedGainDb, 0);
    assert.ok(peakOf(d.L, d.R) <= dbToLin(LIMITS.limiterCeilingDb) + 1e-4, id);
    assert.ok(d.L.every(Number.isFinite));
  }
});

test("çok yüksek kayıt normalleştirmede aşağı çekilir ve tepe tavanı korunur", async () => {
  const sig = speechLike(4, 0.95), a = analyze(sig);
  const r = await renderTakeToWav(readerOf(sig), defaultFx("cinematic"), a, { normalize: true });
  const d = await decode(r.blob);
  assert.ok(peakOf(d.L, d.R) <= dbToLin(LIMITS.limiterCeilingDb) + 1e-4);
  assert.ok(Number.isFinite(r.lufs));
});

test("render iptal edilebilir", async () => {
  const ac = new AbortController(), sig = speechLike(12, 0.2);
  const p = renderTakeToWav(readerOf(sig), defaultFx(), analyze(sig), { signal: ac.signal, onProgress: () => ac.abort() });
  await assert.rejects(p, (e: unknown) => e instanceof RenderAborted);
});

test("miks ayarları: sınırlara sıkışır, bozuk girdi varsayılana döner, eski projelere varsayılan eklenir", () => {
  const m = sanitizeMix({ format: "flac", poet: "a\u0000b", music: { gainDb: 99, fadeInSec: -3, tailSec: "x" }, ducking: { amountDb: 1e9, enabled: "evet" }, alignmentOffsetMs: -1e9 });
  assert.equal(m.format, "wav"); assert.equal(m.poet, "a b"); assert.equal(m.music.gainDb, 0); assert.equal(m.music.fadeInSec, 0);
  assert.equal(m.music.tailSec, defaultMix().music.tailSec); assert.equal(m.ducking.amountDb, 18); assert.equal(m.ducking.enabled, true); assert.equal(m.alignmentOffsetMs, -500);
  for (const bad of [null, undefined, 5, "x", []]) assert.deepEqual(sanitizeMix(bad), defaultMix());
  assert.deepEqual(migrateProject({ id: "eski", schemaVersion: 1, title: "t" }).mix, defaultMix());
});

test("istemci tarifi sunucunun doğrulamasından değişmeden geçer (sözleşme uyumu); ses/müzik alanı içermez", () => {
  const p = migrateProject({ id: "1", title: "Sessiz Gece", trackId: "trk_0004" });
  const mix = sanitizeMix({ format: "mp3", poet: "Ş", reader: "O", music: { gainDb: -22, startOffsetSec: 5, tailSec: 4, fadeInSec: 1, fadeOutSec: 2 }, ducking: { enabled: true, amountDb: 10, attackMs: 60, releaseMs: 700 }, alignmentOffsetMs: 120 });
  const r = toRecipe(p, mix);
  assert.deepEqual(validateRecipe(r), r);
  assert.deepEqual(validateRecipe(toRecipe({ ...p, trackId: null }, defaultMix())), toRecipe({ ...p, trackId: null }, defaultMix()));
  assert.ok(!/blob|data:|base64|filePath|private:/i.test(JSON.stringify(r)));
});
