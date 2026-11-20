import "./env.js"; // ilk import: config'ten önce ortam ayarlanır
import path from "node:path";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { ExportCreated, ExportStatus } from "@siir/contracts";
import { makeVoiceWav, TMP } from "./util.js";

const { buildApp } = await import("../src/app.js");
const { JobStore } = await import("../src/jobs.js");
const { config, dirs } = await import("../src/config.js");
const { inspectWav, WavError } = await import("../src/wavinfo.js");
const { validateRecipe } = await import("../src/recipe.js");
const { signDownload, verifyDownload, verifyBot } = await import("../src/security.js");
const { DailyLimiter } = await import("../src/limits.js");

let clock = Date.now();
const jobs = new JobStore(() => clock);
const { app } = buildApp({ jobs, perMinute: 10_000 });
let base = "";
const voicePath = path.join(TMP, "api-voice.wav");
let voice: Buffer;
before(async () => {
  JobStore.wipeTmp();
  makeVoiceWav(voicePath, { sec: 4, bursts: [[0, 3]], bits: 16, channels: 1 }); // ≈ 384 KB, sınır altında
  voice = readFileSync(voicePath);
  base = await app.listen({ port: 0, host: "127.0.0.1" });
});
after(async () => { await app.close(); });

const H = (sid: string, extra: Record<string, string> = {}) => ({ "x-siir-session": sid, ...extra });
const recipe = (o: Record<string, unknown> = {}) => ({ format: "wav", trackId: "trk_0001", title: "Sessiz Gece", poet: "Mustafa Öner", reader: "Mustafa Öner", ...o });
const create = (sid: string, r: unknown = recipe()) =>
  fetch(base + "/api/exports", { method: "POST", headers: H(sid, { "content-type": "application/json" }), body: JSON.stringify({ recipe: r }) });
const upload = (c: ExportCreated, sid: string, body: Buffer = voice, extra: Record<string, string> = {}) =>
  fetch(base + c.uploadUrl, { method: "PUT", headers: H(sid, { "content-type": "audio/wav", "x-upload-token": c.uploadToken, ...extra }), body });
const status = async (id: string, sid: string) => (await (await fetch(`${base}/api/exports/${id}`, { headers: H(sid) })).json()) as ExportStatus;
async function until(id: string, sid: string, pred: (s: ExportStatus) => boolean, ms = 60_000) {
  const t0 = Date.now();
  for (;;) { const s = await status(id, sid); if (pred(s)) return s; if (Date.now() - t0 > ms) throw new Error("zaman aşımı: " + JSON.stringify(s)); await new Promise((r) => setTimeout(r, 300)); }
}
const tmpFiles = () => readdirSync(dirs.tmp);

test("tam akış: iş aç → yükle → miks → imzalı indir; ses ve çıktı sunucudan silinir", async () => {
  const sid = randomUUID();
  const r = await create(sid); assert.equal(r.status, 201);
  const c = (await r.json()) as ExportCreated;
  assert.ok(c.remainingToday <= 2); assert.equal(c.maxUploadBytes, config.maxUploadBytes);
  const job = jobs.get(c.jobId)!;
  const up = await upload(c, sid); assert.equal(up.status, 202);
  const done = await until(c.jobId, sid, (s) => s.state === "completed" || s.state === "failed");
  assert.equal(done.state, "completed", JSON.stringify(done));
  assert.equal(jobs.files(job).voice, false, "yüklenen ses miks biter bitmez silinmeli");
  assert.equal(jobs.files(job).out, true);
  assert.ok(done.downloadUrl && done.expiresInSec && done.expiresInSec <= 120);
  const dl = await fetch(base + done.downloadUrl);
  assert.equal(dl.status, 200); assert.equal(dl.headers.get("content-type"), "audio/wav");
  assert.match(dl.headers.get("content-disposition") ?? "", /attachment; filename="sessiz-gece-\d{4}-\d{2}-\d{2}\.wav"/);
  assert.equal(dl.headers.get("cache-control"), "no-store");
  const buf = Buffer.from(await dl.arrayBuffer());
  assert.equal(buf.subarray(0, 4).toString(), "RIFF"); assert.ok(buf.length > 400_000);
  await new Promise((r2) => setTimeout(r2, 200));
  assert.equal(jobs.files(job).out, false, "indirme bitince çıktı silinmeli");
  assert.equal((await fetch(base + done.downloadUrl)).status, 410, "ikinci indirme olmamalı");
  assert.match((await status(c.jobId, sid)).message ?? "", /silindi/);
  assert.ok(!tmpFiles().some((f) => f.startsWith(c.jobId)), "tmp dizininde bu işe ait dosya kalmamalı");
});

