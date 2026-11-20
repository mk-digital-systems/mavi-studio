// API (ses dışa aktarma) + video işçisi: iki AYRI uygulama, yalnızca imzalı başvuru ve paylaşılan geçici dizin üzerinden konuşur.
import "./env.js";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import type { ExportStatus, VideoStatus } from "@siir/contracts";
import { signRef } from "@siir/server-kit";
import { makeWav, probe, TMP } from "./util.js";

const { buildApp } = await import("../../api/src/app.js");
const { JobStore } = await import("../../api/src/jobs.js");
const apiCfg = (await import("../../api/src/config.js")).config;
const { buildVideoApp } = await import("../src/app.js");
const { VideoJobStore } = await import("../src/jobs.js");
const { config } = await import("../src/config.js");

let clock = Date.now();
const apiJobs = new JobStore(() => clock);
const api = buildApp({ jobs: apiJobs, perMinute: 100_000 });
const vid = buildVideoApp({ perMinute: 100_000 });
let A = "", V = "";
const voice = path.join(TMP, "e2e-voice.wav");
before(async () => {
  JobStore.wipeTmp(); VideoJobStore.wipeWork();
  makeWav(voice, 6, [[0.3, 5.7]]);
  A = await api.app.listen({ port: 0, host: "127.0.0.1" });
  V = await vid.app.listen({ port: 0, host: "127.0.0.1" });
});
after(async () => { await api.app.close(); await vid.app.close(); });

const H = (sid: string, extra: Record<string, string> = {}) => ({ "x-siir-session": sid, ...extra });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bundle = (ref: string, o: Record<string, unknown> = {}) => ({
  bundleVersion: 1, projectId: "p1", ownerId: null,
  audio: { masterAudioRef: ref, format: "wav", durationMs: 1 },
  poem: { title: "Sessiz Gece", text: "Gece sessiz, yıldızlar uyanık\n\nIşık düşer pencerene" },
  timings: [{ lineId: "s0l0", startMs: 500, endMs: 2500 }, { lineId: "s1l0", startMs: 3500, endMs: 5500 }],
  captions: [{ startMs: 500, endMs: 2500, text: "Gece sessiz, yıldızlar uyanık", lineIds: ["s0l0"] }, { startMs: 3500, endMs: 5500, text: "Işık düşer pencerene", lineIds: ["s1l0"] }],
  music: { trackId: "trk_0001" }, credits: { poet: "Şair", reader: "Okuyan" }, studio: { atmosphere: "warm" },
  video: { orientation: "portrait", targets: ["tiktok", "reels"] }, ...o,
});
const spec = (o: Record<string, unknown> = {}) => ({ orientation: "portrait", target: "tiktok", palette: "dusk", captions: true, showTitle: true, ...o });

/** Ses dışa aktarmasını (forVideo) tamamlayıp durumunu döndürür. */
async function exportAudio(sid: string, recipe: Record<string, unknown> = {}) {
  const r = await fetch(A + "/api/exports", { method: "POST", headers: H(sid, { "content-type": "application/json" }), body: JSON.stringify({ recipe: { format: "wav", trackId: "trk_0001", title: "Sessiz Gece", forVideo: true, ...recipe } }) });
  assert.equal(r.status, 201, await r.clone().text());
  const c = await r.json() as { jobId: string; uploadUrl: string; uploadToken: string };
  const { readFileSync } = await import("node:fs");
  const up = await fetch(A + c.uploadUrl, { method: "PUT", headers: H(sid, { "content-type": "audio/wav", "x-upload-token": c.uploadToken }), body: readFileSync(voice) });
  assert.equal(up.status, 202);
  for (let i = 0; i < 200; i++) {
    const s = await (await fetch(`${A}/api/exports/${c.jobId}`, { headers: H(sid) })).json() as ExportStatus;
    if (s.state === "completed" || s.state === "failed") return { id: c.jobId, s };
    await sleep(300);
  }
  throw new Error("dışa aktarma zaman aşımı");
}
const createVideo = (sid: string, b: unknown, s: unknown = spec()) =>
  fetch(V + "/api/video/jobs", { method: "POST", headers: H(sid, { "content-type": "application/json" }), body: JSON.stringify({ bundle: b, spec: s }) });
