import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Analyzer } from "../src/audio/fx/analysis";
import { measureLufs } from "../src/audio/fx/loudness";
import { renderTakeToWav } from "../src/audio/fx/render";
import { resampleReader } from "../src/audio/resample";
import { defaultFx } from "../src/audio/fx/settings";
import { WakeLockGuard } from "../src/shared/wakeLock";
import type { TakeReader } from "../src/storage/takeReader";
import { FS, sine } from "./helpers";

const readerOf = (sig: Float32Array, fs: number): TakeReader => ({ sampleRate: fs, totalSamples: sig.length, async read(a, n) { return sig.slice(Math.max(0, a), Math.max(0, a) + Math.max(0, n)); } });

// ---------- Örnekleme hızı yedeği (44,1 kHz vb.) ----------
test("yeniden örnekleme: 44,1 kHz → 48 kHz sinüs doğru frekans/genlikte kalır", async () => {
  const src = sine(44100 * 2, 1000, 0.5, 44100), r = resampleReader(readerOf(src, 44100), 48000);
  assert.equal(r.sampleRate, 48000); assert.ok(Math.abs(r.totalSamples - 96000) <= 1);
  const out = await r.read(0, r.totalSamples);
  let maxErr = 0;
  for (let i = 100; i < out.length - 100; i++) maxErr = Math.max(maxErr, Math.abs(out[i] - 0.5 * Math.sin((2 * Math.PI * 1000 * i) / 48000)));
  assert.ok(maxErr < 2e-3, `en büyük hata ${maxErr}`);
});

test("yeniden örnekleme: 96 kHz → 48 kHz yüksek frekansı bastırır (aliasing yok), DC korunur, aynı hız aynen döner", async () => {
  const hi = sine(96000 * 2, 30000, 0.5, 96000), r = resampleReader(readerOf(hi, 96000), 48000);
  const out = await r.read(2000, 20000); let p = 0; for (const v of out) p = Math.max(p, Math.abs(v));
  assert.ok(p < 0.06, `30 kHz bileşeni yeterince bastırılmadı: ${p}`);
  const dc = new Float32Array(44100).fill(0.25), o2 = await resampleReader(readerOf(dc, 44100), 48000).read(200, 5000);
  assert.ok(o2.every((v) => Math.abs(v - 0.25) < 1e-3), "DC korunmalı");
  const same = readerOf(new Float32Array(10), 48000); assert.equal(resampleReader(same, 48000), same);
});

test("yeniden örnekleme parça sınırlarında süreksizlik üretmez (parça parça okuma = tek seferde okuma)", async () => {
  const src = sine(44100 * 3, 440, 0.4, 44100), r = resampleReader(readerOf(src, 44100), 48000);
  const whole = await r.read(0, r.totalSamples), parts = new Float32Array(whole.length);
  for (let p = 0; p < whole.length; p += 7001) parts.set(await r.read(p, Math.min(7001, whole.length - p)), p);
  let m = 0; for (let i = 0; i < whole.length; i++) m = Math.max(m, Math.abs(whole[i] - parts[i]));
  assert.ok(m < 1e-6, `fark ${m}`);
});

test("44,1 kHz kayıt dışa aktarmada 48 kHz stereo WAV olur, süre korunur, ses seviyesi ölçülebilir", async () => {
  const sig = new Float32Array(44100 * 4);
  for (let i = 0; i < sig.length; i++) { const t = i / 44100, env = Math.max(0, Math.sin(2 * Math.PI * 1.5 * t)) ** 2; sig[i] = 0.1 * env * (Math.sin(2 * Math.PI * 150 * t) + 0.4 * Math.sin(2 * Math.PI * 3000 * t)); }
  const an = new Analyzer(44100); an.push(sig);
  const r = await renderTakeToWav(readerOf(sig, 44100), defaultFx("clean"), an.result(), { normalize: true });
  const b = Buffer.from(await r.blob.arrayBuffer());
  assert.equal(b.readUInt32LE(24), 48000); assert.equal(b.readUInt16LE(22), 2); assert.equal(b.readUInt16LE(34), 24);
  const frames = b.readUInt32LE(40) / 6;
  assert.ok(frames / 48000 > 4 && frames / 48000 < 4 + 2, `süre ${frames / 48000}`);
  assert.ok(Math.abs(r.lufs - -16) <= 1, `LUFS ${r.lufs}`);
  void measureLufs; void FS;
});