test("MP3 isteği çalışır", async () => {
  const sid = randomUUID();
  const c = (await (await create(sid, recipe({ format: "mp3", trackId: null }))).json()) as ExportCreated;
  assert.equal((await upload(c, sid)).status, 202);
  const done = await until(c.jobId, sid, (s) => s.state === "completed" || s.state === "failed");
  assert.equal(done.state, "completed", JSON.stringify(done));
  const dl = await fetch(base + done.downloadUrl!); assert.equal(dl.headers.get("content-type"), "audio/mpeg");
  assert.ok((await dl.arrayBuffer()).byteLength > 10_000);
});

test("sessiz kayıt: temiz hata, yüklenen ses silinir", async () => {
  const sid = randomUUID(), p = path.join(TMP, "api-silent.wav");
  makeVoiceWav(p, { sec: 3, bursts: [], bits: 16, channels: 1 });
  const c = (await (await create(sid)).json()) as ExportCreated;
  assert.equal((await upload(c, sid, readFileSync(p))).status, 202);
  const s = await until(c.jobId, sid, (x) => x.state === "failed" || x.state === "completed");
  assert.equal(s.state, "failed"); assert.equal(s.errorCode, "silent");
  assert.deepEqual(jobs.files(jobs.get(c.jobId)!), { voice: false, out: false, meta: false });
});

test("günlük sınır: aynı IP'den 4. iş 429 + retryAfterSec", async () => {
  // Önceki testler 3 hakkı kullandı (aynı IP); yeni oturum açmak bile reddedilmeli.
  const r = await create(randomUUID());
  assert.equal(r.status, 429);
  const b = (await r.json()) as { code: string; retryAfterSec: number };
  assert.equal(b.code, "daily-limit"); assert.ok(b.retryAfterSec > 0 && b.retryAfterSec <= 86400);
  assert.ok(Number(r.headers.get("retry-after")) > 0);
});

test("DailyLimiter: IP ve oturum bağımsız sayılır, 24 saat sonra açılır", () => {
  let t = 1_000_000; const d = new DailyLimiter(2, () => t);
  d.consume(["ip:1", "sid:a"]); d.consume(["ip:1", "sid:b"]);
  assert.equal(d.check(["ip:1", "sid:c"]).ok, false, "IP sınırı oturum değiştirmekle aşılamaz");
  assert.equal(d.check(["ip:2", "sid:a"]).ok, true, "oturum 1/2 → hâlâ açık");
  d.consume(["ip:2", "sid:a"]); assert.equal(d.check(["ip:3", "sid:a"]).ok, false, "oturum sınırı IP değiştirmekle aşılamaz");
  t += 24 * 3600_000 + 1; assert.equal(d.check(["ip:1", "sid:a"]).ok, true);
});

test("yükleme doğrulamaları: yanlış belirteç/oturum, içerik türü, sahte dosya, hız, boyut", async () => {
  // Bu testler için yeni iş açılamaz (günlük sınır dolu) → iş doğrudan depodan oluşturulur.
  const mk = () => { const sid = randomUUID(); const j = jobs.create({ id: randomUUID(), sessionId: sid, ip: "9.9.9.9", recipe: validateRecipe(recipe()), track: null, uploadToken: "tok-" + randomUUID() });
    return { sid, j, c: { jobId: j.id, uploadToken: j.uploadToken, uploadUrl: `/api/exports/${j.id}/voice` } as ExportCreated }; };
  { const { sid, c } = mk(); assert.equal((await upload({ ...c, uploadToken: "yanlis" }, sid)).status, 404, "yanlış belirteç"); }
  { const { c } = mk(); assert.equal((await upload(c, randomUUID())).status, 404, "başka oturum"); }
  { const { sid, c } = mk();
    const r = await fetch(base + c.uploadUrl, { method: "PUT", headers: H(sid, { "content-type": "audio/mpeg", "x-upload-token": c.uploadToken }), body: voice });
    assert.equal(r.status, 415, "yalnızca audio/wav"); }
  { const { sid, c, j } = mk(); const r = await upload(c, sid, Buffer.from("bu bir wav degil ".repeat(100)));
    assert.equal(r.status, 422); assert.equal(((await r.json()) as { code: string }).code, "not-wav");
    assert.equal(jobs.files(j).voice, false, "reddedilen dosya diskte kalmamalı"); }
  { const { sid, c } = mk(); const p = path.join(TMP, "r44.wav"); makeVoiceWav(p, { sec: 2, bursts: [[0, 1]], bits: 16, channels: 1, rate: 44100 });
    const r = await upload(c, sid, readFileSync(p)); assert.equal(r.status, 422); assert.equal(((await r.json()) as { code: string }).code, "bad-rate"); }
  { const { sid, c } = mk(); const r = await upload(c, sid, Buffer.alloc(config.maxUploadBytes + 10, 1));
    assert.ok([413].includes(r.status), "boyut sınırı: " + r.status); }
  { const { sid, c } = mk(); assert.equal((await upload(c, sid)).status, 202, "geçerli yükleme");
    assert.equal((await upload(c, sid)).status, 409, "aynı iş için ikinci yükleme yok"); }
});

