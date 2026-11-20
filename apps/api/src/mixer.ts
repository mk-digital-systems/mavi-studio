import { unlinkSync } from "node:fs";
import type { ExportRecipe } from "@siir/contracts";
import type { TrackRecord } from "./catalog.js";
import { runFfmpeg } from "./ffmpeg.js";
import { resolveMaster } from "./music.js";
import { speechLevelDb, type WavInfo } from "./wavinfo.js";

export type MixInput = { voicePath: string; info: WavInfo; recipe: ExportRecipe; track: TrackRecord | null; outPath: string };
export type Loudness = { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string };
export type MixReport = { speechDb: number; duckThresholdDb: number | null; measured: Loudness; durationSec: number };

export class MixError extends Error {
  constructor(public code: string, message: string, public detail = "") { super(message); }
}

const RATIO = 4;
const f = (n: number, d = 3) => n.toFixed(d);

/** Ducking eşiği: sabit 4:1 oranla, konuşma düzeyinde hedeflenen `amount` dB kadar azaltma verir. */
export function duckThresholdDb(speechDb: number, amountDb: number) {
  return speechDb - (amountDb * RATIO) / (RATIO - 1);
}

/** ffmpeg filtre grafiği (kabuksuz, argüman olarak verilir; kullanıcı metni içermez). */
export function buildGraph(
  recipe: ExportRecipe, info: WavInfo, hasMusic: boolean, speechDb: number, tail: string,
): { graph: string; duckDb: number | null; durationSec: number } {
  const r = recipe, A = r.alignmentOffsetMs;
  const vDelay = Math.max(0, Math.round(A)), mDelay = Math.max(0, Math.round(-A)); // ms
  const voiceEnd = vDelay / 1000 + info.durationSec;
  const total = hasMusic ? voiceEnd + r.music.tailSec : voiceEnd;
  const parts: string[] = [];
  parts.push(`[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=48000,adelay=${vDelay}|${vDelay}[v0]`);
  let duckDb: number | null = null;
  if (hasMusic) {
    const md = Math.max(1, total - mDelay / 1000); // müziğin çıkıştaki süresi
    const fi = Math.min(r.music.fadeInSec, md / 2), fo = Math.min(r.music.fadeOutSec, md / 2);
    const chain = [
      "aformat=sample_fmts=fltp:channel_layouts=stereo", "aresample=48000",
      `atrim=start=${f(r.music.startOffsetSec)}`, "asetpts=PTS-STARTPTS", `atrim=duration=${f(md)}`,
      `volume=${f(r.music.gainDb, 2)}dB`,
      ...(fi > 0 ? [`afade=t=in:st=0:d=${f(fi)}`] : []),
      ...(fo > 0 ? [`afade=t=out:st=${f(md - fo)}:d=${f(fo)}`] : []),
      `adelay=${mDelay}|${mDelay}`,
    ];
    parts.push(`[1:a]${chain.join(",")}[m0]`);
    if (r.ducking.enabled && r.ducking.amountDb > 0) {
      duckDb = duckThresholdDb(speechDb, r.ducking.amountDb);
      const thr = Math.min(1, Math.max(0.00097563, Math.pow(10, duckDb / 20)));
      // yan zincir sesi bitince sidechaincompress çıktıyı keser: müzik kuyruğu için sessizlikle uzat
      parts.push("[v0]asplit=2[v][sc0]");
      parts.push(`[sc0]apad=whole_dur=${f(total)}[sc]`);
      parts.push(`[m0][sc]sidechaincompress=threshold=${f(thr, 6)}:ratio=${RATIO}:attack=${f(r.ducking.attackMs, 1)}:release=${f(r.ducking.releaseMs, 1)}:makeup=1:detection=rms:link=average[m]`);
    } else { parts.push("[v0]anull[v]"); parts.push("[m0]anull[m]"); }
    parts.push("[v][m]amix=inputs=2:normalize=0:duration=longest:dropout_transition=0[mix]");
  } else parts.push("[v0]anull[mix]");
  parts.push(`[mix]${tail}[out]`);
  return { graph: parts.join(";"), duckDb, durationSec: total };
}

