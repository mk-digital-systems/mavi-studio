import { test } from "node:test";
import assert from "node:assert/strict";
import { Analyzer } from "../src/audio/fx/analysis";
import { computeLineTimings, detectSpeech, syllables, toCaptions, type PoemLine } from "../src/audio/timing";
import { parsePoem } from "../src/shared/util";
import { FS } from "./helpers";

const POEM = "Gece sessiz yıldızlar uyanık\nBir ses geliyor uzaklardan\n\nSabah olur elbet\nIşık düşer pencerene";
const lines = (): PoemLine[] => parsePoem(POEM).stanzas.flatMap((s) => s.lines);

/** Bilinen zamanlı konuşma sentezi: her satır `perSyl` ms × hece (± sapma), satır arası `gap`, kıta arası `stanzaGap`. */
function synth(perSyl: number, gap: number, stanzaGap: number, jitter = 0, seed = 5) {
  let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const truth: { id: string; startMs: number; endMs: number }[] = [];
  let t = 700;
  const L = lines();
  L.forEach((l, i) => {
    const dur = syllables(l.text) * perSyl * (1 + (rnd() * 2 - 1) * jitter);
    truth.push({ id: l.id, startMs: t, endMs: t + dur });
    t += dur;
    const nextStanza = L[i + 1] && L[i + 1].id.slice(0, 2) !== l.id.slice(0, 2);
    t += nextStanza ? stanzaGap : gap;
  });
  const total = t + 700, n = Math.round((total / 1000) * FS), x = new Float32Array(n);
  for (const r of truth) for (let i = Math.round((r.startMs / 1000) * FS); i < Math.round((r.endMs / 1000) * FS); i++) x[i] = 0.2 * Math.sin((2 * Math.PI * 180 * i) / FS) * (0.6 + 0.4 * Math.sin((2 * Math.PI * 4 * i) / FS));
  for (let i = 0; i < n; i++) x[i] += (rnd() * 2 - 1) * 0.0015; // hafif gürültü tabanı
  const a = new Analyzer(FS); a.push(x);
  return { truth, frames: a.result().frameRms };
}

test("hece sayısı Türkçe ünlülerle sayılır", () => {
  assert.equal(syllables("Gece sessiz"), 4); assert.equal(syllables("Işık düşer pencerene"), 2 + 2 + 4);
  assert.equal(syllables("ÜÖİ"), 3); assert.equal(syllables("..."), 1); assert.equal(syllables(""), 1);
});

test("konuşma tespiti: bilinen bölümleri ±100 ms ile bulur; sessizlik ve düz gürültüde boş döner", () => {
  const { truth, frames } = synth(180, 350, 1400);
  const sp = detectSpeech(frames);
  assert.ok(sp.length >= 3, `bölüm sayısı ${sp.length}`);
  const first = sp[0], last = sp[sp.length - 1];
  assert.ok(Math.abs(first.startMs - truth[0].startMs) <= 100, `ilk başlangıç ${first.startMs} vs ${truth[0].startMs}`);
  assert.ok(Math.abs(last.endMs - truth[truth.length - 1].endMs) <= 100, `son bitiş ${last.endMs} vs ${truth[truth.length - 1].endMs}`);
  assert.deepEqual(detectSpeech(new Float32Array(200)), []);
  assert.deepEqual(detectSpeech(new Float32Array(200).fill(0.001)), [], "düz gürültü konuşma sayılmaz");
  assert.deepEqual(detectSpeech([]), []);
});

test("satır zamanları: hece oranına uyan okumada başlangıç hatası küçük (≤ 200 ms ortalama), sıralı ve çakışmasız", () => {
  const { truth, frames } = synth(180, 350, 1400, 0);
  const t = computeLineTimings(lines(), detectSpeech(frames));
  assert.equal(t.length, 4);
  const err = t.map((x, i) => Math.abs(x.startMs - truth[i].startMs));
  const mean = err.reduce((a, b) => a + b, 0) / err.length;
  assert.ok(mean <= 200, `ortalama başlangıç hatası ${mean.toFixed(0)} ms (${err.map(Math.round)})`);
  t.forEach((x, i) => { assert.ok(x.endMs > x.startMs, "süre pozitif"); if (i) assert.ok(x.startMs >= t[i - 1].endMs - 1, "çakışma yok"); });
});

test("hece oranı bozulunca (±35% sapma) hata artar ama satırlar yine sıralı ve kayıt içinde kalır", () => {
  const { truth, frames } = synth(180, 350, 1400, 0.35, 11);
  const sp = detectSpeech(frames), t = computeLineTimings(lines(), sp);
  const err = t.map((x, i) => Math.abs(x.startMs - truth[i].startMs)), mean = err.reduce((a, b) => a + b, 0) / err.length;
  assert.ok(mean <= 700, `ortalama başlangıç hatası ${mean.toFixed(0)} ms`);
  assert.ok(t[0].startMs >= sp[0].startMs - 1 && t[t.length - 1].endMs <= sp[sp.length - 1].endMs + 1000);
  t.forEach((x, i) => { if (i) assert.ok(x.startMs >= t[i - 1].startMs); });
});

test("kıta arası uzun duraklar satır süresini şişirmez: cue en çok 1,5 sn ek tutulur", () => {
  const { frames } = synth(150, 300, 3000);
  const t = computeLineTimings(lines(), detectSpeech(frames));
  const stanzaEnd = t[1], next = t[2];
  assert.ok(next.startMs - stanzaEnd.startMs > 2500, "duraklar geri konmalı");
  assert.ok(stanzaEnd.endMs - stanzaEnd.startMs < 4000, `uzun duraklarda cue kapanmalı (${stanzaEnd.endMs - stanzaEnd.startMs} ms)`);
});

test("kayma ve boş durumlar: offset tüm zamanlara eklenir, konuşma yoksa zamanlama üretilmez, negatif zaman 0'a kırpılır", () => {
  const { frames } = synth(180, 350, 1400), sp = detectSpeech(frames);
  const a = computeLineTimings(lines(), sp), b = computeLineTimings(lines(), sp, { offsetMs: 400 });
  a.forEach((x, i) => { assert.equal(b[i].startMs, x.startMs + 400); assert.equal(b[i].endMs, x.endMs + 400); });
  assert.deepEqual(computeLineTimings(lines(), []), []); assert.deepEqual(computeLineTimings([], sp), []);
  assert.ok(computeLineTimings(lines(), sp, { offsetMs: -1e6 }).every((x) => x.startMs === 0 && x.endMs === 0));
  assert.equal(computeLineTimings([{ id: "s0l0", text: "tek" }], [{ startMs: 1000, endMs: 3000 }]).length, 1);
});

test("altyazılar: her satır bir cue, metin ve kimlik korunur, geçersiz aralıklar atılır", () => {
  const L = lines(), { frames } = synth(180, 350, 1400), t = computeLineTimings(L, detectSpeech(frames));
  const c = toCaptions(L, t);
  assert.equal(c.length, 4); assert.equal(c[0].text, "Gece sessiz yıldızlar uyanık"); assert.deepEqual(c[2].lineIds, ["s1l0"]);
  assert.equal(toCaptions(L, [{ lineId: "s9l9", startMs: 0, endMs: 100 }, { lineId: "s0l0", startMs: 50, endMs: 50 }]).length, 0);
});
