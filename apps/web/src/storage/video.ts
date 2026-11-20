/** Video Editörü'nde kaydedilmiş proje sayısı (yalnızca sayı okunur; editörün veritabanına yazılmaz, yoksa oluşturulmaz). */
export async function countEditorVideos(): Promise<number | null> {
  try {
    const list = (await indexedDB.databases?.()) ?? null;
    if (!list) return null;
    if (!list.some((d) => d.name === "mavi-kadraj-film")) return 0;
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open("mavi-kadraj-film"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    if (!db.objectStoreNames.contains("kv")) { db.close(); return 0; }
    const ids = new Set<string>();
    await new Promise<void>((res, rej) => {
      const q = db.transaction("kv", "readonly").objectStore("kv").openKeyCursor();
      q.onsuccess = () => {
        const c = q.result;
        if (!c) return res();
        const m = /^(?:p|draft):(.+)$/.exec(String(c.key));
        if (m) ids.add(m[1]);
        c.continue();
      };
      q.onerror = () => rej(q.error);
    });
    db.close();
    return ids.size;
  } catch { return null; }
}
