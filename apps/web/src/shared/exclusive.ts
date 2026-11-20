// Aynı anda yalnızca bir sesin çalmasını sağlar (fon ön izleme, efekt oynatıcı, deneme oynatıcıları).
type Entry = { id: string; stop: () => void };
let current: Entry | null = null;

/** `id` çalmaya başlamadan önce çağrılır; çalan başka bir kaynak varsa durdurulur. */
export function claim(id: string, stop: () => void) {
  if (current && current.id !== id) {
    const prev = current; current = null;
    try { prev.stop(); } catch { /* durdurma hatası yenisini engellemesin */ }
  }
  current = { id, stop };
}
export function release(id: string) { if (current?.id === id) current = null; }
export const activeId = () => current?.id ?? null;
