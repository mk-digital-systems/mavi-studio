import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import path from "node:path";
import { writeFileSync } from "node:fs";
import type { ExportAudioInfo, ExportJobState, ExportRecipe } from "@siir/contracts";
import type { TrackRecord } from "./catalog.js";
import { config, dirs } from "./config.js";
import { mix, MixError } from "./mixer.js";
import type { WavInfo } from "./wavinfo.js";

export type Job = {
  id: string; sessionId: string; ip: string; recipe: ExportRecipe; track: TrackRecord | null;
  state: ExportJobState; uploadToken: string;
  createdAt: number; awaitUploadUntil: number;
  voicePath: string; outPath: string; metaPath: string; info?: WavInfo;
  /** Yalnızca forVideo işlerde: sunucunun yazdığı müzik/süre bilgisi (video işçisi bunu okur, istemciyi dinlemez). */
  audioInfo?: ExportAudioInfo;
  outputExpiresAt?: number; downloaded?: boolean; expired?: boolean; uploading?: boolean;
  errorCode?: string; message?: string; finishedAt?: number;
};

const ACTIVE: ExportJobState[] = ["awaiting-upload", "waiting", "preparing"];
const rm = (p: string | undefined) => { if (p) try { unlinkSync(p); } catch { /* yok */ } };

export class JobStore {
  private jobs = new Map<string, Job>();
  private queue: string[] = [];
  private running = 0;
  private timer?: NodeJS.Timeout;
  /** Test kancası: miks işlevi değiştirilebilir. */
  mixFn: typeof mix = mix;

  constructor(private now: () => number = Date.now) {}

  /** Başlangıçta geçici dizin temizlenir: çökme/yeniden başlatma sonrası artık dosya kalmaz. */
  static wipeTmp() {
    mkdirSync(dirs.tmp, { recursive: true });
    for (const f of readdirSync(dirs.tmp)) rmSync(path.join(dirs.tmp, f), { recursive: true, force: true });
  }
  start() { this.timer = setInterval(() => this.sweep(), config.sweepEveryMs); this.timer.unref(); }
  stop() { clearInterval(this.timer); }

  create(init: { id: string; sessionId: string; ip: string; recipe: ExportRecipe; track: TrackRecord | null; uploadToken: string }): Job {
    const t = this.now();
    const job: Job = {
      ...init, state: "awaiting-upload", createdAt: t, awaitUploadUntil: t + config.awaitUploadMs,
      voicePath: path.join(dirs.tmp, `${init.id}.voice.wav`),
      outPath: path.join(dirs.tmp, `${init.id}.out.${init.recipe.format}`),
      metaPath: path.join(dirs.tmp, `${init.id}.meta.json`),
    };
    this.jobs.set(job.id, job);
    return job;
  }
  get(id: string) { return this.jobs.get(id); }
  activeFor(sessionId: string, ip: string) {
    const all = [...this.jobs.values()].filter((j) => ACTIVE.includes(j.state));
    return { session: all.some((j) => j.sessionId === sessionId), ip: all.filter((j) => j.ip === ip).length };
  }
  get stats() { return { jobs: this.jobs.size, queued: this.queue.length, running: this.running }; }

  /** Yükleme tamamlandı ve doğrulandı: kuyruğa al. */
  enqueue(job: Job, info: WavInfo) {
    job.info = info; job.state = "waiting"; this.queue.push(job.id);
    void this.pump();
  }

  fail(job: Job, code: string, message: string) {
    job.state = "failed"; job.errorCode = code; job.message = message; job.finishedAt = this.now();
    rm(job.voicePath); rm(job.outPath); rm(job.metaPath);
  }

  private async pump() {
    while (this.running < config.maxConcurrentMix && this.queue.length) {
      const job = this.jobs.get(this.queue.shift()!);
      if (!job || job.state !== "waiting") continue;
      this.running++;
      void this.run(job).finally(() => { this.running--; void this.pump(); });
    }
  }

  private async run(job: Job) {
    job.state = "preparing";
    try {
      const rep = await this.mixFn({ voicePath: job.voicePath, info: job.info!, recipe: job.recipe, track: job.track, outPath: job.outPath });
      job.state = "completed"; job.finishedAt = this.now();
      job.outputExpiresAt = this.now() + config.outputTtlMs; // çıktı en fazla 30 dk
      if (job.recipe.forVideo) this.writeMeta(job, Math.round(((rep as { durationSec?: number })?.durationSec ?? job.info!.durationSec) * 1000));
    } catch (e) {
      const m = e instanceof MixError ? e : null;
      this.fail(job, m?.code ?? "mix-failed", m && m.code === "silent" ? m.message : "Miks sırasında bir sorun oluştu. Lütfen tekrar dene.");
    } finally {
      rm(job.voicePath); // yüklenen ses işlem biter bitmez silinir (başarılı da, başarısız da)
    }
  }

  /** Video için saklanan işlerde sunucu, müzik/lisans bilgisini kendisi yazar (istemci değiştiremez). */
  private writeMeta(job: Job, durationMs: number) {
    const t = job.track;
    job.audioInfo = {
      format: job.recipe.format, durationMs,
      music: {
        trackId: t?.id ?? null, title: t?.title, artist: t?.artist,
        attributionRequired: !!t?.license.attributionRequired, attributionText: t?.license.attributionRequired ? t.license.attributionText : undefined,
        license: { type: t?.license.type ?? "none", allowsSocialMediaUse: t ? t.license.allowsSocialMediaUse : true, allowsCommercialUse: t ? t.license.allowsCommercialUse : true, evidenceRef: t?.id },
      },
    };
    writeFileSync(job.metaPath, JSON.stringify({ jobId: job.id, sessionId: job.sessionId, expiresAt: job.outputExpiresAt, ...job.audioInfo }));
  }

  /** İndirme tamamlandı: çıktı hemen silinir (video için saklananlar TTL'ye kadar kalır). */
  markDownloaded(job: Job) {
    job.downloaded = true;
    if (!job.recipe.forVideo) rm(job.outPath);
  }

  /** Süresi dolanları siler. Zamanlayıcı ve test tarafından çağrılır. */
  sweep() {
    const t = this.now();
    for (const job of this.jobs.values()) {
      if (job.state === "awaiting-upload" && t > job.awaitUploadUntil) this.fail(job, "upload-timeout", "Yükleme süresi doldu.");
      if (t > job.createdAt + config.uploadTtlMs) rm(job.voicePath);                       // yükleme TTL: 1 saat
      if (job.state === "completed" && job.outputExpiresAt && t > job.outputExpiresAt && !job.expired) {
        rm(job.outPath); rm(job.metaPath); job.expired = true;                            // çıktı TTL: 30 dk
      }
      const finished = job.finishedAt ?? (job.state === "completed" ? t : 0);
      if (finished && t > finished + config.outputTtlMs + 10 * 60_000 && !ACTIVE.includes(job.state)) this.jobs.delete(job.id); // kayıt da silinir
    }
  }
  /** Diskte bu işe ait dosya var mı (testler için). */
  files(job: Job) { return { voice: existsSync(job.voicePath), out: existsSync(job.outPath), meta: existsSync(job.metaPath) }; }
}
