// Cloudflare Turnstile (bot koruması). YALNIZCA VITE_TURNSTILE_SITEKEY tanımlıysa devreye girer.
// Not: Bu kod gerçek bir site anahtarıyla henüz denenmedi (anahtar yok). Sunucu tarafı doğrulaması test edildi.
type TsApi = { render(el: HTMLElement, o: Record<string, unknown>): string; remove(id: string): void };
declare global { interface Window { turnstile?: TsApi } }

let loading: Promise<void> | null = null;
const load = () => (loading ??= new Promise<void>((res, rej) => {
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error("Doğrulama yüklenemedi."));
  document.head.appendChild(s);
}));

/** Anahtar yoksa `undefined` (geliştirme). Varsa görünmez widget ile tek kullanımlık belirteç alır. */
export async function getBotToken(): Promise<string | undefined> {
  const key = import.meta.env.VITE_TURNSTILE_SITEKEY;
  if (!key) return undefined;
  await load();
  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;bottom:8px;right:8px;z-index:50";
    document.body.appendChild(host);
    const done = (fn: () => void) => { try { window.turnstile?.remove(id); } catch { /* */ } host.remove(); fn(); };
    const id = window.turnstile!.render(host, {
      sitekey: key, size: "flexible", appearance: "interaction-only",
      callback: (t: string) => done(() => resolve(t)),
      "error-callback": () => done(() => reject(new Error("Doğrulama başarısız."))),
    });
  });
}