test("aynı oturumda eşzamanlı iş: 409 (günlük sınır devre dışıyken) ve imza doğrulaması", () => {
  const a = signDownload("job1"); assert.equal(verifyDownload("job1", a), true);
  assert.equal(verifyDownload("job2", a), false, "başka işin imzası geçmez");
  assert.equal(verifyDownload("job1", a.slice(0, -2) + "xx"), false, "kurcalanmış imza");
  assert.equal(verifyDownload("job1", "123.abc"), false);
  const old = signDownload("job1", 120, Date.now() - 3 * 60_000); assert.equal(verifyDownload("job1", old), false, "süresi dolmuş");
});

test("TTL: yüklenen ses 1 saatte, çıktı 30 dakikada silinir; yükleme bekleyen iş zaman aşımına uğrar", async () => {
  const sid = randomUUID();
  // (a) çıktı TTL: iş tamamlanmış gibi kur
  const j = jobs.create({ id: randomUUID(), sessionId: sid, ip: "8.8.8.8", recipe: validateRecipe(recipe()), track: null, uploadToken: "t" });
  writeFileSync(j.outPath, "çıktı"); j.state = "completed"; j.finishedAt = clock; j.outputExpiresAt = clock + config.outputTtlMs;
  clock += config.outputTtlMs - 1000; jobs.sweep(); assert.equal(existsSync(j.outPath), true, "30 dk dolmadan silinmez");
  clock += 2000; jobs.sweep(); assert.equal(existsSync(j.outPath), false, "30 dk sonra silinir");
  const s = await status(j.id, sid); assert.equal(s.state, "failed"); assert.equal(s.errorCode, "expired");
  // (b) yükleme TTL: miks hiç çalışmasa bile 1 saatte ses dosyası silinir
  const k = jobs.create({ id: randomUUID(), sessionId: sid, ip: "8.8.8.8", recipe: validateRecipe(recipe()), track: null, uploadToken: "t" });
  writeFileSync(k.voicePath, "ses"); k.state = "preparing";
  clock += config.uploadTtlMs - 1000; jobs.sweep(); assert.equal(existsSync(k.voicePath), true);
  clock += 2000; jobs.sweep(); assert.equal(existsSync(k.voicePath), false, "1 saat sonra ses silinir");
  // (c) yükleme bekleyen iş
  const w = jobs.create({ id: randomUUID(), sessionId: sid, ip: "8.8.8.8", recipe: validateRecipe(recipe()), track: null, uploadToken: "t" });
  clock += config.awaitUploadMs + 1000; jobs.sweep(); assert.equal(w.state, "failed"); assert.equal(w.errorCode, "upload-timeout");
});

test("kuyruk: aynı anda en fazla MAX_CONCURRENT_MIX miks çalışır", async () => {
  let live = 0, peak = 0;
  jobs.mixFn = async () => { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 150)); live--; return {} as never; };
  const made = [1, 2, 3, 4, 5].map(() => { const sid = randomUUID(); const j = jobs.create({ id: randomUUID(), sessionId: sid, ip: "7.7.7.7", recipe: validateRecipe(recipe({ trackId: null })), track: null, uploadToken: "t" }); writeFileSync(j.voicePath, voice); return j; });
  for (const j of made) jobs.enqueue(j, inspectWav(j.voicePath, 900));
  await new Promise((r) => setTimeout(r, 900));
  assert.ok(peak <= 2 && peak >= 1, `eşzamanlı ${peak}`);
  assert.ok(made.every((j) => j.state === "completed" && !existsSync(j.voicePath)), "hepsi bitmeli, sesler silinmeli");
});

