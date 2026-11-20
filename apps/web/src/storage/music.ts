// Kullanıcının yüklediği fon müzikleri: yalnızca bu cihazda (IndexedDB), sunucuya gitmez.
// Katalog parçalarından (trk_0001) kimlik öneki ile ayrılır: loc_...
// Ham dosya için indirme yolu YOKTUR; dosya yalnızca uygulama içinde çalınır ve karıştırılır.
import { audioDb, req } from "./audioDb";

export type LocalTrack = {
  id: string; title: string; durationSec: number; size: number; createdAt: string;
  /** Sonradan eklendi: eski kayıtlarda yoktur (boş kabul edilir). */
  artist?: string; category?: string; note?: string;
};
export type TrackMeta = { title: string; artist: string; category: string; note: string };

export const isLocalTrack = (id: string | null | undefined): id is string => !!id && id.startsWith("loc_");
export const MAX_MUSIC_BYTES = 80 * 1024 * 1024;

/** Kabul edilen güvenli ses biçimleri (uzantı ve/veya MIME). Video, betik veya bilinmeyen türler reddedilir. */
const OK_EXT = ["mp3", "wav", "m4a", "ogg", "oga", "opus"];
const OK_MIME = /^audio\/(mpeg|mp3|wav|x-wav|wave|vnd\.wave|mp4|x-m4a|m4a|aac|ogg|opus)$/;
export function checkMusicFile(file: { name: string; type: string; size: number }): string | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!OK_EXT.includes(ext) && !OK_MIME.test(file.type)) return "Desteklenmeyen biçim. MP3, WAV, M4A veya OGG yükle.";
  if (file.type && !file.type.startsWith("audio/") && file.type !== "application/ogg") return "Bu dosya bir ses dosyası değil.";
  if (file.size === 0) return "Dosya boş.";
  if (file.size > MAX_MUSIC_BYTES) return "Dosya çok büyük (en fazla 80 MB).";
  return null;
}

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
export const cleanMeta = (m: Partial<TrackMeta>, fallbackTitle = "Fon müziği"): TrackMeta => ({
  title: clean(m.title, 80) || fallbackTitle, artist: clean(m.artist, 80), category: clean(m.category, 30), note: clean(m.note, 300),
});

const db = audioDb;

export async function listLocalTracks(): Promise<LocalTrack[]> {
  const t = (await db()).transaction("meta", "readonly");
  const all = await req(t.objectStore("meta").getAll() as IDBRequest<LocalTrack[]>);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLocalTrackBlob(id: string): Promise<Blob> {
  const t = (await db()).transaction("blobs", "readonly");
  const b = await req(t.objectStore("blobs").get(id) as IDBRequest<Blob | undefined>);
  if (!b) throw new Error("Fon müziği bulunamadı.");
  return b;
}

export async function addLocalTrack(file: File, meta?: Partial<TrackMeta>): Promise<LocalTrack> {
  const bad = checkMusicFile(file);
  if (bad) throw new Error(bad);
  // Çözülemeyen dosyayı baştan reddet; süreyi de buradan öğren.
  const ctx = new AudioContext();
  let durationSec: number;
  try { durationSec = (await ctx.decodeAudioData(await file.arrayBuffer())).duration; }
  catch { throw new Error("Bu dosya ses olarak açılamadı. MP3, WAV, M4A veya OGG dene."); }
  finally { void ctx.close(); }
  const m = cleanMeta(meta ?? {}, file.name.replace(/\.[^.]+$/, ""));
  const track: LocalTrack = {
    id: "loc_" + crypto.randomUUID(), ...m, durationSec, size: file.size, createdAt: new Date().toISOString(),
  };
  const d = await db();
  await new Promise<void>((res, rej) => {
    const t = d.transaction(["meta", "blobs"], "readwrite");
    t.objectStore("blobs").put(file, track.id);
    t.objectStore("meta").put(track);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
  return track;
}

export async function updateLocalTrack(id: string, meta: Partial<TrackMeta>) {
  const d = await db(), t = d.transaction("meta", "readwrite"), s = t.objectStore("meta");
  const cur = await req(s.get(id) as IDBRequest<LocalTrack | undefined>);
  if (cur) s.put({ ...cur, ...cleanMeta({ ...cur, ...meta }, cur.title) });
  await new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}

export async function deleteLocalTrack(id: string) {
  const d = await db();
  await new Promise<void>((res, rej) => {
    const t = d.transaction(["meta", "blobs"], "readwrite");
    t.objectStore("meta").delete(id);
    t.objectStore("blobs").delete(id);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
