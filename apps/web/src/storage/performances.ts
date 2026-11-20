// Kayıtlı Şiirler (tamamlanmış performanslar). Şiir, deneme ve fon yalnızca kimlikle bağlanır; hiçbiri kopyalanmaz.
import type { CaptionCue, FxSettings, LineTiming, MixSettings, Performance, Project, Take } from "@siir/contracts";
import { analysisFor } from "../audio/fx/analysisCache";
import { renderTakeToWav } from "../audio/fx/render";
import { defaultFx, sanitizeFx } from "../audio/fx/settings";
import { computeLineTimings, detectSpeech, toCaptions } from "../audio/timing";
import { sanitizeMix } from "../shared/mix";
import { parsePoem } from "../shared/util";
import { store, wrap } from "./db";
import { listTakes } from "./repo";
import { openTakeReader, type TakeReader } from "./takeReader";

const num = (v: unknown, a: number, b: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Her girdiyi (eski/bozuk kayıt dahil) güvenli Performance'a çevirir. Fırlatmaz. */
export function sanitizePerformance(raw: unknown): Performance {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>, now = new Date().toISOString();
  const tp = o.teleprompterSettings ?? {}, ct = o.captionTiming ?? {};
  const timings: LineTiming[] = (Array.isArray(ct.timings) ? ct.timings : []).slice(0, 2000).filter((t: any) => t && typeof t.lineId === "string" && Number.isFinite(t.startMs) && Number.isFinite(t.endMs))
    .map((t: any) => ({ lineId: String(t.lineId).slice(0, 40), startMs: Math.max(0, t.startMs), endMs: Math.max(0, t.endMs) }));
  const captions: CaptionCue[] = (Array.isArray(ct.captions) ? ct.captions : []).slice(0, 2000).filter((c: any) => c && typeof c.text === "string" && Number.isFinite(c.startMs) && Number.isFinite(c.endMs))
    .map((c: any) => ({ startMs: Math.max(0, c.startMs), endMs: Math.max(0, c.endMs), text: String(c.text).slice(0, 300), lineIds: Array.isArray(c.lineIds) ? c.lineIds.filter((x: unknown) => typeof x === "string").slice(0, 10) : [] }));
  const track = typeof o.backgroundTrackId === "string" && /^(trk_\d{4}|loc_[0-9a-f-]{36})$/.test(o.backgroundTrackId) ? o.backgroundTrackId : null;
  return {
    id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(), schemaVersion: 1,
    poemId: str(o.poemId, 80), selectedTakeId: str(o.selectedTakeId, 80),
    processedVoiceId: typeof o.processedVoiceId === "string" && o.processedVoiceId ? o.processedVoiceId : null,
    backgroundTrackId: track,
    mixSettings: sanitizeMix(o.mixSettings), fx: sanitizeFx(o.fx ?? defaultFx()),
    teleprompterSettings: { speed: num(tp.speed, 8, 90, 28), fontScale: num(tp.fontScale, 0.8, 1.6, 1) },
    captionTiming: { timings, captions },
    title: str(o.title, 120), poet: str(o.poet, 80),
    videoProjectId: typeof o.videoProjectId === "string" && o.videoProjectId ? o.videoProjectId.slice(0, 80) : null,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : now, updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : now,
  };
}

/** Şiir satırı zamanlamaları: ses etkinliği + hece ağırlığı. Ses yoksa/konuşma bulunamazsa boş döner. */
export async function frameRmsOf(reader: TakeReader, frameMs = 50): Promise<number[]> {
  const frame = Math.max(1, Math.round((reader.sampleRate * frameMs) / 1000)), chunk = frame * 100, out: number[] = [];
  for (let p = 0; p < reader.totalSamples; p += chunk) {
    const x = await reader.read(p, Math.min(chunk, reader.totalSamples - p));
    for (let i = 0; i + frame <= x.length; i += frame) { let s = 0; for (let j = 0; j < frame; j++) s += x[i + j] * x[i + j]; out.push(Math.sqrt(s / frame)); }
  }
  return out;
}
export function captionTimingFor(text: string, frameRms: ArrayLike<number>): { timings: LineTiming[]; captions: CaptionCue[] } {
  const lines = parsePoem(text).stanzas.flatMap((s) => s.lines);
  const timings = computeLineTimings(lines, detectSpeech(frameRms));
  return { timings, captions: toCaptions(lines, timings) };
}
export async function computeCaptionTiming(take: Take, text: string) {
  try { return captionTimingFor(text, await frameRmsOf(await openTakeReader(take))); } catch { return { timings: [], captions: [] }; }
}

export function buildPerformance(p: Project, take: Take, timing: Performance["captionTiming"], videoProjectId: string | null = null): Performance {
  const now = new Date().toISOString();
  return sanitizePerformance({
    id: crypto.randomUUID(), poemId: p.id, selectedTakeId: take.id, processedVoiceId: null,
    backgroundTrackId: p.trackId, mixSettings: p.mix, fx: take.fx ?? p.fx,
    teleprompterSettings: { speed: p.reading?.speed ?? 28, fontScale: p.reading?.fontScale ?? 1 },
    captionTiming: timing, title: p.title, poet: p.mix.poet, videoProjectId, createdAt: now, updatedAt: now,
  });
}

// ---------- Depolama ----------
export async function listPerformances(): Promise<Performance[]> {
  const { s } = await store("performances", "readonly");
  return (await wrap(s.getAll() as IDBRequest<unknown[]>)).map(sanitizePerformance).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function savePerformance(p: Performance) {
  const { s, done } = await store("performances", "readwrite");
  s.put({ ...sanitizePerformance(p), updatedAt: new Date().toISOString() });
  await done;
}
export async function deletePerformance(id: string) {
  const a = await store("performances", "readwrite"); a.s.delete(id); await a.done;
  const b = await store("processedVoices", "readwrite"); b.s.delete(id); await b.done;
}
export async function deletePerformancesOfPoem(poemId: string) {
  for (const p of (await listPerformances()).filter((x) => x.poemId === poemId)) await deletePerformance(p.id);
}

/**
 * İşlenmiş şiir sesi: ham deneme + atmosfer ayarından üretilen TÜREV (kaynak değişmez). Üretildikten sonra önbelleğe alınır;
 * atmosfer ayarı değişirse yeniden üretilir.
 */
export async function getProcessedVoice(perf: Performance, onProgress?: (f: number) => void): Promise<Blob> {
  const key = perf.selectedTakeId + "|" + JSON.stringify(perf.fx);
  const c = await store("processedVoices", "readonly");
  const hit = await wrap(c.s.get(perf.id) as IDBRequest<{ key: string; blob: Blob } | undefined>);
  if (hit && hit.key === key) return hit.blob;
  const take = (await listTakes(perf.poemId)).find((t) => t.id === perf.selectedTakeId && t.status === "complete");
  if (!take) throw new Error("Bu kaydın ses denemesi bulunamadı (silinmiş olabilir).");
  const reader = await openTakeReader(take), analysis = await analysisFor(take, reader);
  const r = await renderTakeToWav(reader, sanitizeFx(perf.fx), analysis, { normalize: true, targetLufs: -16, onProgress });
  const w = await store("processedVoices", "readwrite");
  w.s.put({ key, blob: r.blob }, perf.id); await w.done;
  if (perf.processedVoiceId !== perf.id) await savePerformance({ ...perf, processedVoiceId: perf.id });
  return r.blob;
}

/** Deneme hâlâ var mı? (silinmişse performans çalınamaz) */
export async function takeExists(perf: Performance): Promise<boolean> {
  return (await listTakes(perf.poemId)).some((t) => t.id === perf.selectedTakeId && t.status === "complete");
}
export type { FxSettings, MixSettings };