// ---------- Ekranı açık tutma ----------
type Listener = () => void;
function fakeEnv(opts: { reject?: boolean } = {}) {
  const sentinels: { released: boolean; fire(): void; release(): Promise<void>; addEventListener(t: string, f: Listener): void }[] = [];
  const api = {
    requests: 0,
    async request() {
      api.requests++;
      if (opts.reject) throw new DOMException("izin yok", "NotAllowedError");
      let l: Listener | null = null;
      const s = { released: false, fire() { s.released = true; l?.(); }, async release() { s.released = true; }, addEventListener(_t: string, f: Listener) { l = f; } };
      sentinels.push(s); return s;
    },
  };
  let vis = "visible"; const ls: Listener[] = [];
  const doc = {
    get visibilityState() { return vis; },
    addEventListener(_t: "visibilitychange", f: Listener) { ls.push(f); },
    removeEventListener(_t: "visibilitychange", f: Listener) { const i = ls.indexOf(f); if (i >= 0) ls.splice(i, 1); },
    set(v: string) { vis = v; ls.slice().forEach((f) => f()); }, listeners: () => ls.length,
  };
  return { api, doc, sentinels };
}

test("ekran kilidi: alınır, sekme gizlenip dönünce yeniden alınır, bırakılınca temizlenir", async () => {
  const { api, doc, sentinels } = fakeEnv(); const g = new WakeLockGuard(api, doc);
  assert.equal(await g.acquire(), true); assert.equal(g.active, true); assert.equal(api.requests, 1);
  assert.equal(await g.acquire(), true); assert.equal(api.requests, 1, "zaten aktifse tekrar istenmez");
  sentinels[0].fire(); doc.set("hidden"); assert.equal(g.active, false); // tarayıcı sekme gizlenince bırakır
  doc.set("visible"); await new Promise((r) => setTimeout(r, 10));
  assert.equal(api.requests, 2); assert.equal(g.active, true, "geri gelince yeniden alınmalı");
  g.release(); assert.equal(g.active, false); assert.equal(sentinels[1].released, true); assert.equal(doc.listeners(), 0, "dinleyici temizlenmeli");
  doc.set("hidden"); doc.set("visible"); await new Promise((r) => setTimeout(r, 10)); assert.equal(api.requests, 2, "bırakıldıktan sonra yeniden alınmaz");
});

test("ekran kilidi: desteklenmiyorsa veya reddedilirse hata fırlatmaz", async () => {
  const none = new WakeLockGuard(undefined, undefined); assert.equal(none.supported, false); assert.equal(await none.acquire(), false); none.release();
  const { api, doc } = fakeEnv({ reject: true }); const g = new WakeLockGuard(api, doc);
  assert.equal(await g.acquire(), false); assert.equal(g.active, false); g.release();
});

test("ekran kilidi: istek sürerken bırakılırsa kilit sızmaz", async () => {
  const { api, doc, sentinels } = fakeEnv(); const g = new WakeLockGuard(api, doc);
  const p = g.acquire(); g.release(); await p;
  assert.equal(g.active, false); assert.ok(sentinels.every((s) => s.released), "alınmış olsa bile bırakılmalı");
});

// ---------- Renk kontrastı (WCAG 2.2 AA) ----------
const css = readFileSync(path.join(import.meta.dirname, "../src/styles.css"), "utf8");
const token = (n: string) => new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`).exec(css)![1];
const lum = (hex: string) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mixHex = (fg: string, bg: string, a: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, "0")).join("");

test("renk kontrastı: metin ve etkileşim renkleri tüm yüzeylerde ≥ 4,5:1; metin dışı bileşenler ≥ 3:1", () => {
  const bgs = { bg: token("bg"), bg2: token("bg2"), surface: token("surface"), surface2: token("surface2") };
  for (const [n, b] of Object.entries(bgs)) {
    assert.ok(ratio(token("text"), b) >= 7, `metin/${n}`);
    assert.ok(ratio(token("muted"), b) >= 4.5, `soluk metin/${n}: ${ratio(token("muted"), b).toFixed(2)}`);
    assert.ok(ratio(token("accent"), b) >= 4.5, `vurgu/${n}: ${ratio(token("accent"), b).toFixed(2)}`);
    assert.ok(ratio(token("ok"), b) >= 4.5, `ok/${n}`);
  }
  assert.ok(ratio(token("accent-ink"), token("accent")) >= 4.5, "birincil düğme (açık uç)");
  assert.ok(ratio(token("accent-ink"), token("accent2")) >= 4.5, `birincil düğme (koyu uç): ${ratio(token("accent-ink"), token("accent2")).toFixed(2)}`);
  assert.ok(ratio("#2b0c08", token("danger")) >= 4.5, "tehlike düğmesi");
  // uyarı kutuları: yarı saydam arka plan üstünde açık metin
  assert.ok(ratio("#ffd2cc", mixHex(token("danger"), token("surface"), 0.1)) >= 4.5, "hata kutusu");
  assert.ok(ratio("#f5dcae", mixHex(token("accent"), token("surface"), 0.1)) >= 4.5, "uyarı kutusu");
  assert.ok(ratio("#cfe3d6", mixHex(token("ok"), token("surface"), 0.08)) >= 4.5, "bilgi kutusu");
  // metin dışı: kontrol kenarlığı/odak halkası arka plana karşı ≥ 3:1 (odak halkası accent)
  assert.ok(ratio(token("accent"), token("bg")) >= 3, "odak halkası");
});
