import { randomUUID } from "node:crypto";
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import type { ApiError, ExportAudioInfo, VideoCreated, VideoStatus } from "@siir/contracts";
import { DailyLimiter, MinuteLimiter, signToken, verifyRef, verifyToken } from "@siir/server-kit";
import { BundleError, validateBundle, validateSpec } from "./bundle.js";
import { config, production } from "./config.js";
import { VideoJobStore } from "./jobs.js";
import { TARGETS } from "./presets.js";

const err = (code: string, error: string, extra: Partial<ApiError> = {}): ApiError => ({ code, error, ...extra });
const isSession = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const tr: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
const slug = (s: string) => s.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) => tr[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "siir";
const RATIO = { portrait: "9x16", landscape: "16x9", square: "1x1" } as const;

type Manifest = ExportAudioInfo & { jobId: string; sessionId: string; expiresAt: number };
type Resolved = { id: string; audioPath: string; meta: Manifest };

/**
 * Ses başvurusunu çözer: imza + süre + oturum eşleşmesi. Dosya yolu YALNIZCA doğrulanmış kimlikten türetilir.
 * Başka oturumun veya süresi dolmuş/geçersiz başvuru aynı genel hatayı alır (varlık sızdırmaz).
 */
export function resolveAudio(ref: unknown, session: string, now = Date.now()): { ok: true; r: Resolved } | { ok: false; status: number; code: string; message: string } {
  const denied = { ok: false as const, status: 403, code: "bad-ref", message: "Ses başvurusu geçersiz." };
  if (typeof ref !== "string") return denied;
  const id = verifyRef(config.signingSecret, ref, now);
  if (!id) return denied;
  let meta: Manifest;
  try { meta = JSON.parse(readFileSync(path.join(config.exportDir, `${id}.meta.json`), "utf8")); } catch { return { ok: false, status: 410, code: "gone", message: "Ses dosyasının süresi doldu. Yeniden dışa aktar." }; }
  if (meta.sessionId !== session) return denied;
  if (meta.expiresAt <= now) return { ok: false, status: 410, code: "gone", message: "Ses dosyasının süresi doldu. Yeniden dışa aktar." };
  const audioPath = path.join(config.exportDir, `${id}.out.${meta.format}`);
  if (!existsSync(audioPath)) return { ok: false, status: 410, code: "gone", message: "Ses dosyasının süresi doldu. Yeniden dışa aktar." };
  return { ok: true, r: { id, audioPath, meta } };
}

export type VideoAppOptions = { jobs?: VideoJobStore; logger?: boolean; perMinute?: number; maxPerDay?: number };

export function buildVideoApp(opts: VideoAppOptions = {}) {
  const jobs = opts.jobs ?? new VideoJobStore();
  const maxPerDay = opts.maxPerDay ?? config.maxVideosPerDay;
  const daily = new DailyLimiter(maxPerDay);
  const minute = new MinuteLimiter(opts.perMinute ?? 240);
  const app = Fastify({ logger: opts.logger ? { level: "warn" } : false, bodyLimit: 600 * 1024 }); // yalnızca JSON (şiir + zamanlama); dosya kabul edilmez
  const sweep = setInterval(() => { daily.sweep(); minute.sweep(); }, 60_000); sweep.unref();
  app.addHook("onClose", async () => { clearInterval(sweep); jobs.stop(); });
  app.addHook("onRequest", async (req, reply) => {
    if (!minute.hit(req.ip)) return reply.code(429).header("retry-after", "60").send(err("rate-limit", "Çok fazla istek. Lütfen biraz bekleyin.", { retryAfterSec: 60 }));
  });

  /** Video işi aç: ExportBundle + VideoSpec alır. Ses, imzalı başvuruyla (yüklenmeden) çözülür. */
  app.post<{ Body: { bundle?: unknown; spec?: unknown } }>("/api/video/jobs", async (req, reply) => {
    const session = req.headers["x-siir-session"];
    if (!isSession(session)) return reply.code(400).send(err("no-session", "Oturum kimliği eksik."));
    const sid = session.toLowerCase();
    let spec;
    try { spec = validateSpec(req.body?.spec); } catch (e) { return reply.code(400).send(err("bad-spec", e instanceof BundleError ? e.message : "Video ayarı geçersiz.")); }
    const rawBundle = req.body?.bundle as { audio?: { masterAudioRef?: unknown } } | undefined;
    const res = resolveAudio(rawBundle?.audio?.masterAudioRef, sid);
    if (!res.ok) return reply.code(res.status).send(err(res.code, res.message));
    const { id: exportId, audioPath, meta } = res.r;

    let bundle;
    try { bundle = validateBundle(req.body?.bundle, meta.durationMs); } catch (e) { return reply.code(400).send(err("bad-bundle", e instanceof BundleError ? e.message : "Paket geçersiz.")); }
    // Tutarlılık: istemcinin beyan ettiği fon, sunucunun kaydıyla aynı olmalı (müzik/lisans bilgisi sunucudan alınır).
    if (bundle.music.trackId !== meta.music.trackId) return reply.code(400).send(err("bundle-mismatch", "Paket, dışa aktarılan sesle uyuşmuyor."));
    // Lisans kapısı: sosyal medya kullanımına izin vermeyen müzikle video üretilmez. Yer tutucu yalnızca geliştirmede.
    const lic = meta.music.license;
    if (meta.music.trackId && lic.type === "placeholder" && production) return reply.code(403).send(err("license", "Bu fon müziği video için kullanılamaz."));
    if (meta.music.trackId && lic.type !== "placeholder" && !lic.allowsSocialMediaUse) return reply.code(403).send(err("license", "Bu fon müziğinin lisansı sosyal medya videosuna izin vermiyor."));
    if (meta.durationMs > config.maxAudioSec * 1000) return reply.code(413).send(err("too-long", `Video için ses en fazla ${Math.round(config.maxAudioSec / 60)} dakika olabilir.`));

    const keys = [`ip:${req.ip}`, `sid:${sid}`];
    const lim = daily.check(keys);
    if (!lim.ok) return reply.code(429).header("retry-after", String(lim.retryAfterSec)).send(err("daily-limit", `Günlük video sınırına (${maxPerDay}) ulaştın.`, { retryAfterSec: lim.retryAfterSec }));
    if (jobs.hasActive(sid)) return reply.code(409).send(err("busy", "Devam eden bir video işin var. Bitmesini bekle."));

    const warnings: string[] = [];
    const t = TARGETS[spec.target], sec = meta.durationMs / 1000;
    if (sec > t.softMaxSec) warnings.push(`${t.label} için önerilen süre ${Math.round(t.softMaxSec / 60 * 10) / 10} dakikadır; bu video ${Math.round(sec)} sn. Yayınlamadan önce platformun güncel sınırını kontrol et.`);
    if (spec.orientation !== t.orientation) warnings.push(`${t.label} için önerilen yön ${t.orientation === "portrait" ? "dikey (9:16)" : "yatay (16:9)"}.`);
    if (spec.captions && !bundle.captions.length && !bundle.timings.length) warnings.push("Satır zamanlaması olmadığı için altyazı eklenmedi.");

    const id = randomUUID(), jobDir = path.join(config.workDir, id);
    mkdirSync(jobDir, { recursive: true });
    const audioFile = path.join(jobDir, `audio.${meta.format}`);
    try { copyFileSync(audioPath, audioFile); } catch { return reply.code(410).send(err("gone", "Ses dosyasının süresi doldu. Yeniden dışa aktar.")); } // işlem boyunca kendi kopyamız
    daily.consume(keys);
    const job = jobs.create({
      id, sessionId: sid, ip: req.ip, spec, bundle, warnings, durationMs: meta.durationMs,
      attribution: meta.music.attributionRequired ? meta.music.attributionText : undefined,
    }, audioFile, jobDir);
    void exportId;
    jobs.enqueue(job);
    const body: VideoCreated = { jobId: job.id, remainingToday: lim.remaining - 1 };
    return reply.code(201).send(body);
  });

  app.get<{ Params: { id: string } }>("/api/video/jobs/:id", async (req, reply) => {
    const job = jobs.get(req.params.id), session = req.headers["x-siir-session"];
    if (!job || !isSession(session) || job.sessionId !== session.toLowerCase()) return reply.code(404).send(err("not-found", "İş bulunamadı."));
    const s: VideoStatus = { jobId: job.id, state: job.state, progress: Math.round(job.progress * 100) / 100, warnings: job.warnings };
    if (job.state === "failed") { s.errorCode = job.errorCode; s.message = job.message; }
    if (job.state === "completed") {
      s.width = job.width; s.height = job.height; s.durationMs = job.durationMs;
      if (job.downloaded) s.message = "Video indirildi ve sunucudan silindi.";
      else if (job.expired || !existsSync(job.outPath)) { s.state = "failed"; s.errorCode = "expired"; s.message = "Videonun süresi doldu ve sunucudan silindi. Yeniden oluştur."; }
      else { s.downloadUrl = `/api/video/jobs/${job.id}/download?t=${signToken(config.signingSecret, "v:" + job.id, config.downloadTokenTtlSec)}`; s.expiresInSec = config.downloadTokenTtlSec; }
    }
    return reply.header("cache-control", "no-store").send(s);
  });

  app.get<{ Params: { id: string }; Querystring: { t?: string } }>("/api/video/jobs/:id/download", async (req, reply) => {
    const job = jobs.get(req.params.id);
    if (!job || typeof req.query.t !== "string" || !verifyToken(config.signingSecret, "v:" + job.id, req.query.t)) return reply.code(403).send(err("forbidden", "İndirme adresi geçersiz veya süresi doldu."));
    if (job.state !== "completed" || job.downloaded || job.expired || !existsSync(job.outPath)) return reply.code(410).send(err("gone", "Video artık mevcut değil."));
    const name = `${slug(job.bundle.poem.title)}-${RATIO[job.spec.orientation]}-${new Date().toISOString().slice(0, 10)}.mp4`;
    const stream = createReadStream(job.outPath);
    reply.raw.on("finish", () => jobs.markDownloaded(job));
    return reply.header("content-type", "video/mp4").header("content-disposition", `attachment; filename="${name}"`).header("cache-control", "no-store").header("x-content-type-options", "nosniff").send(stream);
  });

  return { app, jobs };
}
