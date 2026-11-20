import { test } from "node:test";
import assert from "node:assert/strict";
import { Analyzer } from "../src/audio/fx/analysis";
import { buildChain, estimateMatchDb, renderAll } from "../src/audio/fx/chain";
import { dbToLin, Limiter, Reverb } from "../src/audio/fx/dsp";
import { defaultFx, LIMITS, PRESET_ORDER, resolveParams } from "../src/audio/fx/settings";
import { FS, noise, peak, rms, sine, speechLike } from "./helpers";

const CEIL = dbToLin(LIMITS.limiterCeilingDb) + 1e-6;
const analyze = (x: Float32Array) => { const a = new Analyzer(FS); a.push(x); return a.result(); };

test("orijinal kayıt dizisi işlem sonrası değişmez (kopya üzerinde çalışır)", () => {
  const x = speechLike(2), copy = new Float32Array(x);
  renderAll(defaultFx("big-hall"), x, FS, analyze(x), 1);
  assert.deepEqual(x, copy);
});

test("efektler kapalıyken ses (neredeyse) aynen geçer; önce/sonra aynı olur", () => {
  const x = speechLike(2, 0.2);
  const s = { ...defaultFx("cinematic"), enabled: false };
  const y = renderAll(s, x, FS, analyze(x), 0);
  let maxDiff = 0;
  for (let i = 4800; i < x.length; i++) maxDiff = Math.max(maxDiff, Math.abs(y.l[i] - x[i])); // DC bloklayıcının ilk 0,1 sn'si hariç
  assert.ok(maxDiff < 0.03, `fark ${maxDiff}`); // 8 Hz DC bloklayıcının 140 Hz'de ≈3° faz kayması beklenir
  assert.equal(estimateMatchDb(s, x, FS), 0);
});

test("tüm modüller bypass edilince yalnız DC+limiter kalır", () => {
  const x = speechLike(2, 0.2), s = defaultFx("warm");
  s.bypass = { highpass: true, gate: true, eq: true, compressor: true, deesser: true, reverb: true };
  const a = analyze(x);
  const y = renderAll(s, x, FS, { ...a, flags: { ...a.flags, silent: true } }, 0); // silent → giriş kazancı 0
  let maxDiff = 0;
  for (let i = 4800; i < x.length; i++) maxDiff = Math.max(maxDiff, Math.abs(y.l[i] - x[i]));
  assert.ok(maxDiff < 0.03, `fark ${maxDiff}`); // 8 Hz DC bloklayıcının 140 Hz'de ≈3° faz kayması beklenir
});

test("bir modülü bypass etmek çıktıyı değiştirir (modül gerçekten çalışıyor)", () => {
  const x = speechLike(2); const a = analyze(x);
  const on = renderAll(defaultFx("big-hall"), x, FS, a, 2);
  const s = defaultFx("big-hall"); s.bypass = { reverb: true };
  const off = renderAll(s, x, FS, a, 2);
  const tail = (y: { l: Float32Array }) => rms(y.l.subarray(x.length + 4800, x.length + 4800 + 24000));
  assert.ok(tail(on) > 1e-4, "yankı kuyruğu olmalı"); assert.ok(tail(off) < tail(on) * 0.05, "bypass kuyruğu kaldırmalı");
});

test("clipping koruması: aşırı yüksek girdide tüm atmosferlerde çıkış tavanı aşmaz", () => {
  const n = FS * 3, loud = new Float32Array(n);
  const a = noise(n, 3), b = sine(n, 220, 4);
  for (let i = 0; i < n; i++) loud[i] = a[i] + b[i];
  loud[1000] = 50; loud[2000] = -80; // tek örneklik uç değerler
  for (const id of PRESET_ORDER) {
    const s = { ...defaultFx(id), controls: { ...defaultFx(id).controls, outputDb: 6, reverb: 100 } };
    const y = renderAll(s, loud, FS, analyze(loud), 1);
    assert.ok(peak(y.l) <= CEIL && peak(y.r) <= CEIL, `${id}: tepe ${Math.max(peak(y.l), peak(y.r))}`);
    for (let i = 0; i < y.l.length; i += 97) assert.ok(Number.isFinite(y.l[i]) && Number.isFinite(y.r[i]));
  }
});

