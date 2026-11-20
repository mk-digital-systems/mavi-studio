// PCM yakalama + seviye ölçümü. Ana iş parçacığına ~0,25 sn'lik float32 blokları gönderir.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(12000); // 48 kHz'de 0,25 sn
    this.n = 0;
    this.peak = 0;
    this.sumSq = 0;
    this.active = false;
    this.port.onmessage = (e) => { if (e.data === "start") this.active = true; else { this.active = false; this.flush(); } };
  }
  flush() {
    if (this.n === 0) return;
    this.port.postMessage({ type: "chunk", data: this.buf.slice(0, this.n) }, []);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let pk = 0, sq = 0;
    for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > pk) pk = a; sq += ch[i] * ch[i]; }
    this.peak = Math.max(this.peak * 0.9, pk);
    this.sumSq += sq; this.cnt = (this.cnt || 0) + ch.length;
    if (this.cnt >= 2400) { // ~50 ms'de bir seviye
      this.port.postMessage({ type: "level", peak: pk, rms: Math.sqrt(this.sumSq / this.cnt) });
      this.sumSq = 0; this.cnt = 0;
    }
    if (this.active) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) this.flush();
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
