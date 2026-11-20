import type { PreviewSession } from "@siir/contracts";
import { claim, release } from "../shared/exclusive";
import { getLocalTrackBlob, isLocalTrack } from "../storage/music";

/** Fon müziği seviyesi (dB) → çalma sesi (0–1). Önizleme/kayıt dinlemesi için yaklaşık; kesin denge dışa aktarmada yapılır. */
export const volumeFor = (gainDb: number) => Math.min(1, Math.max(0.05, Math.pow(10, (gainDb + 6) / 20)));

/**
 * Fon müziği çalar. Katalog parçaları korumalı ön izleme oturumuyla (ham dosya tarayıcıya gelmez),
 * kullanıcının yüklediği parçalar cihazdaki kopyadan çalınır.
 */
export class PreviewPlayer {
  private el = new Audio();
  private blobUrl = "";
  private fade = 0;
  constructor() { this.el.loop = true; this.el.volume = 0.5; }
  /** `startSec`: parçanın kaçıncı saniyesinden başlasın (yüklenen parçalarda ve katalogda aynı). */
  async play(trackId: string, startSec = 0) {
    claim("music-preview", () => this.stop());
    clearInterval(this.fade);
    if (isLocalTrack(trackId)) {
      this.blobUrl = URL.createObjectURL(await getLocalTrackBlob(trackId));
      this.el.src = this.blobUrl;
    } else {
      const r = await fetch("/api/preview-session", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trackId }),
      });
      if (!r.ok) throw new Error("Ön izleme alınamadı.");
      this.el.src = ((await r.json()) as PreviewSession).url;
    }
    if (startSec > 0) {
      await new Promise<void>((res) => { if (this.el.readyState >= 1) res(); else this.el.addEventListener("loadedmetadata", () => res(), { once: true }); });
      const d = this.el.duration;
      this.el.currentTime = Number.isFinite(d) && d > 0 ? startSec % d : 0;
    }
    await this.el.play();
  }
  /** Duraklatma: konumu korur (kayıt duraklatılıp sürdürülürken müzik baştan başlamasın). */
  pause() { this.el.pause(); }
  async resume() { await this.el.play(); }
  setVolume(v: number) { this.el.volume = Math.min(1, Math.max(0, v)); }
  get volume() { return this.el.volume; }
  get playing() { return !this.el.paused && !!this.el.src; }
  /** Yumuşak bitirme: sesi kademeli kısıp durdurur. */
  fadeOut(ms = 2000) {
    clearInterval(this.fade);
    if (!this.playing) return;
    const v0 = this.el.volume, t0 = performance.now();
    this.fade = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      this.el.volume = v0 * (1 - k);
      if (k >= 1) { clearInterval(this.fade); this.stop(); this.el.volume = v0; }
    }, 50);
  }
  stop() {
    clearInterval(this.fade);
    release("music-preview"); this.el.pause(); this.el.removeAttribute("src"); this.el.load();
    if (this.blobUrl) { URL.revokeObjectURL(this.blobUrl); this.blobUrl = ""; }
  }
}
