import { spawn } from "node:child_process";
import { createRequire } from "node:module";

let cached: string | null = null;

/** Sıra: açık yol (FFMPEG_PATH) → (yalnızca geliştirme) ffmpeg-static → sistem `ffmpeg`. Üretimde Docker imajındaki ffmpeg kullanılır. */
export function ffmpegPath(explicit = ""): string {
  if (explicit) return explicit;
  if (cached) return cached;
  try {
    const p = createRequire(import.meta.url)("ffmpeg-static") as string | null;
    if (p) return (cached = p);
  } catch { /* geliştirme bağımlılığı yok */ }
  return (cached = "ffmpeg");
}

export type RunResult = { code: number; stderr: string; stdout: string };
export type RunOptions = {
  timeoutMs?: number; cwd?: string; ffmpeg?: string;
  /** `-progress pipe:1` çıktısının her satırı için (anahtar=değer). */
  onStdoutLine?: (line: string) => void;
  signal?: AbortSignal;
};

/** Kabuksuz çalıştırır (argümanlar dizi); zaman aşımı, çıktı sınırı ve iptal desteği vardır. */
export function runFfmpeg(args: string[], opt: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(opt.ffmpeg), ["-hide_banner", "-nostdin", ...args], { stdio: ["ignore", "pipe", "pipe"], shell: false, cwd: opt.cwd });
    let stderr = "", stdout = "", buf = "";
    const cap = (s: string, d: Buffer) => (s.length > 200_000 ? s : s + d.toString("utf8"));
    p.stderr.on("data", (d) => (stderr = cap(stderr, d)));
    p.stdout.on("data", (d) => {
      stdout = cap(stdout, d);
      if (opt.onStdoutLine) { buf += d.toString("utf8"); let i; while ((i = buf.indexOf("\n")) >= 0) { opt.onStdoutLine(buf.slice(0, i).trim()); buf = buf.slice(i + 1); } }
    });
    const t = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg zaman aşımı")); }, opt.timeoutMs ?? 10 * 60_000);
    opt.signal?.addEventListener("abort", () => { p.kill("SIGKILL"); }, { once: true });
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code: code ?? -1, stderr, stdout }); });
  });
}
