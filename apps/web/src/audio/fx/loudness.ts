// ITU-R BS.1770-4 entegre ses yüksekliği (LUFS), 48 kHz. Akışlı: bloklar sırayla verilir, bellekte yalnızca 100 ms'lik enerjiler tutulur.
// Katsayılar standardın 48 kHz değerleridir; başka örnekleme hızında ölçüm yapılmaz (hata verir).
const S1 = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [1, -1.69065929318241, 0.73248077421585] }; // yüksek raf
const S2 = { b: [1, -2, 1], a: [1, -1.99004745483398, 0.99007225036621] };                                              // RLB high-pass

class Kw {
  private x1 = [0, 0]; private y1 = [0, 0]; // iki kademe için durum (DF1)
  private x2 = [0, 0]; private y2 = [0, 0];
  step(v: number) {
    const { b, a } = S1;
    const y = b[0] * v + b[1] * this.x1[0] + b[2] * this.x1[1] - a[1] * this.y1[0] - a[2] * this.y1[1];
    this.x1[1] = this.x1[0]; this.x1[0] = v; this.y1[1] = this.y1[0]; this.y1[0] = y;
    const c = S2.b, d = S2.a;
    const z = c[0] * y + c[1] * this.x2[0] + c[2] * this.x2[1] - d[1] * this.y2[0] - d[2] * this.y2[1];
    this.x2[1] = this.x2[0]; this.x2[0] = y; this.y2[1] = this.y2[0]; this.y2[0] = z;
    return z;
  }
}

export class LoudnessMeter {
  private kw: Kw[]; private hop: number; private acc = 0; private cnt = 0; private blocks: number[] = []; // her 100 ms: kanal enerjileri toplamı (ortalama kare)
  constructor(private fs: number, private channels: number) {
    if (fs !== 48000) throw new Error("Ses yüksekliği ölçümü yalnızca 48 kHz için.");
    this.kw = Array.from({ length: channels }, () => new Kw());
    this.hop = fs / 10; // 100 ms
  }
  /** Her kanal için eşit uzunlukta bloklar. */
  push(...chans: Float32Array[]) {
    const n = chans[0].length;
    for (let i = 0; i < n; i++) {
      let e = 0;
      for (let c = 0; c < this.channels; c++) { const z = this.kw[c].step(chans[c][i]); e += z * z; }
      this.acc += e;
      if (++this.cnt === this.hop) { this.blocks.push(this.acc / this.hop); this.acc = 0; this.cnt = 0; }
    }
  }
  /** Kapılı entegre yükseklik (LUFS); yeterli ses yoksa -Infinity. */
  integrated(): number {
    const b = this.blocks, win: number[] = [];
    for (let i = 0; i + 4 <= b.length; i++) win.push((b[i] + b[i + 1] + b[i + 2] + b[i + 3]) / 4); // 400 ms, %75 örtüşme
    const lk = (z: number) => -0.691 + 10 * Math.log10(z);
    const abs = win.filter((z) => z > 0 && lk(z) > -70);
    if (!abs.length) return -Infinity;
    const rel = lk(abs.reduce((a, z) => a + z, 0) / abs.length) - 10;
    const gated = abs.filter((z) => lk(z) > rel);
    return gated.length ? lk(gated.reduce((a, z) => a + z, 0) / gated.length) : -Infinity;
  }
}

/** Kısa diziler için kolay kullanım. */
export function measureLufs(fs: number, ...chans: Float32Array[]): number {
  const m = new LoudnessMeter(fs, chans.length); m.push(...chans); return m.integrated();
}
