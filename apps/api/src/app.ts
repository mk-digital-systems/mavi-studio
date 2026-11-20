import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, unlinkSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform, type Readable } from "node:stream";
import Fastify from "fastify";
import type { ApiError, ExportCreated, ExportStatus } from "@siir/contracts";
import { loadCatalog, toPublic } from "./catalog.js";
import { config } from "./config.js";
import { JobStore } from "./jobs.js";
import { DailyLimiter, MinuteLimiter } from "./limits.js";
import { createSession, syntheticPreviewWav, useSession } from "./preview.js";
import { RecipeError, validateRecipe } from "./recipe.js";
import { isSessionId, newToken, safeEqual, signAudioRef, signDownload, verifyBot, verifyDownload } from "./security.js";
import { inspectWav, WavError } from "./wavinfo.js";

const err = (code: string, error: string, extra: Partial<ApiError> = {}): ApiError => ({ code, error, ...extra });
const tr: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
const slug = (s: string) => s.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) => tr[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "siir";

export type AppOptions = { jobs?: JobStore; logger?: boolean; perMinute?: number };

export function buildApp(opts: AppOptions = {}) {
  const tracks = loadCatalog();
  const jobs = opts.jobs ?? new JobStore();
  const daily = new DailyLimiter(config.maxExportsPerDay);
  const minute = new MinuteLimiter(opts.perMinute ?? 240);
  const app = Fastify({ logger: opts.logger ? { level: "warn" } : false, bodyLimit: 4096 }); // varsayılan gövde sınırı küçük: ses/müzik kabul edilmez

  // Ses yükleme için yalnızca TEK bir içerik türü akış olarak okunur (aşağıdaki PUT ucu). Başka hiçbir uç nokta dosya kabul etmez.
  app.addContentTypeParser("audio/wav", (_req, payload, done) => done(null, payload));

  const sweepTimer = setInterval(() => { daily.sweep(); minute.sweep(); }, 60_000); sweepTimer.unref();
  app.addHook("onClose", async () => { clearInterval(sweepTimer); jobs.stop(); });

  app.addHook("onRequest", async (req, reply) => {
    if (!minute.hit(req.ip)) return reply.code(429).header("retry-after", "60").send(err("rate-limit", "Çok fazla istek. Lütfen biraz bekleyin.", { retryAfterSec: 60 }));
  });

  // ---------- Katalog ve korumalı ön izleme (Aşama 1) ----------
  app.get("/api/catalog", async () => tracks.filter((t) => t.active).map(toPublic));

  app.post<{ Body: { trackId?: string } }>("/api/preview-session", async (req, reply) => {
    const t = tracks.find((x) => x.active && x.id === req.body?.trackId);
    if (!t) return reply.code(404).send(err("not-found", "Parça bulunamadı."));
    const { token, expiresInSec } = createSession(t.id, t.baseHz);
    return { url: `/api/preview/${token}`, expiresInSec };
  });

  app.get<{ Params: { token: string } }>("/api/preview/:token", async (req, reply) => {
    const s = useSession(req.params.token);
    if (!s) return reply.code(410).send(err("expired", "Ön izleme oturumu geçersiz veya süresi doldu."));
    return reply.header("content-type", "audio/wav").header("cache-control", "private, no-store").header("content-disposition", "inline").send(syntheticPreviewWav(s.hz));
  });

  // ---------- Dışa aktarma ----------
  const sid = (h: unknown) => (isSessionId(h) ? h.toLowerCase() : null);

  /** 1) İş aç: tarif doğrulanır, bot ve kullanım sınırı denetlenir. Ses henüz gönderilmedi. */
  app.post<{ Body: { recipe?: unknown } }>("/api/exports", async (req, reply) => {
    const session = sid(req.headers["x-siir-session"]);
    if (!session) return reply.code(400).send(err("no-session", "Oturum kimliği eksik."));
    let recipe;
    try { recipe = validateRecipe(req.body?.recipe); } catch (e) {
      return reply.code(400).send(err("bad-recipe", e instanceof RecipeError ? e.message : "Tarif geçersiz."));
    }
    let track = null;
    if (recipe.trackId) {
      track = tracks.find((t) => t.active && t.id === recipe.trackId) ?? null;
      if (!track) return reply.code(400).send(err("bad-track", "Fon müziği bulunamadı veya artık kullanılamıyor."));
    }
    if (!(await verifyBot(req.headers["x-turnstile-token"] as string | undefined, req.ip)))
      return reply.code(403).send(err("bot-check", "Doğrulama başarısız. Sayfayı yenileyip tekrar dene."));

    const keys = [`ip:${req.ip}`, `sid:${session}`];
    const lim = daily.check(keys);
    if (!lim.ok) return reply.code(429).header("retry-after", String(lim.retryAfterSec))
      .send(err("daily-limit", `Günlük dışa aktarma sınırına (${config.maxExportsPerDay}) ulaştın.`, { retryAfterSec: lim.retryAfterSec }));
    const active = jobs.activeFor(session, req.ip);
    if (active.session || active.ip >= 3) return reply.code(409).send(err("busy", "Devam eden bir dışa aktarman var. Bitmesini bekle."));

    const job = jobs.create({ id: randomUUID(), sessionId: session, ip: req.ip, recipe, track, uploadToken: newToken() });
    daily.consume(keys);
    const body: ExportCreated = {
      jobId: job.id, uploadToken: job.uploadToken, uploadUrl: `/api/exports/${job.id}/voice`,
      maxUploadBytes: config.maxUploadBytes, remainingToday: lim.remaining - 1, expiresInSec: config.awaitUploadMs / 1000,
    };
    return reply.code(201).send(body);
  });

  /** 2) İşlenmiş şiir sesini yükle (yalnızca WAV, tek seferlik, sınırlı boyut/süre). */
  app.put<{ Params: { id: string } }>("/api/exports/:id/voice", { bodyLimit: config.maxUploadBytes }, async (req, reply) => {
    const job = jobs.get(req.params.id), session = sid(req.headers["x-siir-session"]);
    const tok = req.headers["x-upload-token"];
    if (!job || !session || job.sessionId !== session || typeof tok !== "string" || !safeEqual(tok, job.uploadToken))
      return reply.code(404).send(err("not-found", "İş bulunamadı."));
    if (job.state !== "awaiting-upload" || job.uploading) return reply.code(409).send(err("bad-state", "Bu iş için ses zaten gönderildi."));
    const declared = Number(req.headers["content-length"]);
    if (!Number.isFinite(declared) || declared <= 0) return reply.code(411).send(err("length-required", "İçerik uzunluğu gerekli."));
    if (declared > config.maxUploadBytes) return reply.code(413).send(err("too-large", "Dosya çok büyük."));

    job.uploading = true;
    let bytes = 0;
    const guard = new Transform({
      transform(chunk, _e, cb) { bytes += chunk.length; bytes > declared || bytes > config.maxUploadBytes ? cb(new Error("size")) : cb(null, chunk); },
    });
    const drop = () => { try { unlinkSync(job.voicePath); } catch { /* yok */ } };
    try {
      await pipeline(req.body as Readable, guard, createWriteStream(job.voicePath, { flags: "wx" }));
    } catch {
      drop(); job.uploading = false;
      return reply.code(413).send(err("upload-failed", "Yükleme başarısız veya sınırı aştı."));
    }
    try {
      const info = inspectWav(job.voicePath, config.maxRecordingSec + config.maxTailSec);
      jobs.enqueue(job, info);
    } catch (e) {
      drop(); job.uploading = false;
      const w = e instanceof WavError ? e : null;
      jobs.fail(job, w?.code ?? "bad-wav", w?.message ?? "Ses dosyası doğrulanamadı.");
      return reply.code(422).send(err(w?.code ?? "bad-wav", w?.message ?? "Ses dosyası doğrulanamadı."));
    }
    return reply.code(202).send({ jobId: job.id, state: job.state });
  });

  /** 3) Durum sorgula. Tamamlandıysa kısa ömürlü imzalı indirme adresi verilir. */
  app.get<{ Params: { id: string } }>("/api/exports/:id", async (req, reply) => {
    const job = jobs.get(req.params.id), session = sid(req.headers["x-siir-session"]);
    if (!job || !session || job.sessionId !== session) return reply.code(404).send(err("not-found", "İş bulunamadı."));
    const s: ExportStatus = { jobId: job.id, state: job.state };
    if (job.state === "failed") { s.errorCode = job.errorCode; s.message = job.message; }
    if (job.state === "completed") {
      const alive = !job.expired && existsSync(job.outPath);
      if (job.downloaded && !job.recipe.forVideo) s.message = "Dosya indirildi ve sunucudan silindi.";
      else if (!alive) { s.state = "failed"; s.errorCode = "expired"; s.message = "Dosyanın süresi doldu ve sunucudan silindi. Yeniden dışa aktar."; }
      else {
        if (!job.downloaded) { s.downloadUrl = `/api/exports/${job.id}/download?t=${signDownload(job.id)}`; s.expiresInSec = config.downloadTokenTtlSec; }
        else s.message = "Dosya indirildi. Video için kısa süre sunucuda tutuluyor.";
        if (job.recipe.forVideo && job.audioInfo && job.outputExpiresAt) {
          const left = Math.max(1, Math.floor((job.outputExpiresAt - Date.now()) / 1000));
          s.audioRef = signAudioRef(job.id, left); s.audioInfo = job.audioInfo;
        }
      }
    }
    return reply.header("cache-control", "no-store").send(s);
  });

  /** 4) İndir: imza + süre denetlenir; tamamlanınca dosya sunucudan silinir. */
  app.get<{ Params: { id: string }; Querystring: { t?: string } }>("/api/exports/:id/download", async (req, reply) => {
    const job = jobs.get(req.params.id);
    if (!job || typeof req.query.t !== "string" || !verifyDownload(job.id, req.query.t))
      return reply.code(403).send(err("forbidden", "İndirme adresi geçersiz veya süresi doldu."));
    if (job.state !== "completed" || job.downloaded || job.expired || !existsSync(job.outPath))
      return reply.code(410).send(err("gone", "Dosya artık mevcut değil."));
    const ext = job.recipe.format, name = `${slug(job.recipe.title)}-${new Date().toISOString().slice(0, 10)}.${ext}`;
    const stream = createReadStream(job.outPath);
    reply.raw.on("finish", () => jobs.markDownloaded(job));
    return reply
      .header("content-type", ext === "wav" ? "audio/wav" : "audio/mpeg")
      .header("content-disposition", `attachment; filename="${name}"`)
      .header("cache-control", "no-store").header("x-content-type-options", "nosniff")
      .send(stream);
  });

  return { app, jobs };
}
