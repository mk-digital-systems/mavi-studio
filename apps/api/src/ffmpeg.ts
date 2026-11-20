import { ffmpegPath as kitPath, runFfmpeg as kitRun, type RunResult } from "@siir/server-kit";
import { config } from "./config.js";

export type { RunResult };
export const ffmpegPath = () => kitPath(config.ffmpegPath);
/** API için ince sarmalayıcı: yapılandırılmış ffmpeg yolu ve zaman aşımı. */
export const runFfmpeg = (args: string[], timeoutMs = 10 * 60_000): Promise<RunResult> => kitRun(args, { timeoutMs, ffmpeg: config.ffmpegPath });
