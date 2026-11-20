// "Son kullanılan fonlar": yalnızca kimlik listesi (küçük tercih, localStorage). Ses/proje verisi burada değildir.
const KEY = "siir.recentMusic";

export function recentMusic(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^(trk_\d{4}|loc_[0-9a-f-]{36})$/.test(x)).slice(0, 8) : [];
  } catch { return []; }
}
export function noteMusicUsed(id: string | null) {
  if (!id) return;
  try { localStorage.setItem(KEY, JSON.stringify([id, ...recentMusic().filter((x) => x !== id)].slice(0, 8))); } catch { /* depolama kapalı: önemsiz */ }
}
