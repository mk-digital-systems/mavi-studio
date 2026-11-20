// Kullanıcının yüklediği fon müzikleri: yalnızca bu cihazda (IndexedDB), sunucuya gitmez.
// Katalog parçalarından (trk_0001) kimlik öneki ile ayrılır: loc_...
const NAME = "siir-music";

export type LocalTrack = { id: string; title: string; durationSec: number; size: number; createdAt: string };
export const isLocalTrack = (id: string | null | undefined): id is string => !!id && id.startsWith("loc_");
export const MAX_MUSIC_BYTES = 80 * 1024 * 1024;

let cached: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (cached) return cached;
  cached = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("meta", { keyPath: "id" }); r.result.createObjectStore("blobs"); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { cached = null; rej(r.error); };
  });
  return cached;
}
const req = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

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

export async function addLocalTrack(file: File): Promise<LocalTrack> {
  if (file.size > MAX_MUSIC_BYTES) throw new Error("Dosya çok büyük (en fazla 80 MB).");
  // Çözülemeyen dosyayı baştan reddet; süreyi de buradan öğren.
  const ctx = new AudioContext();
  let durationSec: number;
  try { durationSec = (await ctx.decodeAudioData(await file.arrayBuffer())).duration; }
  catch { throw new Error("Bu dosya ses olarak açılamadı. MP3, WAV, M4A veya OGG dene."); }
  finally { void ctx.close(); }
  const track: LocalTrack = {
    id: "loc_" + crypto.randomUUID(), title: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Fon müziği",
    durationSec, size: file.size, createdAt: new Date().toISOString(),
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

export async function deleteLocalTrack(id: string) {
  const d = await db();
  await new Promise<void>((res, rej) => {
    const t = d.transaction(["meta", "blobs"], "readwrite");
    t.objectStore("meta").delete(id);
    t.objectStore("blobs").delete(id);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
