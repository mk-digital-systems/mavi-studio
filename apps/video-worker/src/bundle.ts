import type { CaptionCue, ExportBundle, LineTiming, VideoSpec } from "@siir/contracts";
import { isOrientation, isPalette, isTarget } from "./presets.js";

export class BundleError extends Error {
  code = "bad-bundle";
}

const ATMOSPHERES = ["clean", "warm", "intimate", "small-hall", "big-hall", "stage", "cinematic", "vintage"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const fail = (m: string): never => { throw new BundleError(m); };
const MAX_LINES = 3000;

/**
 * ExportBundle v1 doğrulaması (güvenilmeyen girdi). Şekil, tür, sınır ve zaman tutarlılığı denetlenir;
 * zamanlar [0, süre] aralığına sıkıştırılır ve sıralanır. Müzik/lisans alanları burada KULLANILMAZ:
 * onlar sunucunun yazdığı meta dosyasından gelir (bkz. app.ts).
 */
export function validateBundle(raw: unknown, durationMs: number): ExportBundle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("Paket geçersiz.");
  const b = raw as Record<string, any>;
  if (b.bundleVersion !== 1) fail("Desteklenmeyen paket sürümü (bundleVersion 1 olmalı).");
  const a = b.audio ?? {};
  if (typeof a.masterAudioRef !== "string" || !a.masterAudioRef || a.masterAudioRef.length > 300) fail("Ses başvurusu eksik.");
  if (a.format !== "wav" && a.format !== "mp3") fail("Ses biçimi wav veya mp3 olmalı.");
  const p = b.poem ?? {};
  if (typeof p.text !== "string" || p.text.length > 50_000) fail("Şiir metni geçersiz.");
  const title = str(p.title, 120);

  const clamp = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.min(durationMs, Math.max(0, Math.round(n))) : NaN);
  if (!Array.isArray(b.timings) || b.timings.length > MAX_LINES) fail("Zamanlamalar geçersiz.");
  const timings: LineTiming[] = [];
  for (const t of b.timings as any[]) {
    const s = clamp(t?.startMs), e = clamp(t?.endMs);
    if (typeof t?.lineId !== "string" || !/^s\d{1,4}l\d{1,4}$/.test(t.lineId) || Number.isNaN(s) || Number.isNaN(e) || e < s) fail("Zamanlama kaydı geçersiz.");
    timings.push({ lineId: t.lineId, startMs: s, endMs: e });
  }
  timings.sort((x, y) => x.startMs - y.startMs);

  const captionsIn = Array.isArray(b.captions) ? b.captions : [];
  if (captionsIn.length > MAX_LINES) fail("Altyazı sayısı çok fazla.");
  const captions: CaptionCue[] = [];
  for (const c of captionsIn as any[]) {
    const s = clamp(c?.startMs), e = clamp(c?.endMs), text = str(c?.text, 600);
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) fail("Altyazı kaydı geçersiz.");
    if (text) captions.push({ startMs: s, endMs: e, text, lineIds: Array.isArray(c?.lineIds) ? c.lineIds.filter((x: unknown) => typeof x === "string").slice(0, 8).map((x: string) => x.slice(0, 20)) : [] });
  }
  captions.sort((x, y) => x.startMs - y.startMs);

  const v = b.video ?? {};
  if (!isOrientation(v.orientation)) fail("Yön portrait, landscape veya square olmalı.");
  const targets = Array.isArray(v.targets) ? [...new Set((v.targets as unknown[]).filter(isTarget))] : [];
  const st = b.studio ?? {};
  const atmosphere = ATMOSPHERES.includes(st.atmosphere) ? st.atmosphere : "clean";
  const m = b.music ?? {};

  return {
    bundleVersion: 1,
    projectId: str(b.projectId, 64),
    ownerId: typeof b.ownerId === "string" ? b.ownerId.slice(0, 64) : null,
    audio: { masterAudioRef: a.masterAudioRef, format: a.format, durationMs },
    poem: { title, text: p.text },
    timings, captions,
    // Yalnızca tutarlılık denetimi için taşınır; kaynak sunucudur.
    music: { trackId: typeof m.trackId === "string" ? m.trackId.slice(0, 16) : null, attributionRequired: false, license: { type: "", allowsSocialMediaUse: false, allowsCommercialUse: false } },
    credits: { poet: str(b.credits?.poet, 80), reader: str(b.credits?.reader, 80) },
    studio: { atmosphere },
    video: { orientation: v.orientation, targets },
  };
}

export function validateSpec(raw: unknown): VideoSpec {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("Video ayarı geçersiz.");
  const s = raw as Record<string, unknown>;
  if (!isOrientation(s.orientation)) fail("Yön geçersiz.");
  if (!isTarget(s.target)) fail("Platform geçersiz.");
  return {
    orientation: s.orientation as VideoSpec["orientation"], target: s.target as VideoSpec["target"],
    palette: isPalette(s.palette) ? (s.palette as VideoSpec["palette"]) : "dusk",
    captions: s.captions !== false, showTitle: s.showTitle !== false,
  };
}
