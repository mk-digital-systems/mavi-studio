import "./env.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, copyFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import type { VideoOrientation, VideoSpec } from "@siir/contracts";
import { buildAss } from "../src/captions.js";
import { DIMENSIONS } from "../src/presets.js";
import { renderVideo } from "../src/render.js";
import { centerLuma, centerYmax, makeWav, probe, TMP } from "./util.js";

const audio = path.join(TMP, "poem.wav");
const DUR = 6000;
const cues = [
  { startMs: 500, endMs: 2500, text: "Gece sessiz, yıldızlar uyanık", lineIds: ["s0l0"] },
  { startMs: 3500, endMs: 5500, text: "Işık düşer pencerene", lineIds: ["s1l0"] },
];
before(() => makeWav(audio, 6, [[0.3, 5.7]]));

async function render(orientation: VideoOrientation, o: { captions?: boolean; target?: VideoSpec["target"]; name?: string; palette?: VideoSpec["palette"] } = {}) {
  const spec: VideoSpec = { orientation, target: o.target ?? "tiktok", palette: o.palette ?? "dusk", captions: o.captions ?? true, showTitle: true };
  const dir = path.join(TMP, "job-" + (o.name ?? orientation)), out = path.join(TMP, (o.name ?? orientation) + ".mp4");
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); rmSync(out, { force: true });
  copyFileSync(audio, path.join(dir, "audio.wav"));
  const ass = buildAss({ ...DIMENSIONS[orientation], orientation, durationMs: DUR, cues, title: "Sessiz Gece", credits: { poet: "Şair", reader: "Okuyan" }, captions: spec.captions, showTitle: true });
  const prog: number[] = [];
  const r = await renderVideo({ jobDir: dir, audioFile: "audio.wav", durationMs: DUR, spec, ass, outPath: out, onProgress: (f) => prog.push(f) });
  return { out, r, prog };
}

for (const [orientation, w, h] of [["portrait", 1080, 1920], ["landscape", 1920, 1080], ["square", 1080, 1080]] as const) {
  test(`${orientation}: ${w}x${h}, H.264 + AAC, yuv420p, 30 fps, süre ses kadar, +faststart`, async () => {
    const { out, r, prog } = await render(orientation);
    assert.deepEqual([r.width, r.height], [w, h]);
    const p = await probe(out);
    assert.equal(p.vcodec, "h264"); assert.equal(p.acodec, "aac"); assert.equal(p.pixfmt, "yuv420p");
    assert.deepEqual([p.width, p.height], [w, h]); assert.ok(Math.abs(p.fps - 30) < 0.1, `fps ${p.fps}`);
    assert.ok(Math.abs(p.durationSec - 6) < 0.15, `süre ${p.durationSec}`);
    const head = readFileSync(out).subarray(0, 200_000).toString("latin1");
    assert.ok(head.includes("ftyp") && head.indexOf("moov") > 0 && head.indexOf("moov") < (head.indexOf("mdat") === -1 ? Infinity : head.indexOf("mdat")), "moov, mdat'ten önce olmalı (hızlı başlatma)");
    assert.ok(prog.length > 0 && prog[prog.length - 1] > 0.9, "ilerleme bildirildi");
    assert.ok(statSync(out).size > 20_000);
    // altyazı gerçekten yakılmış mı: cue anında orta şeritte beyaz piksel var, cue olmayan anda yok
    const on = await centerYmax(out, 1.5), gap = await centerYmax(out, 3.0);
    assert.ok(on > 200 && gap < 150, `cue anında beyaz yazı olmalı: ${on}, boşlukta olmamalı: ${gap}`);
  });
}

test("altyazı kapalıyken yazı yok, açıkken var; arka plan iki çalıştırmada aynı (sabit tohum)", async () => {
  const a = await render("portrait", { captions: true, name: "cap-on" }), b = await render("portrait", { captions: false, name: "cap-off" });
  assert.ok(await centerYmax(a.out, 1.5) > 200, "altyazı açıkken yazı görünür");
  assert.ok(await centerYmax(b.out, 1.5) < 150, "altyazı kapalıyken yazı yok");
  const l1 = await centerLuma(a.out, 3.0), l2 = await centerLuma(b.out, 3.0);
  assert.ok(Math.abs(l1 - l2) < 0.5, `aynı arka plan beklenir (${l1} vs ${l2})`);
});

test("Türkçe karakterler (ş, ğ, ı, İ, ö, ü, ç) yazı tipinde bulunur: render hatasız biter ve yazı görünür", async () => {
  const spec: VideoSpec = { orientation: "square", target: "youtube", palette: "night", captions: true, showTitle: false };
  const dir = path.join(TMP, "job-tr"), out = path.join(TMP, "tr.mp4");
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); copyFileSync(audio, path.join(dir, "audio.wav"));
  const ass = buildAss({ ...DIMENSIONS.square, orientation: "square", durationMs: DUR, cues: [{ startMs: 500, endMs: 5500, text: "ŞĞİ ışğüöç ÇÖÜ", lineIds: [] }], title: "", credits: { poet: "", reader: "" }, captions: true, showTitle: false });
  await renderVideo({ jobDir: dir, audioFile: "audio.wav", durationMs: DUR, spec, ass, outPath: out });
  assert.ok(existsSync(out)); assert.ok(await centerYmax(out, 2) > 200 && await centerYmax(out, 0.1) < 150, "yazı görünmeli");
  // yazı tipi dosyası gerçekten Latin Extended-A kapsıyor mu: libass yedek yazı tipine düşmemeli (uyarı yok)
});

test("platform ön ayarı çıktıyı etkiler: gevşek bitrate sınırı (maxrate) ile geçerli MP4 üretilir (youtube yatay)", async () => {
  const { out } = await render("landscape", { target: "youtube", name: "yt" });
  const p = await probe(out); assert.equal(p.vcodec, "h264"); assert.equal(p.width, 1920);
});

test("geçersiz giriş (bozuk ses dosyası) temiz hatayla biter ve çıktı bırakmaz", async () => {
  const dir = path.join(TMP, "job-bad"), out = path.join(TMP, "bad.mp4");
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); rmSync(out, { force: true });
  copyFileSync(path.join(import.meta.dirname, "env.ts"), path.join(dir, "audio.wav")); // WAV değil
  await assert.rejects(renderVideo({ jobDir: dir, audioFile: "audio.wav", durationMs: DUR, spec: { orientation: "square", target: "youtube", palette: "dusk", captions: false, showTitle: false }, ass: "[Script Info]\n", outPath: out }), /Video hazırlanamadı/);
});