test("limiter: yüksek akışta tavan aşılmaz; tavan altı ses değişmez", () => {
  const lim = new Limiter(FS, -1.5), l = noise(FS, 3), r = noise(FS, 3, 99);
  lim.process(l, r);
  assert.ok(peak(l) <= CEIL && peak(r) <= CEIL);
  const q = new Limiter(FS), z = new Float32Array(4800), z2 = new Float32Array(4800);
  q.process(z, z2); assert.equal(q.minGainDb, 0);
  const small = sine(9600, 440, 0.2), ref = new Float32Array(small), small2 = new Float32Array(small);
  new Limiter(FS).process(small, small2);
  for (let i = 200; i < 9000; i++) assert.ok(Math.abs(small[i] - ref[i - 96]) < 1e-6, "tavan altı ses değişmemeli (gecikme hariç)");
});

test("sessiz kayıt: NaN yok, kazanç yükseltilmez, çıkış sessiz kalır", () => {
  const z = new Float32Array(FS * 2), a = analyze(z);
  assert.equal(a.flags.silent, true);
  const p = resolveParams(defaultFx("cinematic"), a);
  assert.equal(p.inputDb, 0); assert.equal(p.expander.rangeDb, 0);
  const y = renderAll(defaultFx("cinematic"), z, FS, a, 1);
  assert.ok(peak(y.l) < 1e-6 && peak(y.r) < 1e-6);
  const faint = noise(FS * 2, 0.0003), af = analyze(faint);
  assert.equal(af.flags.silent, true); assert.equal(resolveParams(defaultFx(), af).inputDb, 0);
});

test("analiz bayrakları: düşük seviye, taşma ve normal ses", () => {
  const quiet = speechLike(3, 0.008); assert.equal(analyze(quiet).flags.tooQuiet, true);
  const hot = sine(FS, 200, 1.0); hot.fill(1, 100, 110); const ah = analyze(hot);
  assert.equal(ah.flags.clipping, true); assert.equal(ah.clippedSamples >= 10, true);
  const ok = analyze(speechLike(3, 0.25)); assert.equal(ok.flags.silent, false); assert.equal(ok.flags.tooQuiet, false); assert.equal(ok.flags.clipping, false);
});

test("giriş kazancı: konuşmayı hedefe yaklaştırır ama tepeyi −3 dBFS üstüne çıkarmaz", () => {
  const x = speechLike(3, 0.03), a = analyze(x), p = resolveParams(defaultFx(), a);
  assert.ok(p.inputDb > 0 && p.inputDb <= 12);
  assert.ok(a.peakDb + p.inputDb <= -3 + 1e-6);
});

test("blok bölme sonucu değiştirmez (durum sürekliliği)", () => {
  const x = speechLike(2, 0.2), a = analyze(x), s = defaultFx("stage");
  const whole = buildChain(s, FS, a).process(x);
  const c = buildChain(s, FS, a), l = new Float32Array(x.length), r = new Float32Array(x.length);
  for (let i = 0; i < x.length; i += 7001) { const o = c.process(x.subarray(i, Math.min(x.length, i + 7001))); l.set(o.l, i); r.set(o.r, i); }
  for (let i = 0; i < x.length; i += 53) assert.ok(Math.abs(whole.l[i] - l[i]) < 1e-6 && Math.abs(whole.r[i] - r[i]) < 1e-6);
});

test("reverb: birim enerjiye normalleşir ve decay süresine uyar", () => {
  for (const decay of [0.3, 1, 2.8]) {
    const rv = new Reverb(FS, { decaySec: decay, predelayMs: 10, damping: 0.5, size: 1, erGain: 0.5, slapMs: 0, slapGain: 0 });
    const imp = new Float32Array(FS * 5); imp[0] = 1;
    const L = new Float32Array(imp.length), R = new Float32Array(imp.length); rv.process(imp, L, R);
    let e = 0; for (let i = 0; i < L.length; i++) e += (L[i] ** 2 + R[i] ** 2) / 2;
    assert.ok(Math.abs(e - 1) < 0.05, `E=${e}`);
    const lateStart = Math.round((decay * 2 + 0.3) * FS);
    assert.ok(rms(L.subarray(lateStart, lateStart + 4800)) < 1e-3, "decay'in iki katından sonra sönmeli");
  }
});

test("seviye eşleştirme sınırlı ve sonlu", () => {
  const x = speechLike(3), a = analyze(x);
  for (const id of PRESET_ORDER) { const d = estimateMatchDb(defaultFx(id), x, FS, a); assert.ok(Number.isFinite(d) && Math.abs(d) <= 9, `${id} ${d}`); }
});
