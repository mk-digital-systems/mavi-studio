import { after, test } from "node:test";
import assert from "node:assert/strict";
(globalThis as unknown as { window: unknown }).window = globalThis; // Node'da window.setInterval için
import { Analyzer } from "../src/audio/fx/analysis";
import { FxPlayer, type CtxLike, type SourceLike, type GainLike } from "../src/audio/fx/player";
import { defaultFx } from "../src/audio/fx/settings";
import { activeId } from "../src/shared/exclusive";
import type { TakeReader } from "../src/storage/takeReader";
import { FS, speechLike } from "./helpers";

class FakeGain {
  gain = { value: 1, targets: [] as number[], setTargetAtTime(this: { targets: number[] }, v: number) { this.targets.push(v); }, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} };
  connect() {} disconnect() {}
}
class FakeSource {
  buffer: unknown = null; started = false; stopped = false; disconnected = false; onended: (() => void) | null = null;
  connect() {} disconnect() { this.disconnected = true; } start() { this.started = true; } stop() { this.stopped = true; }
}
class FakeCtx implements CtxLike {
  currentTime = 0; sampleRate = FS; destination = {}; state = "running"; closed = 0;
  sources: FakeSource[] = []; gains: FakeGain[] = [];
  createGain() { const g = new FakeGain(); this.gains.push(g); return g as unknown as GainLike; }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s as unknown as SourceLike; }
  createBuffer(ch: number, len: number) { const d = Array.from({ length: ch }, () => new Float32Array(len)); return { getChannelData: (c: number) => d[c], duration: len / FS }; }
  async resume() { this.state = "running"; } async suspend() { this.state = "suspended"; }
  async close() { this.closed++; this.state = "closed"; }
}

const created: FxPlayer[] = [];
// Test başarısız olsa bile zamanlayıcılar kapansın (süreç asılı kalmasın)
after(() => created.forEach((p) => p.dispose()));

function setup(id: string) {
  const sig = speechLike(6, 0.25);
  const reader: TakeReader = { sampleRate: FS, totalSamples: sig.length, async read(a, n) { return sig.slice(Math.max(0, a), Math.max(0, a) + Math.max(0, n)); } };
  const an = new Analyzer(FS); an.push(sig);
  const ctx = new FakeCtx();
  const p = new FxPlayer(reader, an.result(), defaultFx("small-hall"), id, () => ctx);
  created.push(p);
  return { p, ctx };
}
const settle = (ms = 120) => new Promise((r) => setTimeout(r, ms));

test("oynatma: kaynaklar kısa parçalarla hazırlanır (tüm dosya belleğe alınmaz)", async () => {
  const { p, ctx } = setup("p1");
  await p.play(0); await settle();
  assert.ok(ctx.sources.length >= 4 && ctx.sources.every((s) => s.started));
  assert.ok(ctx.sources.length <= 14, "yalnızca birkaç saniye ileri hazırlanmalı");
  p.dispose();
});

test("aynı anda yalnızca bir oynatıcı çalar", async () => {
  const a = setup("pa"), b = setup("pb");
  await a.p.play(0); assert.equal(a.p.isPlaying, true); assert.equal(activeId(), "pa");
  await b.p.play(0); assert.equal(a.p.isPlaying, false); assert.equal(b.p.isPlaying, true); assert.equal(activeId(), "pb");
  a.p.dispose(); b.p.dispose();
});

test("dispose: AudioContext kapanır, kaynaklar durdurulup ayrılır, tekrar çağrı güvenli", async () => {
  const { p, ctx } = setup("pc");
  await p.play(0); await settle();
  p.dispose(); p.dispose();
  assert.equal(ctx.closed, 1);
  assert.ok(ctx.sources.every((s) => s.stopped && s.disconnected));
  assert.equal(p.isPlaying, false); assert.equal(activeId(), null);
  await p.play(0); assert.equal(p.isPlaying, false); // kapatılmış oynatıcı çalmaz
});

test("önce/sonra geçişi anlıktır: yeni kaynak üretmez, yalnızca kazanç yolu değişir", async () => {
  const { p, ctx } = setup("pd");
  await p.play(0); await settle();
  const before = ctx.sources.length;
  p.setMode("original"); assert.equal(p.currentMode, "original");
  p.setMode("processed"); assert.equal(p.currentMode, "processed");
  assert.equal(ctx.sources.length, before, "mod değişimi yeni kaynak üretmemeli");
  assert.ok(ctx.gains.filter((g) => g.gain.targets.length > 0).length >= 2, "iki yolun kazançları ayarlanmalı");
  p.dispose();
});

test("ayar değişince kayıt yeniden oluşturulmadan yeni nesil başlar", async () => {
  const { p, ctx } = setup("pe");
  await p.play(0); await settle();
  const before = ctx.sources.length;
  p.setSettings(defaultFx("cinematic")); await settle(300);
  assert.ok(ctx.sources.length > before, "yeni nesil kaynak üretmeli");
  p.dispose();
  assert.ok(ctx.sources.every((s) => s.stopped));
});

test("durdur/seek: konum korunur, durunca kaynak kalmaz", async () => {
  const { p, ctx } = setup("pf");
  await p.play(2); await settle(); p.pause();
  assert.equal(p.isPlaying, false); assert.ok(Math.abs(p.position() - 2) < 0.5);
  p.seek(4); assert.ok(Math.abs(p.position() - 4) < 0.01);
  assert.ok(ctx.sources.every((s) => s.stopped));
  p.dispose();
});

test("kayıt sonuna gelince oynatma kendiliğinden biter ve onEnded çağrılır", async () => {
  const { p, ctx } = setup("pg");
  let ended = 0; p.onEnded = () => ended++;
  await p.play(5.5); await settle();
  ctx.currentTime = 100; // süre doldu
  await settle(400);
  assert.equal(ended, 1); assert.equal(p.isPlaying, false); assert.equal(activeId(), null);
  p.dispose();
});
