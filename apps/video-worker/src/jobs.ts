import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import path from "node:path";
import type { ExportBundle, VideoJobState, VideoSpec } from "@siir/contracts";
import { buildAss, cuesFromTimings } from "./captions.js";
import { config } from "./config.js";
import { DIMENSIONS } from "./presets.js";
import { renderVideo } from "./render.js";

export type VideoJob = {
  id: string; sessionId: string; ip: string; spec: VideoSpec; bundle: ExportBundle;
  state: VideoJobState; progress: number; createdAt: number; warnings: string[];
  jobDir: string; audioFile: string; outPath: string; durationMs: number; attribution?: string;
  width?: number; height?: number; finishedAt?: number; outputExpiresAt?: number;
  downloaded?: boolean; expired?: boolean; errorCode?: string; message?: string;
};

const ACTIVE: VideoJobState[] = ["waiting", "preparing"];
const rmFile = (p: string) => { try { unlinkSync(p); } catch { /* yok */ } };
const rmDir = (p: string) => { try { rmSync(p, { recursive: true, force: true }); } catch { /* yok */ } };

export class VideoJobStore {
  private jobs = new Map<string, VideoJob>();
  private queue: string[] = [];
  private running = 0;
  private timer?: NodeJS.Timeout;
  /** Test kancası. */
  renderFn: typeof renderVideo = renderVideo;
  constructor(private now: () => number = Date.now) {}

  static wipeWork() {
    mkdirSync(config.workDir, { recursive: true });
    for (const f of readdirSync(config.workDir)) rmDir(path.join(config.workDir, f));
  }
  start() { this.timer = setInterval(() => this.sweep(), config.sweepEveryMs); this.timer.unref(); }
  stop() { clearInterval(this.timer); }

  create(init: Pick<VideoJob, "id" | "sessionId" | "ip" | "spec" | "bundle" | "warnings" | "durationMs" | "attribution">, audioFile: string, jobDir: string): VideoJob {
    const job: VideoJob = { ...init, state: "waiting", progress: 0, createdAt: this.now(), jobDir, audioFile, outPath: path.join(config.workDir, `${init.id}.mp4`) };
    this.jobs.set(job.id, job);
    return job;
  }
  get(id: string) { return this.jobs.get(id); }
  hasActive(sessionId: string) { return [...this.jobs.values()].some((j) => j.sessionId === sessionId && ACTIVE.includes(j.state)); }
  get stats() { return { jobs: this.jobs.size, queued: this.queue.length, running: this.running }; }

  enqueue(job: VideoJob) { this.queue.push(job.id); void this.pump(); }

  private async pump() {
    while (this.running < config.maxConcurrentRender && this.queue.length) {
      const job = this.jobs.get(this.queue.shift()!);
      if (!job || job.state !== "waiting") continue;
      this.running++;
      void this.run(job).finally(() => { this.running--; void this.pump(); });
    }
  }

  private async run(job: VideoJob) {
    job.state = "preparing";
    try {
      const b = job.bundle;
      const cues = b.captions.length ? b.captions : cuesFromTimings(b.poem.text, b.timings);
      const ass = buildAss({
        ...DIMENSIONS[job.spec.orientation], orientation: job.spec.orientation, durationMs: job.durationMs, cues,
        title: b.poem.title, credits: b.credits, attribution: job.attribution, captions: job.spec.captions && cues.length > 0, showTitle: job.spec.showTitle,
      });
      const r = await this.renderFn({
        jobDir: job.jobDir, audioFile: job.audioFile, durationMs: job.durationMs, spec: job.spec, ass, outPath: job.outPath,
        onProgress: (f) => { job.progress = f; },
      });
      job.width = r.width; job.height = r.height; job.progress = 1;
      job.state = "completed"; job.finishedAt = this.now(); job.outputExpiresAt = this.now() + config.outputTtlMs; // çıktı en fazla 30 dk
    } catch (e) {
      job.state = "failed"; job.errorCode = "render-failed"; job.message = "Video hazırlanamadı. Lütfen tekrar dene."; job.finishedAt = this.now();
      rmFile(job.outPath);
      void e;
    } finally {
      rmDir(job.jobDir); // ses kopyası, altyazı ve yazı tipi kopyaları işlem biter bitmez silinir
    }
  }

  markDownloaded(job: VideoJob) { job.downloaded = true; rmFile(job.outPath); }

  sweep() {
    const t = this.now();
    for (const job of this.jobs.values()) {
      if (job.state === "completed" && job.outputExpiresAt && t > job.outputExpiresAt && !job.expired) { rmFile(job.outPath); job.expired = true; }
      const done = job.finishedAt;
      if (done && t > done + config.outputTtlMs + 10 * 60_000 && !ACTIVE.includes(job.state)) this.jobs.delete(job.id); // kayıt da silinir
    }
  }
  files(job: VideoJob) { return { dir: existsSync(job.jobDir), out: existsSync(job.outPath) }; }
}