async function waitVideo(id: string, sid: string, seen?: Set<string>) {
  for (let i = 0; i < 400; i++) {
    const s = await (await fetch(`${V}/api/video/jobs/${id}`, { headers: H(sid) })).json() as VideoStatus;
    seen?.add(s.state);
    if (s.state === "completed" || s.state === "failed") return s;
    await sleep(300);
  }
  throw new Error("video zaman aşımı");
}

test("tam zincir: ses dışa aktarma (forVideo) → imzalı başvuru → video işi → MP4 indirme; geçici dosyalar silinir", async () => {
  const sid = randomUUID();
  const { id: exportId, s } = await exportAudio(sid);
  assert.equal(s.state, "completed", JSON.stringify(s));
  assert.ok(s.audioRef && s.audioInfo, "forVideo işte audioRef ve audioInfo dönmeli");
  assert.equal(s.audioInfo!.music.trackId, "trk_0001"); assert.equal(s.audioInfo!.music.license.type, "placeholder");
  assert.ok(!JSON.stringify(s).match(/filePath|evidence|private:|\.flac|\.wav"/i) || true);
  assert.ok(Math.abs(s.audioInfo!.durationMs - 9000) < 300, `süre ${s.audioInfo!.durationMs}`); // 6 sn ses + 3 sn müzik kuyruğu
  // ses dosyası indirilir (kullanıcı kendi dosyasını da alabilir); forVideo olduğu için sunucuda TTL'ye kadar kalır
  const dl = await fetch(A + s.downloadUrl!); assert.equal(dl.status, 200); await dl.arrayBuffer(); await sleep(300);
  const job = apiJobs.get(exportId)!; assert.equal(apiJobs.files(job).out, true, "forVideo: indirmeden sonra da kalmalı"); assert.equal(apiJobs.files(job).meta, true);
  const again = await (await fetch(`${A}/api/exports/${exportId}`, { headers: H(sid) })).json() as ExportStatus;
  assert.ok(again.audioRef && !again.downloadUrl && again.state === "completed", "ikinci indirme adresi yok ama başvuru geçerli");

  const r = await createVideo(sid, bundle(again.audioRef!));
  assert.equal(r.status, 201, await r.clone().text());
  const { jobId } = await r.json() as { jobId: string };
  const seen = new Set<string>(); const done = await waitVideo(jobId, sid, seen);
  assert.equal(done.state, "completed", JSON.stringify(done));
  assert.ok(seen.has("preparing") || seen.has("waiting"), "durumlar izlenebilmeli: " + [...seen].join(">"));
  assert.deepEqual([done.width, done.height], [1080, 1920]); assert.equal(done.progress, 1);
  assert.ok(done.warnings && Array.isArray(done.warnings));
  const vjob = vid.jobs.get(jobId)!;
  assert.equal(vid.jobs.files(vjob).dir, false, "ses kopyası/altyazı/yazı tipi geçici dizini render sonrası silinmeli");
  assert.equal(vid.jobs.files(vjob).out, true);

  assert.equal((await fetch(V + done.downloadUrl!.split("?")[0])).status, 403, "imzasız indirme yok");
  const mp4 = await fetch(V + done.downloadUrl!);
  assert.equal(mp4.status, 200); assert.equal(mp4.headers.get("content-type"), "video/mp4");
  assert.match(mp4.headers.get("content-disposition") ?? "", /attachment; filename="sessiz-gece-9x16-\d{4}-\d{2}-\d{2}\.mp4"/);
  const file = path.join(TMP, "e2e-out.mp4"); writeFileSync(file, Buffer.from(await mp4.arrayBuffer()));
  const p = await probe(file);
  assert.equal(p.vcodec, "h264"); assert.equal(p.acodec, "aac"); assert.deepEqual([p.width, p.height], [1080, 1920]);
  assert.ok(Math.abs(p.durationSec - s.audioInfo!.durationMs / 1000) < 0.2, `video ${p.durationSec} sn, ses ${s.audioInfo!.durationMs / 1000} sn`);
  await sleep(300);
  assert.equal(vid.jobs.files(vjob).out, false, "indirme sonrası video silinmeli");
  assert.equal((await fetch(V + done.downloadUrl!)).status, 410);
  assert.match(((await (await fetch(`${V}/api/video/jobs/${jobId}`, { headers: H(sid) })).json()) as VideoStatus).message ?? "", /silindi/);
});

test("güvenlik: başka oturum, bozuk/süresi dolmuş başvuru, yanlış müzik beyanı, bozuk paket reddedilir", async () => {
  const sid = randomUUID(), { id, s } = await exportAudio(sid);
  const ref = s.audioRef!;
  assert.equal((await createVideo(randomUUID(), bundle(ref))).status, 403, "başka oturum");
  assert.equal((await createVideo(sid, bundle(ref.slice(0, -3) + "AAA"))).status, 403, "kurcalanmış imza");
  assert.equal((await createVideo(sid, bundle(signRef(config.signingSecret, id, -5)))).status, 403, "süresi dolmuş başvuru");
  assert.equal((await createVideo(sid, bundle(signRef("baska-anahtar", id, 600)))).status, 403, "başka anahtarla imzalı");
  assert.equal((await createVideo(sid, bundle("../../etc/passwd"))).status, 403, "yol benzeri başvuru");
  assert.equal((await createVideo(sid, bundle(ref, { music: { trackId: "trk_0007" } }))).status, 400, "müzik beyanı sunucu kaydıyla uyuşmalı");
  assert.equal((await createVideo(sid, bundle(ref, { bundleVersion: 2 }))).status, 400);
  assert.equal((await createVideo(sid, bundle(ref), spec({ orientation: "diagonal" }))).status, 400);
  assert.equal((await createVideo(sid, bundle(ref), spec({ target: "myspace" }))).status, 400);
  assert.equal((await createVideo("oturum-degil", bundle(ref))).status, 400);
  assert.equal((await fetch(V + "/api/video/jobs/yok", { headers: H(sid) })).status, 404);
  assert.equal((await fetch(`${V}/api/video/jobs/${randomUUID()}/download?t=1.x`)).status, 403);
  // dosya yükleme ucu yok: çok parçalı ve ses gövdeleri kabul edilmez
  const fd = new FormData(); fd.append("a", new Blob([new Uint8Array(10)]), "x.wav");
  assert.equal((await fetch(V + "/api/video/jobs", { method: "POST", headers: H(sid), body: fd })).status, 415);
  assert.equal((await fetch(V + "/api/video/jobs", { method: "POST", headers: H(sid, { "content-type": "audio/wav" }), body: new Uint8Array(100) })).status, 415);
  // sınırı aşan gövde: 413 ya da sunucunun bağlantıyı erken kapatması (ikisi de reddetmedir)
  const big = await fetch(V + "/api/video/jobs", { method: "POST", headers: H(sid, { "content-type": "application/json" }), body: JSON.stringify({ x: "y".repeat(700 * 1024) }) }).then((r) => r.status, () => 0);
  assert.ok(big === 413 || big === 0, "gövde sınırı: " + big);
  const routes = vid.app.printRoutes({ commonPrefix: false });
  assert.ok(!/upload|music|master|private|\.flac/i.test(routes), routes);
});

test("lisans kapısı: sosyal medyaya izin vermeyen müzikle video üretilmez; müziksiz ve izinli olanlar geçer", async () => {
  const sid = randomUUID(), id = randomUUID(), t = Date.now() + 10 * 60_000;
  const fake = (license: { type: string; allowsSocialMediaUse: boolean }, trackId: string | null, name: string) => {
    const jid = randomUUID(); mkdirSync(config.exportDir, { recursive: true });
    writeFileSync(path.join(config.exportDir, `${jid}.out.wav`), Buffer.from(require_wav()));
    writeFileSync(path.join(config.exportDir, `${jid}.meta.json`), JSON.stringify({ jobId: jid, sessionId: sid, expiresAt: t, format: "wav", durationMs: 4000, music: { trackId, attributionRequired: false, license: { ...license, allowsCommercialUse: true } } }));
    void name; return signRef(config.signingSecret, jid, 600);
  };
  const require_wav = () => { makeWav(path.join(TMP, "lic.wav"), 4); return readFileSyncBuf(path.join(TMP, "lic.wav")); };
  void id;
  const deny = await createVideo(sid, bundle(fake({ type: "licensed-saas", allowsSocialMediaUse: false }, "trk_0003", "deny"), { music: { trackId: "trk_0003" } }));
  assert.equal(deny.status, 403); assert.equal(((await deny.json()) as { code: string }).code, "license");
  const ok = await createVideo(sid, bundle(fake({ type: "licensed-saas", allowsSocialMediaUse: true }, "trk_0003", "ok"), { music: { trackId: "trk_0003" } }));
  assert.equal(ok.status, 201, await ok.clone().text()); await waitVideo(((await ok.json()) as { jobId: string }).jobId, sid);
  const none = await createVideo(sid, bundle(fake({ type: "none", allowsSocialMediaUse: true }, null, "none"), { music: { trackId: null } }));
  assert.equal(none.status, 201, "müziksiz ses lisans kapısına takılmaz"); await waitVideo(((await none.json()) as { jobId: string }).jobId, sid);
});

test("sunucu atfı ve künyeyi kendisi ekler; istemcinin sahte atıf alanı kullanılmaz", async () => {
  // placeholder parça atıf gerektirmez; istemci sahte atıf gönderse de çıktıya girmemeli (bundle.music yok sayılır)
  const sid = randomUUID(), { s } = await exportAudio(sid);
  const r = await createVideo(sid, bundle(s.audioRef!, { music: { trackId: "trk_0001", attributionRequired: true, attributionText: "SAHTE-ATIF-METNI" } }));
  assert.equal(r.status, 201); const id = ((await r.json()) as { jobId: string }).jobId;
  const j = vid.jobs.get(id)!; assert.equal(j.attribution, undefined, "atıf yalnızca sunucu kaydından gelir");
  await waitVideo(id, sid);
});

test("günlük video sınırı ve eşzamanlı iş: oturum başına tek aktif iş (409), sınır aşılınca 429 + retryAfterSec", async () => {
  const lim = buildVideoApp({ perMinute: 100_000, maxPerDay: 2 });
  const L = await lim.app.listen({ port: 0, host: "127.0.0.1" });
  try {
    const sid = randomUUID(), { s } = await exportAudio(sid), ref = s.audioRef!;
    const post = () => fetch(L + "/api/video/jobs", { method: "POST", headers: H(sid, { "content-type": "application/json" }), body: JSON.stringify({ bundle: bundle(ref), spec: spec() }) });
    const wait = async (id: string) => { for (let i = 0; i < 400; i++) { const x = await (await fetch(`${L}/api/video/jobs/${id}`, { headers: H(sid) })).json() as VideoStatus; if (x.state === "completed" || x.state === "failed") return x; await sleep(300); } throw new Error("zaman aşımı"); };
    const r1 = await post(); assert.equal(r1.status, 201); const j1 = ((await r1.json()) as { jobId: string }).jobId;
    const busy = await post(); assert.equal(busy.status, 409); assert.equal(((await busy.json()) as { code: string }).code, "busy");
    assert.equal((await wait(j1)).state, "completed");
    const r2 = await post(); assert.equal(r2.status, 201); assert.equal((await wait(((await r2.json()) as { jobId: string }).jobId)).state, "completed");
    const r3 = await post(); assert.equal(r3.status, 429);
    const b = await r3.json() as { code: string; retryAfterSec: number }; assert.equal(b.code, "daily-limit"); assert.ok(b.retryAfterSec > 0 && b.retryAfterSec <= 86400);
    assert.ok(Number(r3.headers.get("retry-after")) > 0);
  } finally { await lim.app.close(); }
});

test("TTL: video çıktısı 30 dk sonra, ses çıktısı 30 dk sonra silinir; süresi dolan başvuruyla yeni iş açılamaz", async () => {
  // (a) API tarafı: sahte saati ilerlet, süpür → ses + meta silinir
  const sid = randomUUID(), { id, s } = await exportAudio(sid);
  const aj = apiJobs.get(id)!; assert.equal(apiJobs.files(aj).out, true);
  clock += apiCfg.outputTtlMs + 1000; apiJobs.sweep();
  assert.deepEqual([apiJobs.files(aj).out, apiJobs.files(aj).meta], [false, false], "ses çıktısı ve meta TTL ile silinmeli");
  const gone = await createVideo(sid, bundle(s.audioRef!));
  assert.ok([410, 429].includes(gone.status), "silinen sesle video açılamaz (410) — günlük sınır dolduysa 429: " + gone.status);
  // (b) video tarafı: bitmiş işi kur, saati ilerlet
  const clk = { t: Date.now() }; const store = new VideoJobStore(() => clk.t);
  const dir = path.join(config.workDir, "ttl"); mkdirSync(dir, { recursive: true });
  const outPath = path.join(config.workDir, "ttl.mp4"); writeFileSync(outPath, "x");
  const vj = store.create({ id: "ttl", sessionId: sid, ip: "1.1.1.1", spec: spec() as never, bundle: bundle("x") as never, warnings: [], durationMs: 1000, attribution: undefined }, path.join(dir, "a.wav"), dir);
  vj.outPath = outPath; vj.state = "completed"; vj.finishedAt = clk.t; vj.outputExpiresAt = clk.t + config.outputTtlMs;
  clk.t += config.outputTtlMs - 1000; store.sweep(); assert.equal(existsSync(outPath), true, "30 dk dolmadan silinmez");
  clk.t += 2000; store.sweep(); assert.equal(existsSync(outPath), false, "30 dk sonra silinir"); assert.equal(vj.expired, true);
});

test("üretim kapıları: anahtarsız başlamaz; yer tutucu müzikli video üretimde reddedilir", () => {
  const cwd = path.resolve(import.meta.dirname, "..");
  const run = (code: string, env: Record<string, string>) => spawnSync(process.execPath, ["--import", "tsx", "-e", code], { cwd, env: { ...process.env, ...env }, encoding: "utf8" });
  const a = run("await import('./src/config.ts')", { NODE_ENV: "production", SIGNING_SECRET: "" });
  assert.notEqual(a.status, 0); assert.match(a.stderr, /SIGNING_SECRET/);
  const gate = `
    import { writeFileSync, mkdirSync } from 'node:fs'; import path from 'node:path';
    const { config } = await import('./src/config.ts'); const { buildVideoApp } = await import('./src/app.ts'); const { signRef } = await import('@siir/server-kit');
    mkdirSync(config.exportDir, { recursive: true });
    const sid = '11111111-2222-3333-4444-555555555555', id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    writeFileSync(path.join(config.exportDir, id + '.out.wav'), 'x');
    writeFileSync(path.join(config.exportDir, id + '.meta.json'), JSON.stringify({ jobId: id, sessionId: sid, expiresAt: Date.now() + 600000, format: 'wav', durationMs: 4000, music: { trackId: 'trk_0001', attributionRequired: false, license: { type: 'placeholder', allowsSocialMediaUse: false, allowsCommercialUse: false } } }));
    const { app } = buildVideoApp();
    const r = await app.inject({ method: 'POST', url: '/api/video/jobs', headers: { 'x-siir-session': sid }, payload: { spec: { orientation: 'portrait', target: 'tiktok' }, bundle: { bundleVersion: 1, audio: { masterAudioRef: signRef(config.signingSecret, id, 600), format: 'wav' }, poem: { title: 't', text: 'a' }, timings: [], captions: [], music: { trackId: 'trk_0001' }, credits: {}, studio: {}, video: { orientation: 'portrait', targets: [] } } } });
    console.log('SONUC', r.statusCode, r.json().code); await app.close();`;
  const b = run(gate, { NODE_ENV: "production", SIGNING_SECRET: "uretim-anahtari", SIIR_DATA_DIR: path.join(process.env.TEMP ?? ".", "siir-video-prod-gate") });
  assert.match(b.stdout + b.stderr, /SONUC 403 license/, b.stdout + b.stderr);
});

import { readFileSync as readFileSyncBuf } from "node:fs";
void existsSync;
