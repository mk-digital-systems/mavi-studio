import type { ExportRecipe, MixSettings, Project } from "@siir/contracts";

export const defaultMix = (): MixSettings => ({
  format: "wav", poet: "", reader: "",
  music: { gainDb: -18, startOffsetSec: 0, tailSec: 3, fadeInSec: 2, fadeOutSec: 3 },
  ducking: { enabled: true, amountDb: 8, attackMs: 80, releaseMs: 600 },
  alignmentOffsetMs: 0,
});

const num = (v: unknown, min: number, max: number, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const txt = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

/** Her girdiyi güvenli MixSettings'e çevirir; sunucunun doğrulamasıyla aynı aralıklar. Fırlatmaz. */
export function sanitizeMix(raw: unknown): MixSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>, d = defaultMix();
  const m = o.music ?? {}, k = o.ducking ?? {};
  return {
    format: o.format === "mp3" ? "mp3" : "wav", poet: txt(o.poet, 80), reader: txt(o.reader, 80),
    music: {
      gainDb: num(m.gainDb, -40, 0, d.music.gainDb), startOffsetSec: num(m.startOffsetSec, 0, 600, d.music.startOffsetSec),
      tailSec: num(m.tailSec, 0, 10, d.music.tailSec), fadeInSec: num(m.fadeInSec, 0, 8, d.music.fadeInSec), fadeOutSec: num(m.fadeOutSec, 0, 8, d.music.fadeOutSec),
    },
    ducking: {
      enabled: typeof k.enabled === "boolean" ? k.enabled : d.ducking.enabled, amountDb: num(k.amountDb, 0, 18, d.ducking.amountDb),
      attackMs: num(k.attackMs, 5, 500, d.ducking.attackMs), releaseMs: num(k.releaseMs, 50, 3000, d.ducking.releaseMs),
    },
    alignmentOffsetMs: num(o.alignmentOffsetMs, -500, 500, 0),
  };
}

/** Sunucuya gidecek tarif: yalnızca ayarlar; ses/müzik dosyası yok. */
export function toRecipe(p: Pick<Project, "title" | "trackId">, mix: MixSettings, opt: { forVideo?: boolean } = {}): ExportRecipe {
  return {
    format: mix.format, trackId: p.trackId, title: p.title, poet: mix.poet, reader: mix.reader,
    music: mix.music, ducking: mix.ducking, alignmentOffsetMs: mix.alignmentOffsetMs,
    loudness: { targetLufs: -16, truePeakDb: -1 },
    ...(opt.forVideo ? { forVideo: true } : {}),
  };
}