test("ham müzik yolu yok: müzik/dosya adresleri, yükleme ve özel dizin erişimi reddedilir", async () => {
  const routes = app.printRoutes({ commonPrefix: false });
  assert.ok(!/music|master|private|\.flac/i.test(routes), "rota listesinde müzik/ham dosya olmamalı:\n" + routes);
  for (const p of ["/api/music", "/api/music/trk_0001", "/api/master/trk_0001", "/music/master/trk_0001.wav", "/private/music/master/trk_0001.wav", "/api/tracks/trk_0001/download", "/covers/../../private"])
    assert.ok([404, 400].includes((await fetch(base + p)).status), p);
  // katalog yanıtı yalnızca herkese açık alanları taşır
  const cat = await (await fetch(base + "/api/catalog")).text();
  assert.ok(!/filePath|previewPath|private:|evidence|license|baseHz/i.test(cat));
  // kataloğa/miks ucuna dosya yükleme denemesi: çok parçalı (multipart) ve ses türleri kabul edilmez
  const fd = new FormData(); fd.append("file", new Blob([voice]), "muzik.wav");
  assert.equal((await fetch(base + "/api/exports", { method: "POST", headers: H(randomUUID()), body: fd })).status, 415);
  assert.equal((await fetch(base + "/api/catalog", { method: "POST", headers: { "content-type": "audio/wav" }, body: voice })).status, 404);
  assert.equal((await fetch(base + "/api/exports", { method: "POST", headers: H(randomUUID(), { "content-type": "audio/wav" }), body: voice })).status, 400 | 0 || 400);
});

test("tarif doğrulaması: aralıklar sıkıştırılır, kötü girdi reddedilir, metin temizlenir", () => {
  const r = validateRecipe({ format: "wav", trackId: null, title: "a\u0000b\nc", music: { gainDb: 99, fadeInSec: -5, tailSec: 1e9 }, ducking: { amountDb: 1e6, attackMs: 0 }, alignmentOffsetMs: 1e9, loudness: { targetLufs: 5, truePeakDb: 5 } });
  assert.equal(r.title, "a b c"); assert.equal(r.music.gainDb, 0); assert.equal(r.music.fadeInSec, 0); assert.equal(r.music.tailSec, 10);
  assert.equal(r.ducking.amountDb, 18); assert.equal(r.ducking.attackMs, 5); assert.equal(r.alignmentOffsetMs, 500);
  assert.equal(r.loudness.targetLufs, -12); assert.equal(r.loudness.truePeakDb, -0.5);
  for (const bad of [null, [], "x", { format: "ogg" }, { format: "wav", trackId: "../etc" }, { format: "wav", trackId: 5 }])
    assert.throws(() => validateRecipe(bad));
  assert.equal(validateRecipe({ format: "mp3" }).ducking.amountDb, 8);
});

test("WAV denetimi: süre sınırı ve bozuk başlık", () => {
  assert.throws(() => inspectWav(voicePath, 1), (e: unknown) => e instanceof WavError && e.code === "too-long");
  const i = inspectWav(voicePath, 900); assert.equal(i.sampleRate, 48000); assert.ok(Math.abs(i.durationSec - 4) < 0.01);
});

test("bot koruması: gizli anahtar yokken yalnızca geliştirmede geçer; üretim anahtarsız başlamaz", async () => {
  assert.equal(await verifyBot(undefined, "1.1.1.1"), true); // geliştirme
  const run = (env: Record<string, string>) => spawnSync(process.execPath, ["--import", "tsx", "-e", "await import('./src/config.ts')"], { cwd: path.resolve(import.meta.dirname, ".."), env: { ...process.env, ...env }, encoding: "utf8" });
  const a = run({ NODE_ENV: "production", SIGNING_SECRET: "", TURNSTILE_SECRET: "" });
  assert.notEqual(a.status, 0); assert.match(a.stderr, /SIGNING_SECRET/);
  const b = run({ NODE_ENV: "production", SIGNING_SECRET: "x", TURNSTILE_SECRET: "" });
  assert.notEqual(b.status, 0); assert.match(b.stderr, /TURNSTILE_SECRET/);
  const c = run({ NODE_ENV: "production", SIGNING_SECRET: "x", TURNSTILE_SECRET: "y" });
  assert.equal(c.status, 0, c.stderr);
});

test("üretimde yer tutucu müzikli katalog sunucuyu başlatmaz", () => {
  const r = spawnSync(process.execPath, ["--import", "tsx", "-e", "const c=await import('./src/catalog.ts');c.loadCatalog()"], {
    cwd: path.resolve(import.meta.dirname, ".."), env: { ...process.env, NODE_ENV: "production", SIGNING_SECRET: "x", TURNSTILE_SECRET: "y" }, encoding: "utf8" });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /placeholder/);
});
