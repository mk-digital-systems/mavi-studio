import type { PreviewSession } from "@siir/contracts";
import { claim, release } from "../shared/exclusive";

/**
 * Korumalı ön izleme: her çalma için sunucudan kısa ömürlü oturum alınır.
 * Ham müzik dosyası hiçbir zaman tarayıcıya gelmez; yalnızca düşük kaliteli ön izleme.
 */
export class PreviewPlayer {
  private el = new Audio();
  constructor() { this.el.loop = true; this.el.volume = 0.5; }
  async play(trackId: string) {
    claim("music-preview", () => this.stop());
    const r = await fetch("/api/preview-session", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trackId }),
    });
    if (!r.ok) throw new Error("Ön izleme alınamadı.");
    const s = (await r.json()) as PreviewSession;
    this.el.src = s.url;
    await this.el.play();
  }
  setVolume(v: number) { this.el.volume = v; }
  stop() { release("music-preview"); this.el.pause(); this.el.removeAttribute("src"); this.el.load(); }
}
