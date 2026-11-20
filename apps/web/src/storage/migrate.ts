import type { Project, Take } from "@siir/contracts";
import { defaultFx, sanitizeFx } from "../audio/fx/settings";
import { sanitizeMix } from "../shared/mix";

/** Projeye özel okuma tercihi: yalnızca geçerli hızı korur (8–90), aksi halde hiç yok. */
export function sanitizeReading(raw: unknown): { speed?: number; fontScale?: number } | undefined {
  const o = (raw ?? {}) as { speed?: unknown; fontScale?: unknown };
  const speed = typeof o.speed === "number" && Number.isFinite(o.speed) ? Math.min(90, Math.max(8, o.speed)) : undefined;
  const fontScale = typeof o.fontScale === "number" && Number.isFinite(o.fontScale) ? Math.min(1.6, Math.max(0.8, o.fontScale)) : undefined;
  return speed === undefined && fontScale === undefined ? undefined : { ...(speed !== undefined ? { speed } : {}), ...(fontScale !== undefined ? { fontScale } : {}) };
}

/** Saf göç işlevleri (DOM/IndexedDB yok): eski kayıt → güncel şema. Eksik alanlar güvenli varsayılana döner. */
export function migrateProject(raw: unknown): Project {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
  const now = new Date().toISOString();
  return {
    id: str(o.id, crypto.randomUUID()),
    schemaVersion: 2,
    ownerId: typeof o.ownerId === "string" ? o.ownerId : null,
    anonymousSessionId: str(o.anonymousSessionId),
    title: str(o.title), text: str(o.text),
    trackId: typeof o.trackId === "string" ? o.trackId : null,
    primaryTakeId: typeof o.primaryTakeId === "string" ? o.primaryTakeId : null,
    fx: o.fx === undefined ? defaultFx() : sanitizeFx(o.fx), // v1'de alan yok → varsayılan
    mix: sanitizeMix(o.mix),
    ...(typeof o.category === "string" && o.category.trim() ? { category: o.category.trim().slice(0, 40) } : {}),
    ...(typeof o.readingNotes === "string" && o.readingNotes.trim() ? { readingNotes: o.readingNotes.slice(0, 2000) } : {}),
    ...(sanitizeReading(o.reading) ? { reading: sanitizeReading(o.reading) } : {}),                                  // sonradan eklendi → eksikse varsayılan
    status: o.status === "recorded" ? "recorded" : "draft",
    createdAt: str(o.createdAt, now), updatedAt: str(o.updatedAt, now),
  };
}

export function migrateTake(raw: unknown): Take {
  const t = { ...(raw as Take) };
  if (t.fx !== undefined) t.fx = sanitizeFx(t.fx);
  return t;
}

/** Denemeye özel ayar varsa o, yoksa çalışmanın varsayılanı. */
export const effectiveFx = (p: Project, t?: Take) => t?.fx ?? p.fx;
