export function f32To24(f32: Float32Array): Uint8Array {
  const out = new Uint8Array(f32.length * 3);
  for (let i = 0, o = 0; i < f32.length; i++, o += 3) {
    const c = Math.max(-1, Math.min(1, f32[i]));
    const v = Math.round(c < 0 ? c * 0x800000 : c * 0x7fffff);
    out[o] = v & 255;
    out[o + 1] = (v >> 8) & 255;
    out[o + 2] = (v >> 16) & 255;
  }
  return out;
}

/** 24-bit PCM WAV (varsayılan mono; `channels` verilirse bayt dizisi o kadar kanallı iç içe olmalı). */
export function wav24(chunks: Uint8Array[], sampleRate: number, channels = 1): Blob {
  const len = chunks.reduce((a, c) => a + c.length, 0);
  const h = new DataView(new ArrayBuffer(44));
  const w = (o: number, s: string) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); h.setUint32(4, 36 + len, true); w(8, "WAVE"); w(12, "fmt ");
  h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, channels, true);
  h.setUint32(24, sampleRate, true); h.setUint32(28, sampleRate * 3 * channels, true);
  h.setUint16(32, 3 * channels, true); h.setUint16(34, 24, true); w(36, "data"); h.setUint32(40, len, true);
  return new Blob([h, ...chunks.map((c) => c as BlobPart)], { type: "audio/wav" });
}

/** 24-bit little-endian paketli bayt dizisini float32'ye çevirir (f32To24'ün tersi). */
export function s24ToF32(bytes: Uint8Array, out: Float32Array, outOffset = 0, byteStart = 0, byteEnd = bytes.length) {
  let o = outOffset;
  for (let i = byteStart; i + 2 < byteEnd + 0 && i + 2 < bytes.length; i += 3) {
    let v = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16);
    if (v & 0x800000) v |= ~0xffffff;
    out[o++] = v / 8388608;
  }
  return o - outOffset;
}
