/** Yayın masasının saf (Web Audio'suz, test edilebilir) mantığı. */

export const dbToGain = (db: number) => Math.pow(10, db / 20);
export const gainToDb = (g: number) => 20 * Math.log10(Math.max(g, 1e-9));
/** Kaydırıcı (0–1) → kazanç. Kare eğrisi: küçük hareketlerde ince ayar, 1 = birim kazanç. */
export const sliderToGain = (v: number) => Math.min(1, Math.max(0, v)) ** 2;

export type DuckConfig = { enabled: boolean; amountDb: number; thresholdDb: number; holdMs: number };

/**
 * Konuşma önceliği: mikrofon veya kayıtlı şiir konuşurken fon müziğinin hedef kazancı.
 * Kısa duraklarda (nefes, dize arası) müzik hemen geri gelmesin diye `holdMs` boyunca konuşma sayılır.
 */
export class Ducker {
  private lastLoud = -Infinity;
  constructor(public cfg: DuckConfig) {}
  /** `speechDb`: konuşma kanallarının en yüksek seviyesi (dB). Dönüş: fon kanalına uygulanacak hedef kazanç (1 = kısma yok). */
  update(speechDb: number, nowMs: number): number {
    if (!this.cfg.enabled) return 1;
    if (speechDb >= this.cfg.thresholdDb) this.lastLoud = nowMs;
    return nowMs - this.lastLoud <= this.cfg.holdMs ? dbToGain(-this.cfg.amountDb) : 1;
  }
  get speaking() { return this.lastLoud > -Infinity; }
  reset() { this.lastLoud = -Infinity; }
}

/** Ana çıkış aşırı yükselirse (kırpılmaya yakın) bir süre sürekliyse uyarır; tek tepe uyarı sayılmaz. */
export class OverloadDetector {
  private since = -1;
  constructor(public limitDb = -1.5, public holdMs = 250) {}
  update(peakDb: number, nowMs: number): boolean {
    if (peakDb < this.limitDb) { this.since = -1; return false; }
    if (this.since < 0) this.since = nowMs;
    return nowMs - this.since >= this.holdMs;
  }
}

/** Fon/ses için yumuşak başlangıç-bitiş zarfı (0–1) — saf işlev, test edilebilir. */
export function envelope(t: number, duration: number, fadeIn: number, fadeOut: number): number {
  if (t < 0 || t > duration) return 0;
  const a = fadeIn > 0 ? Math.min(1, t / fadeIn) : 1, b = fadeOut > 0 ? Math.min(1, (duration - t) / fadeOut) : 1;
  return Math.max(0, Math.min(a, b));
}

/** Akış ilerletme: sıradaki öğenin dizini (son öğede kalır). */
export const nextIndex = (cur: number, len: number) => (len === 0 ? -1 : Math.min(len - 1, cur + 1));
export const prevIndex = (cur: number, len: number) => (len === 0 ? -1 : Math.max(0, cur - 1));
