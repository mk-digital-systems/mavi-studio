import type { ExportRecipe } from "@siir/contracts";

export class RecipeError extends Error {
  code = "bad-recipe";
}

const num = (v: unknown, min: number, max: number, dflt: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt;
const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";

/**
 * Güvenilmeyen tarif: şekil ve türler doğrulanır, sayılar GÜVENLİ aralığa sıkıştırılır,
 * metinler temizlenir (komut satırına/dosya adına asla doğrudan girmez). Eksik alan → varsayılan.
 */
export function validateRecipe(raw: unknown): ExportRecipe {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new RecipeError("Tarif geçersiz.");
  const r = raw as Record<string, any>;
  if (r.format !== "wav" && r.format !== "mp3") throw new RecipeError("Biçim wav veya mp3 olmalı.");
  let trackId: string | null = null;
  if (r.trackId !== null && r.trackId !== undefined) {
    if (typeof r.trackId !== "string" || !/^trk_\d{4}$/.test(r.trackId)) throw new RecipeError("Geçersiz fon müziği kimliği.");
    trackId = r.trackId;
  }
  const m = r.music ?? {}, d = r.ducking ?? {}, l = r.loudness ?? {};
  return {
    format: r.format, trackId,
    title: text(r.title, 120), poet: text(r.poet, 80), reader: text(r.reader, 80),
    music: {
      gainDb: num(m.gainDb, -40, 0, -18),
      startOffsetSec: num(m.startOffsetSec, 0, 600, 0),
      tailSec: num(m.tailSec, 0, 10, 3),
      fadeInSec: num(m.fadeInSec, 0, 8, 2),
      fadeOutSec: num(m.fadeOutSec, 0, 8, 3),
    },
    ducking: {
      enabled: typeof d.enabled === "boolean" ? d.enabled : true,
      amountDb: num(d.amountDb, 0, 18, 8),
      attackMs: num(d.attackMs, 5, 500, 80),
      releaseMs: num(d.releaseMs, 50, 3000, 600),
    },
    alignmentOffsetMs: num(r.alignmentOffsetMs, -500, 500, 0),
    // Onaylı hedef: −16 LUFS / −1 dBTP. İstemci değiştirebilse de güvenli aralıkta kalır.
    loudness: { targetLufs: num(l.targetLufs, -23, -12, -16), truePeakDb: num(l.truePeakDb, -3, -0.5, -1) },
    ...(r.forVideo === true ? { forVideo: true } : {}),
  };
}
