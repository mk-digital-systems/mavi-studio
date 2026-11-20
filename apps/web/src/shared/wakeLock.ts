// Kayıt ve dışa aktarma sırasında ekranın kapanmasını önler (destekleyen tarayıcılarda).
// Desteklenmiyorsa sessizce devre dışı kalır; kullanıcıya "ekranı açık tut" uyarısı gösterilir.
type SentinelLike = { release(): Promise<void>; addEventListener(t: "release", f: () => void): void };
type WakeApi = { request(type: "screen"): Promise<SentinelLike> };
type DocLike = { visibilityState: string; addEventListener(t: "visibilitychange", f: () => void): void; removeEventListener(t: "visibilitychange", f: () => void): void };

export class WakeLockGuard {
  private sentinel: SentinelLike | null = null;
  private want = false;
  private onVis = () => { if (this.doc?.visibilityState === "visible" && this.want && !this.sentinel) void this.request(); };

  constructor(private api: WakeApi | undefined = (typeof navigator !== "undefined" ? (navigator as unknown as { wakeLock?: WakeApi }).wakeLock : undefined),
    private doc: DocLike | undefined = typeof document !== "undefined" ? document : undefined) {}

  get supported() { return !!this.api; }
  get active() { return !!this.sentinel; }

  private async request(): Promise<boolean> {
    if (!this.api) return false;
    try {
      const s = await this.api.request("screen");
      if (!this.want) { void s.release().catch(() => {}); return false; } // bu arada bırakıldı
      this.sentinel = s;
      s.addEventListener("release", () => { if (this.sentinel === s) this.sentinel = null; });
      return true;
    } catch { return false; } // düşük pil / izin yok
  }
  /** Kilidi ister; sekme gizlenip dönünce (tarayıcı kilidi bıraktığı için) yeniden alır. */
  async acquire(): Promise<boolean> {
    if (!this.want) this.doc?.addEventListener("visibilitychange", this.onVis);
    this.want = true;
    return this.sentinel ? true : this.request();
  }
  release() {
    this.want = false;
    this.doc?.removeEventListener("visibilitychange", this.onVis);
    const s = this.sentinel; this.sentinel = null;
    if (s) void s.release().catch(() => {});
  }
}
export const wakeLock = new WakeLockGuard();
