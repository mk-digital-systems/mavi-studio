// Yayın akışları: sıralı bir program. İçerik KOPYALANMAZ; öğeler şiir / kayıtlı şiir / fon / efekt kimliğine bağlanır.
import { store, wrap } from "./db";

export type FlowKind = "live-poem" | "recorded" | "music" | "sfx" | "note" | "break" | "opening" | "closing";
export const FLOW_KINDS: { id: FlowKind; label: string }[] = [
  { id: "opening", label: "Açılış" }, { id: "live-poem", label: "Canlı okunacak şiir" }, { id: "recorded", label: "Kayıtlı şiir" },
  { id: "music", label: "Fon müziği" }, { id: "sfx", label: "Ses efekti" }, { id: "note", label: "Konuşma notu" },
  { id: "break", label: "Ara" }, { id: "closing", label: "Kapanış" },
];
export const flowKindLabel = (k: FlowKind) => FLOW_KINDS.find((x) => x.id === k)?.label ?? k;

export type FlowItem = {
  id: string; kind: FlowKind;
  /** Şiir (Project), kayıtlı şiir (Performance), fon (loc_) ya da efekt (sfx_) kimliği; not/ara için yok. */
  refId: string | null;
  label: string;
  /** Konuşma notu veya açılış/kapanış metni. */
  text: string;
};
export type Flow = { id: string; schemaVersion: 1; name: string; items: FlowItem[]; createdAt: string; updatedAt: string };

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").slice(0, max) : "");
const KINDS = FLOW_KINDS.map((k) => k.id);

export function sanitizeFlow(raw: unknown): Flow {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>, now = new Date().toISOString();
  const items = (Array.isArray(o.items) ? o.items : []).slice(0, 200).map((x): FlowItem | null => {
    const it = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (typeof it.kind !== "string" || !KINDS.includes(it.kind as FlowKind)) return null;
    return {
      id: typeof it.id === "string" && it.id ? it.id : crypto.randomUUID(), kind: it.kind as FlowKind,
      refId: typeof it.refId === "string" && it.refId ? it.refId.slice(0, 80) : null,
      label: clean(it.label, 120), text: clean(it.text, 2000),
    };
  }).filter((x): x is FlowItem => !!x);
  return {
    id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(), schemaVersion: 1,
    name: clean(o.name, 80).trim() || "Yeni akış", items,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : now, updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : now,
  };
}
export const newFlow = (name = "Yeni akış"): Flow => sanitizeFlow({ name });

/** Sürükle-bırak / yukarı-aşağı taşıma için saf işlev. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list]; const [x] = next.splice(from, 1); next.splice(to, 0, x); return next;
}

export async function listFlows(): Promise<Flow[]> {
  const { s } = await store("flows", "readonly");
  return (await wrap(s.getAll() as IDBRequest<unknown[]>)).map(sanitizeFlow).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function saveFlow(f: Flow) {
  const { s, done } = await store("flows", "readwrite");
  s.put({ ...sanitizeFlow(f), updatedAt: new Date().toISOString() });
  await done;
}
export async function deleteFlow(id: string) {
  const { s, done } = await store("flows", "readwrite");
  s.delete(id);
  await done;
}
