import type { CaptionCue, LineTiming } from "@siir/contracts";

export type Speech = { startMs: number; endMs: number };
export type PoemLine = { id: string; text: string };

const dbOf = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));

/**
 * Ses etkinliği (konuşma bölümleri): 50 ms çerçeve RMS'inden. Eşik, gürültü tabanı ile konuşma düzeyi arasında
 * uyarlanır (%10 ve %90'lık dilimler); kısa boşluklar (<250 ms, nefes/ünsüz) birleştirilir, çok kısa patlamalar atılır.
 */
export function detectSpeech(frameRms: ArrayLike<number>, frameMs = 50): Speech[] {
  const n = frameRms.length;
  if (!n) return [];
  const db = Array.from({ length: n }, (_, i) => dbOf(frameRms[i]));
  const sorted = [...db].sort((a, b) => a - b);
  const floor = sorted[Math.floor(0.1 * (n - 1))], speech = sorted[Math.floor(0.9 * (n - 1))];
  if (speech - floor < 6 || speech < -58) return []; // belirgin konuşma yok (sessiz veya düz gürültü)
  const thr = Math.max(floor + 6, floor + 0.35 * (speech - floor));
  const segs: Speech[] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const on = i < n && db[i] >= thr;
    if (on && start < 0) start = i;
    if (!on && start >= 0) { segs.push({ startMs: start * frameMs, endMs: i * frameMs }); start = -1; }
  }
  const merged: Speech[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && s.startMs - last.endMs < 250) last.endMs = s.endMs; else merged.push({ ...s });
  }
  return merged.filter((s) => s.endMs - s.startMs >= 120);
}

/** Türkçe hece sayısı ≈ ünlü sayısı (her ünlü bir hece). En az 1. */
export function syllables(text: string): number {
  const m = text.toLocaleLowerCase("tr").match(/[aeıioöuüâîû]/g);
  return Math.max(1, m ? m.length : 0);
}

export type TimingOptions = {
  /** Tüm zamanlara eklenir: ses gecikmesi + kullanıcının elle kaydırması (ms). */
  offsetMs?: number;
  /** Bir cue, sonraki satıra kadar (en çok bu kadar) ekranda tutulur; daha uzun sessizlikte erken kapanır. */
  maxHoldMs?: number;
};

/**
 * Satır zamanları: konuşma süresi (duraklar hariç) satırların hece ağırlığına göre paylaştırılır; sonra gerçek zamana
 * (duraklar geri konarak) çevrilir. Böylece kıta arası uzun duraklar satırların süresini şişirmez.
 * Bu bir YAKLAŞIMDIR (hece oranı varsayımı); kullanıcı genel kaydırma ile düzeltebilir.
 */
export function computeLineTimings(lines: PoemLine[], speech: Speech[], opt: TimingOptions = {}): LineTiming[] {
  const offset = opt.offsetMs ?? 0, hold = opt.maxHoldMs ?? 1500;
  if (!lines.length || !speech.length) return [];
  const S = speech.reduce((a, s) => a + (s.endMs - s.startMs), 0);
  if (S <= 0) return [];
  const w = lines.map((l) => syllables(l.text)), W = w.reduce((a, b) => a + b, 0);
  /** Konuşma-zamanı (duraklar çıkarılmış) → gerçek zaman. `atEnd`: sınırda segmentin sonunu tercih et. */
  const real = (u: number, atEnd: boolean) => {
    let acc = 0;
    for (const s of speech) {
      const len = s.endMs - s.startMs;
      if (u < acc + len || (atEnd && u <= acc + len)) return s.startMs + (u - acc);
      acc += len;
    }
    return speech[speech.length - 1].endMs;
  };
  const out: LineTiming[] = [];
  let cum = 0;
  lines.forEach((l, i) => {
    const u0 = (cum / W) * S, u1 = ((cum + w[i]) / W) * S; cum += w[i];
    out.push({ lineId: l.id, startMs: Math.round(real(u0, false)), endMs: Math.round(real(u1, true)) });
  });
  // Cue'ları sonraki satırın başlangıcına kadar uzat (en çok `hold`), çakışmayı önle.
  out.forEach((t, i) => {
    const next = out[i + 1]?.startMs;
    t.endMs = next === undefined ? t.endMs + 800 : Math.min(Math.max(t.endMs, next - 30), t.endMs + hold);
    if (next !== undefined && t.endMs > next) t.endMs = Math.max(t.startMs + 200, next - 30);
  });
  return out.map((t) => ({ ...t, startMs: Math.max(0, t.startMs + offset), endMs: Math.max(0, t.endMs + offset) }));
}

/** Her satır bir altyazı (cue). */
export function toCaptions(lines: PoemLine[], timings: LineTiming[]): CaptionCue[] {
  const byId = new Map(lines.map((l) => [l.id, l.text]));
  return timings.filter((t) => byId.has(t.lineId) && t.endMs > t.startMs).map((t) => ({ startMs: t.startMs, endMs: t.endMs, text: byId.get(t.lineId)!, lineIds: [t.lineId] }));
}
