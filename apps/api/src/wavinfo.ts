import { closeSync, openSync, readSync, statSync } from "node:fs";

export type WavInfo = { channels: number; sampleRate: number; bits: number; format: "pcm" | "float"; dataBytes: number; durationSec: number; dataStart: number };

export class WavError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/**
 * Yüklenen dosyanın gerçekten uygun bir WAV olduğunu başlıktan doğrular (güvenilmeyen girdi).
 * Yalnızca PCM 16/24/32-bit veya float32, 1–2 kanal, 48 kHz kabul edilir. Başka biçim reddedilir.
 */
export function inspectWav(file: string, maxDurationSec: number): WavInfo {
  const size = statSync(file).size;
  const fd = openSync(file, "r");
  try {
    const head = Buffer.alloc(Math.min(size, 4096));
    readSync(fd, head, 0, head.length, 0);
    if (head.length < 44 || head.toString("ascii", 0, 4) !== "RIFF" || head.toString("ascii", 8, 12) !== "WAVE")
      throw new WavError("not-wav", "Dosya geçerli bir WAV değil.");
    let off = 12, fmt: { tag: number; ch: number; sr: number; bits: number } | null = null, dataBytes = -1, dataStart = -1;
    while (off + 8 <= head.length) {
      const id = head.toString("ascii", off, off + 4), len = head.readUInt32LE(off + 4);
      if (id === "fmt ") {
        if (len < 16 || off + 8 + 16 > head.length) throw new WavError("bad-fmt", "WAV başlığı bozuk.");
        let tag = head.readUInt16LE(off + 8);
        const ch = head.readUInt16LE(off + 10), sr = head.readUInt32LE(off + 12), bits = head.readUInt16LE(off + 22);
        if (tag === 0xfffe && len >= 26) tag = head.readUInt16LE(off + 8 + 24); // WAVE_FORMAT_EXTENSIBLE alt biçimi
        fmt = { tag, ch, sr, bits };
      } else if (id === "data") { dataBytes = len; dataStart = off + 8; break; }
      off += 8 + len + (len % 2);
    }
    if (!fmt || dataStart < 0) throw new WavError("bad-wav", "WAV başlığı eksik.");
    const isPcm = fmt.tag === 1 && [16, 24, 32].includes(fmt.bits), isFloat = fmt.tag === 3 && fmt.bits === 32;
    if (!isPcm && !isFloat) throw new WavError("bad-format", "Desteklenmeyen ses biçimi (PCM 16/24/32-bit veya float32 olmalı).");
    if (fmt.ch < 1 || fmt.ch > 2) throw new WavError("bad-channels", "Yalnızca mono veya stereo ses kabul edilir.");
    if (fmt.sr !== 48000) throw new WavError("bad-rate", "Örnekleme hızı 48 kHz olmalı.");
    const avail = size - dataStart;
    // Akış sırasında yazılmış (0 / 0xFFFFFFFF) uzunluklar olabilir; gerçek dosya boyutuna güven.
    const real = dataBytes <= 0 || dataBytes > avail ? avail : dataBytes;
    const frame = (fmt.bits / 8) * fmt.ch;
    if (real <= 0 || real % frame !== 0 && real - (real % frame) <= 0) throw new WavError("empty", "Ses verisi boş.");
    const frames = Math.floor(real / frame), durationSec = frames / fmt.sr;
    if (durationSec < 1) throw new WavError("too-short", "Kayıt çok kısa.");
    if (durationSec > maxDurationSec) throw new WavError("too-long", `Kayıt çok uzun (en fazla ${Math.round(maxDurationSec / 60)} dakika).`);
    return { channels: fmt.ch, sampleRate: fmt.sr, bits: fmt.bits, format: isFloat ? "float" : "pcm", dataBytes: frames * frame, durationSec, dataStart };
  } finally { closeSync(fd); }
}

/**
 * Konuşma düzeyi: 50 ms çerçevelerin RMS'inin %90'ı (dBFS). Ducking eşiğini ses düzeyine göre ayarlamak için.
 * Dosya dilimlerle okunur; bellekte yalnızca çerçeve RMS'leri tutulur.
 */
export function speechLevelDb(file: string, info: WavInfo): number {
  const fd = openSync(file, "r");
  try {
    const end = info.dataStart + info.dataBytes;
    const bps = info.bits / 8, frame = bps * info.channels, fpf = 2400; // 50 ms @ 48k
    const frames: number[] = [];
    const buf = Buffer.alloc(frame * fpf * 40);
    let pos = info.dataStart, acc = 0, cnt = 0;
    while (pos < end) {
      const n = readSync(fd, buf, 0, Math.min(buf.length, end - pos), pos);
      if (n <= 0) break;
      pos += n;
      for (let o = 0; o + frame <= n; o += frame) {
        let s = 0;
        for (let c = 0; c < info.channels; c++) {
          const p = o + c * bps;
          let v: number;
          if (info.format === "float") v = buf.readFloatLE(p);
          else if (info.bits === 16) v = buf.readInt16LE(p) / 32768;
          else if (info.bits === 24) v = buf.readIntLE(p, 3) / 8388608;
          else v = buf.readInt32LE(p) / 2147483648;
          s += v;
        }
        s /= info.channels; acc += s * s;
        if (++cnt === fpf) { frames.push(Math.sqrt(acc / cnt)); acc = 0; cnt = 0; }
      }
    }
    if (!frames.length) return -120;
    frames.sort((a, b) => a - b);
    const v = frames[Math.min(frames.length - 1, Math.floor(0.9 * frames.length))];
    return 20 * Math.log10(Math.max(v, 1e-9));
  } finally { closeSync(fd); }
}
