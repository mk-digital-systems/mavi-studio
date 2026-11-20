import type { ApiError, ExportCreated, ExportRecipe, ExportStatus } from "@siir/contracts";

export class ApiFail extends Error {
  constructor(public code: string, message: string, public retryAfterSec = 0, public status = 0) { super(message); }
}

const hm = (sec: number) => { const h = Math.floor(sec / 3600), m = Math.ceil((sec % 3600) / 60); return h ? `${h} saat ${m} dk` : `${m} dk`; };

/** Sunucu hata kodlarını kullanıcıya anlaşılır Türkçe mesaja çevirir. */
export function friendly(code: string, fallback: string, retryAfterSec = 0): string {
  switch (code) {
    case "daily-limit": return `Bugünkü dışa aktarma hakkın doldu. Yaklaşık ${hm(retryAfterSec)} sonra tekrar deneyebilirsin.`;
    case "rate-limit": return "Çok fazla istek gönderildi. Bir dakika bekleyip tekrar dene.";
    case "busy": return "Devam eden bir dışa aktarman var. Bitmesini bekle.";
    case "bot-check": return "Güvenlik doğrulaması başarısız oldu. Sayfayı yenileyip tekrar dene.";
    case "silent": return "Kayıt neredeyse sessiz; dışa aktarma yapılamadı. Mikrofonu kontrol edip yeniden kaydet.";
    case "too-large": return "Ses dosyası çok büyük. Daha kısa bir kayıtla dene.";
    case "too-long": return "Kayıt çok uzun (en fazla 15 dakika).";
    case "bad-track": return "Seçtiğin fon müziği artık kullanılamıyor. Başka bir fon seç.";
    case "expired": return "Dosyanın süresi doldu ve sunucudan silindi. Yeniden dışa aktar.";
    case "upload-timeout": return "Yükleme süresi doldu. Yeniden dene.";
    case "mix-failed": return "Miks sırasında bir sorun oluştu. Lütfen tekrar dene.";
    case "network": return "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.";
    default: return fallback || "Beklenmeyen bir hata oluştu.";
  }
}

async function json<T>(r: Response): Promise<T> {
  let b: unknown = null;
  try { b = await r.json(); } catch { /* gövde yok */ }
  if (!r.ok) {
    const e = (b ?? {}) as Partial<ApiError>;
    throw new ApiFail(e.code ?? "http-" + r.status, friendly(e.code ?? "", e.error ?? "", e.retryAfterSec ?? 0), e.retryAfterSec ?? 0, r.status);
  }
  return b as T;
}
const net = (e: unknown): never => { throw e instanceof ApiFail ? e : new ApiFail("network", friendly("network", "")); };

export async function createJob(recipe: ExportRecipe, session: string, bot?: string): Promise<ExportCreated> {
  try {
    return await json<ExportCreated>(await fetch("/api/exports", {
      method: "POST", headers: { "content-type": "application/json", "x-siir-session": session, ...(bot ? { "x-turnstile-token": bot } : {}) },
      body: JSON.stringify({ recipe }),
    }));
  } catch (e) { return net(e); }
}

/** XHR: yükleme ilerlemesi için. İptal edilebilir. */
export function uploadVoice(c: ExportCreated, session: string, blob: Blob, onProgress: (f: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (blob.size > c.maxUploadBytes) return reject(new ApiFail("too-large", friendly("too-large", "")));
    const x = new XMLHttpRequest();
    x.open("PUT", c.uploadUrl);
    x.setRequestHeader("content-type", "audio/wav");
    x.setRequestHeader("x-siir-session", session);
    x.setRequestHeader("x-upload-token", c.uploadToken);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onerror = () => reject(new ApiFail("network", friendly("network", "")));
    x.onabort = () => reject(new DOMException("iptal", "AbortError"));
    x.onload = () => {
      if (x.status === 202) return resolve();
      let e: Partial<ApiError> = {};
      try { e = JSON.parse(x.responseText); } catch { /* */ }
      reject(new ApiFail(e.code ?? "http-" + x.status, friendly(e.code ?? "", e.error ?? ""), 0, x.status));
    };
    signal.addEventListener("abort", () => x.abort(), { once: true });
    x.send(blob);
  });
}

export async function getStatus(jobId: string, session: string): Promise<ExportStatus> {
  try { return await json<ExportStatus>(await fetch(`/api/exports/${jobId}`, { headers: { "x-siir-session": session }, cache: "no-store" })); }
  catch (e) { return net(e); }
}

/** Tamamlanana ya da başarısız olana kadar sorgular. */
export async function waitForJob(jobId: string, session: string, onState: (s: ExportStatus) => void, signal: AbortSignal, everyMs = 1000): Promise<ExportStatus> {
  for (;;) {
    if (signal.aborted) throw new DOMException("iptal", "AbortError");
    const s = await getStatus(jobId, session);
    onState(s);
    if (s.state === "completed" || s.state === "failed") return s;
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

/** Dosyayı indirir (imzalı adres; içerik-yerleşimi attachment). */
export function startDownload(url: string, name?: string) {
  const a = document.createElement("a");
  a.href = url; if (name) a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
}
