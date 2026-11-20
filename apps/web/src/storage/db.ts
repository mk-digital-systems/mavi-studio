// IndexedDB bağlantısı ve şema sürümleme. Kütüphanesiz.
const NAME = "siir-studio";
const VERSION = 1;

let cached: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (cached) return cached;
  cached = new Promise((resolve, reject) => {
    const r = indexedDB.open(NAME, VERSION);
    r.onupgradeneeded = (e) => {
      const db = r.result;
      // Her sürüm için ayrı adım: yeni sürüm eklenince yalnızca yeni case yazılır.
      switch (e.oldVersion) {
        case 0: {
          db.createObjectStore("projects", { keyPath: "id" });
          const takes = db.createObjectStore("takes", { keyPath: "id" });
          takes.createIndex("projectId", "projectId");
          db.createObjectStore("audioChunks"); // anahtar: [takeId, seq]
        }
      }
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => { r.result.close(); cached = null; };
      resolve(r.result);
    };
    r.onerror = () => { cached = null; reject(r.error); };
    r.onblocked = () => reject(new Error("Veritabanı başka bir sekme tarafından kilitli."));
  });
  return cached;
}

export const wrap = <T>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

/** Tek depoda tek işlem. */
export async function store(name: "projects" | "takes" | "audioChunks", mode: IDBTransactionMode) {
  const db = await openDb();
  const t = db.transaction(name, mode);
  const done = new Promise<void>((res, rej) => {
    t.oncomplete = () => res();
    t.onabort = () => rej(t.error);
    t.onerror = () => rej(t.error);
  });
  return { s: t.objectStore(name), done };
}

export async function deleteWholeDatabase() {
  if (cached) { (await cached).close(); cached = null; }
  await new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase(NAME);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
    r.onblocked = () => res();
  });
}
