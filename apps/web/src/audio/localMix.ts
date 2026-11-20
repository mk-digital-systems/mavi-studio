import type { MixSettings } from "@siir/contracts";
import { f32To24, wav24 } from "./wav";

const SR = 48000;
const dbToGain = (db: number) => Math.pow(10, db / 20);

/** Şiir sesinin konuşulan bölümleri (sn). Kısa boşluklar konuşma sayılır; müzik pompalamasın. */
function speechRuns(buf: AudioBuffer): [number, number][] {
  const ch = buf.getChannelData(0), win = Math.round(buf.sampleRate * 0.05), runs: [number, number][] = [];
  const hang = 0.4;
  let start = -1, lastLoud = -1;
  for (let i = 0; i + win <= ch.length; i += win) {
    let s = 0;
    for (let j = 0; j < win; j += 4) s += ch[i + j] * ch[i + j];
    const loud = 10 * Math.log10(s / (win / 4) + 1e-12) > -48, t = i / buf.sampleRate;
    if (loud) { if (start < 0) start = t; lastLoud = t + 0.05; }
    else if (start >= 0 && t - lastLoud > hang) { runs.push([start, lastLoud]); start = -1; }
  }
  if (start >= 0) runs.push([start, lastLoud]);
  return runs;
}

/**
 * Cihazda miks: işlenmiş şiir sesi + yüklenen fon müziği (döngülü, seviye, giriş/çıkış yumuşatma, otomatik kısma).
 * Çıktı stereo 48 kHz 24-bit WAV; tepe değeri taşarsa tümü ölçeklenir.
 */
export async function mixWithMusic(voice: Blob, music: Blob, m: MixSettings, onProgress?: (f: number) => void): Promise<Blob> {
  const ctx = new AudioContext();
  let v: AudioBuffer, mu: AudioBuffer;
  try { [v, mu] = await Promise.all([ctx.decodeAudioData(await voice.arrayBuffer()), ctx.decodeAudioData(await music.arrayBuffer())]); }
  finally { void ctx.close(); }
  onProgress?.(0.2);

  const align = m.alignmentOffsetMs / 1000, vStart = Math.max(0, align), mStart = Math.max(0, -align);
  const end = vStart + v.duration + m.music.tailSec;
  const off = new OfflineAudioContext(2, Math.ceil(end * SR), SR);

  const vs = off.createBufferSource();
  vs.buffer = v; vs.connect(off.destination); vs.start(vStart);

  const ms = off.createBufferSource();
  ms.buffer = mu; ms.loop = true;
  const fade = off.createGain(), duck = off.createGain();
  ms.connect(fade).connect(duck).connect(off.destination);
  const base = dbToGain(m.music.gainDb), fi = Math.min(m.music.fadeInSec, end / 2), fo = Math.min(m.music.fadeOutSec, end / 2);
  fade.gain.setValueAtTime(fi > 0 ? 0 : base, mStart);
  if (fi > 0) fade.gain.linearRampToValueAtTime(base, mStart + fi);
  fade.gain.setValueAtTime(base, Math.max(mStart + fi, end - fo));
  fade.gain.linearRampToValueAtTime(0, end);
  duck.gain.setValueAtTime(1, 0);
  if (m.ducking.enabled) {
    const low = dbToGain(-m.ducking.amountDb), att = m.ducking.attackMs / 1000, rel = m.ducking.releaseMs / 1000;
    let last = 0;
    for (const [s0, e0] of speechRuns(v)) {
      const s = s0 + vStart, e = e0 + vStart, tA = Math.max(last, s - att);
      duck.gain.linearRampToValueAtTime(1, tA);
      duck.gain.linearRampToValueAtTime(low, Math.max(tA, s));
      duck.gain.linearRampToValueAtTime(low, e);
      duck.gain.linearRampToValueAtTime(1, e + rel);
      last = e + rel;
    }
  }
  ms.start(mStart, m.music.startOffsetSec % mu.duration);
  ms.stop(end);

  const out = await off.startRendering();
  onProgress?.(0.8);
  const L = out.getChannelData(0), R = out.getChannelData(1);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const k = peak > 0.97 ? 0.97 / peak : 1, inter = new Float32Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { inter[2 * i] = L[i] * k; inter[2 * i + 1] = R[i] * k; }
  onProgress?.(1);
  return wav24([f32To24(inter)], SR, 2);
}
