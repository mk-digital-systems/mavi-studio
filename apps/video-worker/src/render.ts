import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { VideoSpec } from "@siir/contracts";
import { runFfmpeg } from "@siir/server-kit";
import { config } from "./config.js";
import { DIMENSIONS, PALETTES, TARGETS } from "./presets.js";

export type RenderInput = {
  /** İş dizini: içinde `audio.*` (kopya) bulunur; altyazı ve yazı tipleri buraya yazılır. */
  jobDir: string; audioFile: string; durationMs: number; spec: VideoSpec; ass: string; outPath: string;
  onProgress?: (fraction: number) => void; signal?: AbortSignal;
};
export type RenderResult = { width: number; height: number; durationMs: number };

const x264Preset = () => process.env.VIDEO_X264_PRESET ?? "medium";

/** ffmpeg argümanları (kabuksuz). Altyazı/yazı tipi yolları işe göre GÖRELİ verilir (cwd = jobDir; Windows yol kaçışı sorunu yok). */
export function buildArgs(i: RenderInput): { args: string[]; width: number; height: number } {
  const { width, height } = DIMENSIONS[i.spec.orientation], t = TARGETS[i.spec.target], sec = (i.durationMs / 1000).toFixed(3);
  const [c0, c1, c2] = PALETTES[i.spec.palette].colors;
  const bg = `gradients=s=${width}x${height}:r=${t.fps}:c0=0x${c0}:c1=0x${c1}:c2=0x${c2}:n=3:d=${sec}:speed=0.012:seed=7`; // sabit tohum: aynı iş her seferinde aynı arka planı üretir
  const vf = "[0:v]drawbox=x=0:y=0:w=iw:h=ih:color=black@0.22:t=fill,vignette=PI/4,format=yuv420p,subtitles=filename=subs.ass:fontsdir=fonts[v]";
  return {
    width, height,
    args: [
      "-y", "-f", "lavfi", "-i", bg, "-i", i.audioFile,
      "-filter_complex", vf, "-map", "[v]", "-map", "1:a",
      "-c:v", "libx264", "-preset", x264Preset(), "-crf", "21", "-maxrate", `${t.maxrateK}k`, "-bufsize", `${t.maxrateK * 2}k`,
      "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(t.fps), "-g", String(t.fps * 2), "-movflags", "+faststart",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
      "-t", sec, "-progress", "pipe:1", "-nostats", i.outPath,
    ],
  };
}

export async function renderVideo(i: RenderInput): Promise<RenderResult> {
  mkdirSync(path.join(i.jobDir, "fonts"), { recursive: true });
  for (const f of readdirSync(config.fontsDir)) if (f.endsWith(".ttf")) copyFileSync(path.join(config.fontsDir, f), path.join(i.jobDir, "fonts", f));
  writeFileSync(path.join(i.jobDir, "subs.ass"), i.ass, "utf8");
  const { args, width, height } = buildArgs(i);
  const r = await runFfmpeg(args, {
    cwd: i.jobDir, ffmpeg: config.ffmpegPath, timeoutMs: config.renderTimeoutMs, signal: i.signal,
    onStdoutLine: (l) => { const m = /^out_time_us=(\d+)/.exec(l); if (m) i.onProgress?.(Math.min(1, +m[1] / 1000 / i.durationMs)); },
  });
  if (i.signal?.aborted) throw new Error("iptal");
  if (r.code !== 0) throw Object.assign(new Error("Video hazırlanamadı."), { detail: r.stderr.slice(-800) });
  return { width, height, durationMs: i.durationMs };
}
