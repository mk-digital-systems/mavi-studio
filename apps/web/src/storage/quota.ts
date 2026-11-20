export type StorageInfo = { usage: number; quota: number; persisted: boolean | null; known: boolean };

export async function storageInfo(): Promise<StorageInfo> {
  const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  return { usage: est?.usage ?? 0, quota: est?.quota ?? 0, persisted, known: !!est };
}
/** Tarayıcının veriyi kendiliğinden silmemesi için istenir; reddedilebilir. */
export async function requestPersist(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
export const mb = (b: number) => `${(b / 1e6).toFixed(b < 1e7 ? 1 : 0)} MB`;

/** 15 dakikalık bir kayıt ≈ 124 MB (48 kHz · 24-bit · mono). */
export const NEED_BYTES = 130e6;
export function spaceLevel(i: StorageInfo): "ok" | "low" | "blocked" {
  if (!i.known || !i.quota) return "ok";
  const free = i.quota - i.usage;
  return free < 30e6 ? "blocked" : free < NEED_BYTES ? "low" : "ok";
}
