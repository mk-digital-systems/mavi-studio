// Ses efektleri kütüphanesi: ses dosyası IndexedDB'de (localStorage'da DEĞİL), yalnızca bu cihazda.
import { audioDb, req } from "./audioDb";
import { checkMusicFile } from "./music";

export const SFX_CATEGORIES = [
  "Alkış ve seyirci", "Yağmur ve fırtına", "Rüzgâr", "Deniz ve doğa", "Kalp atışı", "Zil ve çan", "Kapı ve adım", "Telefon",
  "Gerilim", "Sinematik geçiş", "Silah/patlama", "Komik efektler", "Açılış ve kapanış", "Özel efektler",
] as const;
export const SFX_ICONS: Record<string, string> = {
  "Alkış ve seyirci": "👏", "Yağmur ve fırtına": "🌧", "Rüzgâr": "🍃", "Deniz ve doğa": "🌊", "Kalp atışı": "❤", "Zil ve çan": "🔔",
  "Kapı ve adım": "🚪", "Telefon": "📞", "Gerilim": "😨", "Sinematik geçiş": "🎬", "Silah/patlama": "💥", "Komik efektler": "🤡",
  "Açılış ve kapanış": "🎭", "Özel efektler": "✨",
};
/** Yüksek sesli olabilecek kategoriler: daha düşük (güvenli) başlangıç seviyesiyle gelir. */
const LOUD = new Set(["Silah/patlama", "Alkış ve seyirci", "Gerilim", "Telefon", "Zil ve çan"]);
export const safeStartVolume = (category: string) => (LOUD.has(category) ? 0.35 : 0.6);

export type SfxItem = {
  id: string; name: string; category: string; durationSec: number;
  defaultVolume: number;      // 0–1
  fadeInSec: number; fadeOutSec: number;
  favorite: boolean;
  shortcut: string;           // tek tuş ("1", "a" …) ya da boş
  loop: boolean;              // tekrar çalma izni
  maxVoices: number;          // aynı anda en çok kaç kez çalabilir (1–4)
  source: string;             // kaynak
  license: string;            // lisans notu
  createdAt: string;
  size: number;
};

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const num = (v: unknown, a: number, b: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);

/** Her girdiyi (eski/bozuk kayıt dahil) güvenli SfxItem'a çevirir. Fırlatmaz. */
export function sanitizeSfx(raw: unknown): SfxItem {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const category = typeof o.category === "string" && (SFX_CATEGORIES as readonly string[]).includes(o.category) ? o.category : "Özel efektler";
  const key = clean(o.shortcut, 1).toLowerCase();
  return {
    id: typeof o.id === "string" && o.id ? o.id : "sfx_" + crypto.randomUUID(),
    name: clean(o.name, 60) || "Efekt", category,
    durationSec: num(o.durationSec, 0, 3600, 0),
    defaultVolume: num(o.defaultVolume, 0, 1, safeStartVolume(category)),
    fadeInSec: num(o.fadeInSec, 0, 5, 0), fadeOutSec: num(o.fadeOutSec, 0, 5, 0.05),
    favorite: o.favorite === true, shortcut: /^[a-z0-9]$/.test(key) ? key : "", loop: o.loop === true,
    maxVoices: Math.round(num(o.maxVoices, 1, 4, 1)),
    source: clean(o.source, 120), license: clean(o.license, 300),
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    size: num(o.size, 0, 1e9, 0),
  };
}

export const MAX_SFX_BYTES = 20 * 1024 * 1024;

export async function listSfx(): Promise<SfxItem[]> {
  const t = (await audioDb()).transaction("sfx", "readonly");
  const all = (await req(t.objectStore("sfx").getAll() as IDBRequest<unknown[]>)).map(sanitizeSfx);
  return all.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.category.localeCompare(b.category, "tr") || a.name.localeCompare(b.name, "tr"));
}
export async function getSfxBlob(id: string): Promise<Blob> {
  const t = (await audioDb()).transaction("sfxBlobs", "readonly");
  const b = await req(t.objectStore("sfxBlobs").get(id) as IDBRequest<Blob | undefined>);
  if (!b) throw new Error("Efekt dosyası bulunamadı.");
  return b;
}
export async function addSfx(file: File, meta: Partial<SfxItem>): Promise<SfxItem> {
  const bad = checkMusicFile(file);
  if (bad) throw new Error(bad);
  if (file.size > MAX_SFX_BYTES) throw new Error("Efekt dosyası çok büyük (en fazla 20 MB).");
  const ctx = new AudioContext();
  let durationSec: number;
  try { durationSec = (await ctx.decodeAudioData(await file.arrayBuffer())).duration; }
  catch { throw new Error("Bu dosya ses olarak açılamadı."); }
  finally { void ctx.close(); }
  const item = sanitizeSfx({ ...meta, id: undefined, name: meta.name || file.name.replace(/\.[^.]+$/, ""), durationSec, size: file.size, createdAt: new Date().toISOString() });
  const d = await audioDb();
  await new Promise<void>((res, rej) => {
    const t = d.transaction(["sfx", "sfxBlobs"], "readwrite");
    t.objectStore("sfxBlobs").put(file, item.id); t.objectStore("sfx").put(item);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
  return item;
}
export async function updateSfx(id: string, patch: Partial<SfxItem>) {
  const d = await audioDb(), t = d.transaction("sfx", "readwrite"), s = t.objectStore("sfx");
  const cur = await req(s.get(id) as IDBRequest<unknown>);
  if (cur) s.put(sanitizeSfx({ ...(cur as object), ...patch, id }));
  await new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
export async function deleteSfx(id: string) {
  const d = await audioDb();
  await new Promise<void>((res, rej) => {
    const t = d.transaction(["sfx", "sfxBlobs"], "readwrite");
    t.objectStore("sfx").delete(id); t.objectStore("sfxBlobs").delete(id);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
