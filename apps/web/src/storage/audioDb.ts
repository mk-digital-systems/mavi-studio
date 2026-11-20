// Ses varlıkları (fon müzikleri, ses efektleri) için tek IndexedDB: "siir-music".
// v1: meta + blobs (fon müzikleri). v2: sfx + sfxBlobs (ses efektleri). Yükseltme yalnızca yeni depolar ekler.
const NAME = "siir-music";
let cached: Promise<IDBDatabase> | null = null;

export function audioDb(): Promise<IDBDatabase> {
  if (cached) return cached;
  cached = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 2);
    r.onupgradeneeded = (e) => {
      const db = r.result;
      switch (e.oldVersion) {
        case 0: { db.createObjectStore("meta", { keyPath: "id" }); db.createObjectStore("blobs"); }
        // eslint-disable-next-line no-fallthrough
        case 1: { db.createObjectStore("sfx", { keyPath: "id" }); db.createObjectStore("sfxBlobs"); }
      }
    };
    r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); cached = null; }; res(r.result); };
    r.onerror = () => { cached = null; rej(r.error); };
  });
  return cached;
}
export const req = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

/** "Tüm verileri sil" için. */
export async function deleteAudioDb() {
  if (cached) { (await cached).close(); cached = null; }
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase(NAME); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); });
}