function parseLoudnorm(stderr: string): Loudness {
  const i = stderr.lastIndexOf("{"), j = stderr.lastIndexOf("}");
  if (i < 0 || j < i) throw new MixError("measure-failed", "Ses seviyesi ölçülemedi.");
  const o = JSON.parse(stderr.slice(i, j + 1)) as Loudness;
  for (const k of ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"] as const)
    if (!Number.isFinite(+o[k])) throw new MixError("silent", "Ses seviyesi ölçümü geçersiz (kayıt sessiz olabilir).");
  return o;
}

/** ID3 / WAV INFO etiketleri: yalnızca temizlenmiş metin, argüman dizisiyle (kabuk yok). */
function metaArgs(r: ExportRecipe, track: TrackRecord | null) {
  const m: [string, string][] = [];
  if (r.title) m.push(["title", r.title]);
  const artist = r.reader || r.poet;
  if (artist) m.push(["artist", artist]);
  if (r.poet) m.push(["composer", r.poet]);
  m.push(["date", String(new Date().getFullYear())]);
  m.push(["encoded_by", "Şiir Stüdyosu"]);
  if (track?.license.attributionRequired && track.license.attributionText) m.push(["comment", track.license.attributionText]);
  return m.flatMap(([k, v]) => ["-metadata", `${k}=${v}`]);
}

/** İki geçişli miks: (1) ölçüm, (2) doğrusal loudnorm + alimiter. Ham müzik hiçbir yere kopyalanmaz. */
export async function mix(inp: MixInput): Promise<MixReport> {
  const { voicePath, info, recipe, track, outPath } = inp;
  const speechDb = speechLevelDb(voicePath, info);
  if (speechDb < -70) throw new MixError("silent", "Kayıt neredeyse sessiz; dışa aktarma yapılamadı.");
  const hasMusic = !!track && !!recipe.trackId;
  const master = hasMusic ? await resolveMaster(track!) : null;
  const inputs = ["-i", voicePath, ...(master ? ["-stream_loop", "-1", "-i", master] : [])];

  const I = recipe.loudness.targetLufs, TP = recipe.loudness.truePeakDb;
  const g1 = buildGraph(recipe, info, hasMusic, speechDb, `loudnorm=I=${I}:TP=${TP}:LRA=11:print_format=json`);
  const total = g1.durationSec;
  const p1 = await runFfmpeg([...inputs, "-filter_complex", g1.graph, "-map", "[out]", "-t", f(total), "-f", "null", "-"]);
  if (p1.code !== 0) throw new MixError("mix-failed", "Miks hazırlanamadı.", p1.stderr.slice(-800));
  const L = parseLoudnorm(p1.stderr);

  const lim = Math.pow(10, TP / 20).toFixed(4);
  const tail =
    `loudnorm=I=${I}:TP=${TP}:LRA=11:measured_I=${L.input_i}:measured_TP=${L.input_tp}:measured_LRA=${L.input_lra}:measured_thresh=${L.input_thresh}:offset=${L.target_offset}:linear=true,` +
    `alimiter=limit=${lim}:level=disabled`;
  const g2 = buildGraph(recipe, info, hasMusic, speechDb, tail);
  const codec = recipe.format === "wav"
    ? ["-c:a", "pcm_s24le"]
    : ["-c:a", "libmp3lame", "-b:a", "192k", "-id3v2_version", "3", "-write_xing", "1"];
  const p2 = await runFfmpeg([
    "-y", ...inputs, "-filter_complex", g2.graph, "-map", "[out]", "-t", f(total),
    "-ar", "48000", "-ac", "2", ...metaArgs(recipe, track), ...codec, outPath,
  ]);
  if (p2.code !== 0) {
    try { unlinkSync(outPath); } catch { /* yok */ }
    throw new MixError("mix-failed", "Miks hazırlanamadı.", p2.stderr.slice(-800));
  }
  return { speechDb, duckThresholdDb: g1.duckDb, measured: L, durationSec: total };
}
