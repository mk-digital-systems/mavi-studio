import type { ApiError, ExportBundle, VideoCreated, VideoSpec, VideoStatus } from "@siir/contracts";
import { ApiFail, friendly } from "../export/client";

/** Video hata kodları → Türkçe; bilinmeyenler dışa aktarma eşlemesine düşer. */
function msg(code: string, fallback: string, retry = 0): string {
  switch (code) {
    case "license": return "Seçtiğin fon müziğinin lisansı sosyal medya videosuna izin vermiyor.";
    case "bundle-mismatch": return "Video paketi dışa aktarılan sesle uyuşmuyor. Sesi yeniden dışa aktar.";
    case "gone": return "Ses dosyasının süresi doldu ve sunucudan silindi. Yeniden dışa aktar.";
    case "bad-ref": return "Ses başvurusu geçersiz. Sesi yeniden dışa aktar.";
    case "too-long": return "Video için ses çok uzun (en fazla 10 dakika).";
    case "daily-limit": return `Bugünkü video hakkın doldu. Yaklaşık ${Math.ceil(retry / 3600)} saat sonra tekrar dene.`;
    case "busy": return "Devam eden bir video işin var. Bitmesini bekle.";
    case "render-failed": return "Video hazırlanamadı. Lütfen tekrar dene.";
    case "expired": return "Videonun süresi doldu ve sunucudan silindi. Yeniden oluştur.";
    default: return friendly(code, fallback, retry);
  }
}

async function json<T>(r: Response): Promise<T> {
  let b: unknown = null;
  try { b = await r.json(); } catch { /* gövde yok */ }
  if (!r.ok) { const e = (b ?? {}) as Partial<ApiError>; throw new ApiFail(e.code ?? "http-" + r.status, msg(e.code ?? "", e.error ?? "", e.retryAfterSec ?? 0), e.retryAfterSec ?? 0, r.status); }
  return b as T;
}
const net = (e: unknown): never => { throw e instanceof ApiFail ? e : new ApiFail("network", friendly("network", "")); };

export async function createVideoJob(bundle: ExportBundle, spec: VideoSpec, session: string): Promise<VideoCreated> {
  try {
    return await json<VideoCreated>(await fetch("/api/video/jobs", { method: "POST", headers: { "content-type": "application/json", "x-siir-session": session }, body: JSON.stringify({ bundle, spec }) }));
  } catch (e) { return net(e); }
}
export async function getVideoStatus(id: string, session: string): Promise<VideoStatus> {
  try { return await json<VideoStatus>(await fetch(`/api/video/jobs/${id}`, { headers: { "x-siir-session": session }, cache: "no-store" })); } catch (e) { return net(e); }
}
export async function waitForVideo(id: string, session: string, onState: (s: VideoStatus) => void, signal: AbortSignal, everyMs = 1000): Promise<VideoStatus> {
  for (;;) {
    if (signal.aborted) throw new DOMException("iptal", "AbortError");
    const s = await getVideoStatus(id, session);
    onState(s);
    if (s.state === "completed" || s.state === "failed") return s;
    await new Promise((r) => setTimeout(r, everyMs));
  }
}
export { msg as videoMessage };
