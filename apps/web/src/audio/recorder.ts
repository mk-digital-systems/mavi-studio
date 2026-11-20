import { f32To24 } from "./wav";

export const MAX_MS = 15 * 60 * 1000;
export const supported = () =>
  typeof navigator.mediaDevices?.getUserMedia === "function" &&
  typeof window.AudioContext === "function" &&
  typeof window.AudioWorkletNode === "function";

export type RecResult = {
  durationMs: number; sampleRate: number; chunkCount: number; peakDbfs: number; clipped: boolean;
  reason: "user" | "limit" | "device" | "storage";
};

/**
 * Ham, işlemsiz (EC/NS/AGC kapalı) 48 kHz mono yakalama; 24-bit paketli parçalar.
 * Aşama 2: parçalar bellekte BİRİKMEZ; `sink` ile (IndexedDB) hemen yazılır.
 */
export class MicRecorder {
  private ctx?: AudioContext;
  private stream?: MediaStream;
  private node?: AudioWorkletNode;
  private src?: MediaStreamAudioSourceNode;
  private mon?: GainNode;
  private seq = 0;
  private samples = 0;
  private peak = 0;
  private clipped = false;
  private recording = false;
  private limitTimer?: number;
  private inFlight = new Set<Promise<void>>();
  private failed = false;
  private finishing = false;

  /** Parça yazıcı; hata fırlatırsa kayıt "storage" nedeniyle güvenle bitirilir. */
  sink: (bytes: Uint8Array, seq: number) => Promise<void> = async () => {};
  onLevel: (peakDb: number, clip: boolean) => void = () => {};
  onEnd: (r: RecResult) => void = () => {};
  /** Kayıt sürerken AudioContext çalışmaz hale gelirse (arka plan, çağrı, kilit ekranı). */
  onStateChange: (state: string) => void = () => {};

  async open(deviceId?: string) {
    this.close();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        channelCount: 1, sampleRate: 48000,
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      },
    });
    this.stream.getAudioTracks()[0].addEventListener("ended", () => {
      if (this.recording) this.finish("device");
    });
    // 48 kHz istenir; desteklemeyen tarayıcı varsayılan hızı verir (kayıt o hızda saklanır, dışa aktarmada 48 kHz'e çevrilir).
    try { this.ctx = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" }); }
    catch { this.ctx = new AudioContext({ latencyHint: "interactive" }); }
    // iOS Safari kesintide "interrupted", diğerleri "suspended" olur: kayıt sürerken çalışmıyorsa bildir.
    this.ctx.onstatechange = () => { if (this.recording) this.onStateChange(this.ctx?.state ?? "closed"); };
    await this.ctx.audioWorklet.addModule("/pcm-worklet.js");
    const src = this.src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "pcm-capture", { numberOfOutputs: 0 });
    src.connect(this.node);
    // Canlı dinleme her açılışta KAPALI başlar (yeni bağlam, bağlı değil).
    this.node.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === "level") {
        const db = m.peak > 0 ? 20 * Math.log10(m.peak) : -120;
        if (this.recording) {
          this.peak = Math.max(this.peak, m.peak);
          if (db > -1) this.clipped = true;
        }
        this.onLevel(db, db > -1);
      } else if (m.type === "chunk" && this.recording) {
        this.samples += m.data.length;
        const p: Promise<void> = this.sink(f32To24(m.data), this.seq++)
          .catch(() => { if (!this.failed) { this.failed = true; this.finish("storage"); } })
          .finally(() => this.inFlight.delete(p));
        this.inFlight.add(p);
      }
    };
  }
  /** Canlı dinleme (işlenmemiş ses, kulaklık gerekir). Varsayılan kapalı; kayda girmez. */
  setMonitor(on: boolean) {
    if (!this.ctx || !this.src) return;
    if (on && !this.mon) { this.mon = this.ctx.createGain(); this.mon.gain.value = 0.8; this.src.connect(this.mon); this.mon.connect(this.ctx.destination); }
    if (!on && this.mon) { try { this.src.disconnect(this.mon); this.mon.disconnect(); } catch { /* */ } this.mon = undefined; }
  }
  get monitoring() { return !!this.mon; }
  get sampleRate() { return this.ctx?.sampleRate ?? 48000; }
  get contextState(): string { return this.ctx?.state ?? "closed"; }
  /** Kesinti sonrası bağlamı sürdürmeyi dener (kullanıcı hareketi gerekebilir). */
  async resumeContext() { try { if (this.ctx && this.ctx.state !== "running") await this.ctx.resume(); } catch { /* kullanıcı hareketi gerekir */ } return this.contextState === "running"; }
  get deviceId() { return this.stream?.getAudioTracks()[0]?.getSettings().deviceId; }
  get isOpen() { return !!this.stream; }
  get elapsedMs() { return this.ctx ? (this.samples / this.ctx.sampleRate) * 1000 : 0; }

  async start() {
    await this.ctx!.resume();
    this.seq = 0; this.samples = 0; this.peak = 0; this.clipped = false; this.failed = false; this.finishing = false;
    this.recording = true;
    this.node!.port.postMessage("start");
    this.limitTimer = window.setInterval(() => {
      if (this.elapsedMs >= MAX_MS) this.finish("limit");
    }, 500);
  }
  pause() { this.node?.port.postMessage("pause"); }
  resume() { this.node?.port.postMessage("start"); }
  stop() { if (this.recording) this.finish("user"); }

  private finish(reason: RecResult["reason"]) {
    if (!this.recording || this.finishing) return;
    this.finishing = true;
    // Son parçanın alınması için `recording` kısa süre açık kalır (flush mesajı gelsin).
    clearInterval(this.limitTimer);
    this.node?.port.postMessage("flush");
    setTimeout(async () => {
      this.recording = false;
      await Promise.allSettled([...this.inFlight]);
      const sr = this.ctx?.sampleRate ?? 48000;
      const r: RecResult = {
        durationMs: (this.samples / sr) * 1000, sampleRate: sr, chunkCount: this.seq,
        peakDbfs: this.peak > 0 ? 20 * Math.log10(this.peak) : -120, clipped: this.clipped, reason,
      };
      this.close();
      this.onEnd(r);
    }, 150);
  }
  close() {
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = this.ctx = this.node = this.src = this.mon = undefined;
  }
}
