import "./env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { assEscape, assTime, buildAss, cuesFromTimings, poemLines } from "../src/captions.js";
import { BundleError, validateBundle, validateSpec } from "../src/bundle.js";
import { DIMENSIONS, PALETTES, TARGETS } from "../src/presets.js";
import { buildArgs } from "../src/render.js";

const good = () => ({
  bundleVersion: 1, projectId: "p1", ownerId: null,
  audio: { masterAudioRef: "abc.def.ghi", format: "wav", durationMs: 99999 },
  poem: { title: "Sessiz Gece", text: "Gece sessiz\nYıldızlar uyanık\n\nSabah olur" },
  timings: [{ lineId: "s0l0", startMs: 500, endMs: 2000 }, { lineId: "s0l1", startMs: 2000, endMs: 4000 }, { lineId: "s1l0", startMs: 5000, endMs: 7000 }],
  captions: [], music: { trackId: "trk_0001" }, credits: { poet: "Ş", reader: "O" }, studio: { atmosphere: "warm" },
  video: { orientation: "portrait", targets: ["tiktok", "reels"] },
});

test("bundle: geçerli paket kabul edilir; süre sunucu değeriyle değiştirilir", () => {
  const b = validateBundle(good(), 8000);
  assert.equal(b.bundleVersion, 1); assert.equal(b.audio.durationMs, 8000); assert.equal(b.timings.length, 3);
  assert.deepEqual(b.video.targets, ["tiktok", "reels"]); assert.equal(b.studio.atmosphere, "warm");
});

test("bundle: sürüm, biçim, yön ve bozuk zamanlamalar reddedilir; zamanlar sıkıştırılıp sıralanır", () => {
  const bad = (mut: (b: any) => void) => { const b = good(); mut(b); assert.throws(() => validateBundle(b, 8000), BundleError); };
  bad((b) => (b.bundleVersion = 2)); bad((b) => (b.bundleVersion = undefined));
  bad((b) => (b.audio.format = "ogg")); bad((b) => (b.audio.masterAudioRef = "")); bad((b) => (b.video.orientation = "diagonal"));
  bad((b) => (b.timings[0].lineId = "../../x")); bad((b) => (b.timings[0].endMs = 1)); bad((b) => (b.timings = "x"));
  bad((b) => (b.poem.text = "x".repeat(50_001))); bad((b) => (b.timings = Array.from({ length: 3001 }, () => ({ lineId: "s0l0", startMs: 0, endMs: 1 }))));
  assert.throws(() => validateBundle(null, 1), BundleError); assert.throws(() => validateBundle([], 1), BundleError);
  const b = good(); b.timings = [{ lineId: "s0l1", startMs: 9_000_000, endMs: 9_100_000 }, { lineId: "s0l0", startMs: -5, endMs: 100 }];
  const v = validateBundle(b, 8000);
  assert.deepEqual(v.timings.map((t) => t.lineId), ["s0l0", "s0l1"]); assert.equal(v.timings[0].startMs, 0); assert.equal(v.timings[1].endMs, 8000);
  const c = good() as any; c.captions = [{ startMs: 0, endMs: 1000, text: "a\u0000b".padEnd(900, "x") }, { startMs: 0, endMs: 1, text: "   " }];
  const cc = validateBundle(c, 8000); assert.equal(cc.captions.length, 1); assert.ok(cc.captions[0].text.length <= 600 && !cc.captions[0].text.includes("\u0000"));
});

test("bundle: istemcinin beyan ettiği müzik/lisans alanları kullanılmaz (güvenilmez)", () => {
  const b = good() as any; b.music = { trackId: "trk_0001", attributionRequired: true, attributionText: "sahte", license: { type: "cc0", allowsSocialMediaUse: true, allowsCommercialUse: true } };
  const v = validateBundle(b, 8000);
  assert.equal(v.music.license.allowsSocialMediaUse, false, "istemci beyanı yok sayılmalı"); assert.equal(v.music.attributionText, undefined);
});

test("spec: enum doğrulaması ve güvenli varsayılanlar", () => {
  assert.deepEqual(validateSpec({ orientation: "square", target: "youtube" }), { orientation: "square", target: "youtube", palette: "dusk", captions: true, showTitle: true });
  assert.equal(validateSpec({ orientation: "portrait", target: "reels", palette: "<x>", captions: false }).palette, "dusk");
  assert.throws(() => validateSpec({ orientation: "x", target: "reels" })); assert.throws(() => validateSpec({ orientation: "portrait", target: "myspace" })); assert.throws(() => validateSpec(null));
});

test("ön ayarlar: 9:16, 16:9 ve 1:1 boyutları H.264 için çift ve doğru oranda; hedefler tutarlı", () => {
  assert.deepEqual(DIMENSIONS.portrait, { width: 1080, height: 1920 }); assert.deepEqual(DIMENSIONS.landscape, { width: 1920, height: 1080 }); assert.deepEqual(DIMENSIONS.square, { width: 1080, height: 1080 });
  for (const d of Object.values(DIMENSIONS)) assert.ok(d.width % 2 === 0 && d.height % 2 === 0);
  assert.ok(Math.abs(DIMENSIONS.portrait.width / DIMENSIONS.portrait.height - 9 / 16) < 1e-3); assert.ok(Math.abs(DIMENSIONS.landscape.width / DIMENSIONS.landscape.height - 16 / 9) < 1e-3);
  assert.equal(TARGETS.tiktok.orientation, "portrait"); assert.equal(TARGETS.reels.orientation, "portrait"); assert.equal(TARGETS.youtube.orientation, "landscape");
  assert.deepEqual(Object.keys(PALETTES).sort(), ["dawn", "dusk", "ember", "forest", "night"]);
  for (const p of Object.values(PALETTES)) for (const c of p.colors) assert.match(c, /^[0-9a-f]{6}$/);
});

test("ASS zamanı ve kaçış: biçim doğru, ayraçlar etkisizleştirilir", () => {
  assert.equal(assTime(0), "0:00:00.00"); assert.equal(assTime(1234), "0:00:01.23"); assert.equal(assTime(61_005), "0:01:01.01"); assert.equal(assTime(3_600_000), "1:00:00.00");
  assert.equal(assEscape("a\nb\r\n\nc"), "a\\Nb\\Nc"); assert.equal(assEscape("{\\an9}x{b1}"), "/an9xb1"); assert.ok(!assEscape("{x}").includes("{"));
  assert.equal(assEscape("Işık düşer, pencerene"), "Işık düşer, pencerene");
});

test("ASS: cue başına bir olay, çakışma yok, süre içinde; altyazı kapalıysa cue yok; başlık ve künye var", () => {
  const cues = cuesFromTimings(good().poem.text, good().timings);
  const base = { width: 1080, height: 1920, orientation: "portrait" as const, durationMs: 8000, cues, title: "Sessiz Gece", credits: { poet: "Ş", reader: "O" }, captions: true, showTitle: true };
  const ass = buildAss(base), ev = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
  assert.ok(ass.includes("PlayResX: 1080") && ass.includes("PlayResY: 1920") && ass.includes("Fontname") && ass.includes("Lora"));
  assert.equal(ev.filter((e) => e.includes(",Cue,")).length, 3, "3 satır = 3 cue");
  assert.ok(ev.some((e) => e.includes(",Title,") && e.includes("Sessiz Gece")) && ev.some((e) => e.includes(",Credit,") && e.includes("Şiir: Ş")));
  const t = (s: string) => { const [h, m, r] = s.split(":"); return (+h * 3600 + +m * 60 + +r) * 1000; };
  const cueEv = ev.filter((e) => e.includes(",Cue,")).map((e) => e.split(",")).map((p) => [t(p[1]), t(p[2])]);
  cueEv.forEach(([s, e], i) => { assert.ok(e > s && e <= 8000, "süre içinde"); if (i) assert.ok(s >= cueEv[i - 1][1], "çakışmaz"); });
  assert.ok(!buildAss({ ...base, captions: false }).includes(",Cue,"), "altyazı kapalı");
  assert.ok(!buildAss({ ...base, showTitle: false }).includes(",Title,"));
  assert.ok(buildAss({ ...base, attribution: "Müzik: X (CC-BY)" }).includes("Müzik: X (CC-BY)"), "atıf gerekiyorsa görünür");
  const long = buildAss({ ...base, cues: [{ startMs: 0, endMs: 100_000, text: "uzun", lineIds: [] }] });
  assert.ok(long.includes("0:00:08.00"), "cue süre sonuna kırpılır");
});

test("poemLines: istemciyle aynı kimlik düzeni (s{kıta}l{satır}), boş satır kıta ayırır", () => {
  assert.deepEqual(poemLines("a\nb\n\n\nc\r\nd").map((l) => l.id), ["s0l0", "s0l1", "s1l0", "s1l1"]);
  assert.deepEqual(poemLines("  \n\n"), []);
});

test("ffmpeg argümanları: kabuksuz dizi, H.264/AAC/yuv420p/faststart, görece altyazı yolu, kullanıcı metni içermez", () => {
  const a = buildArgs({ jobDir: "x", audioFile: "audio.wav", durationMs: 8000, spec: { orientation: "landscape", target: "youtube", palette: "night", captions: true, showTitle: true }, ass: "KULLANICI", outPath: "o.mp4" });
  assert.equal(a.width, 1920); assert.equal(a.height, 1080);
  const s = a.args.join(" ");
  for (const k of ["libx264", "aac", "yuv420p", "+faststart", "subtitles=filename=subs.ass:fontsdir=fonts", "-r 30", "-t 8.000"]) assert.ok(s.includes(k), k);
  assert.ok(!s.includes("KULLANICI") && !/[A-Z]:\\/.test(s.replace("o.mp4", "")), "mutlak Windows yolu filtreye girmemeli");
});

test("bağımsızlık: ses modülü video koduna, video modülü ses/web koduna bağımlı değil", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? (f === "node_modules" ? [] : walk(p)) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
  const imports = (f: string) => [...readFileSync(f, "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
  for (const app of ["api", "web"]) for (const f of walk(path.join(root, app, "src"))) {
    const bad = imports(f).filter((i) => /video-worker|\.\.\/\.\.\/video/.test(i));
    assert.deepEqual(bad, [], `${app}: ${path.relative(root, f)} video modülünü içe aktarmamalı`);
  }
  const allowed = /^(node:|fastify|@siir\/contracts|@siir\/server-kit|\.\/|\.\.\/)/;
  for (const f of walk(path.join(root, "video-worker", "src"))) {
    for (const i of imports(f)) { assert.ok(allowed.test(i), `${path.relative(root, f)}: izin verilmeyen bağımlılık ${i}`); assert.ok(!/\.\.\/\.\.\/(api|web)/.test(i), "api/web'e göreli erişim yok"); }
  }
  const pkg = JSON.parse(readFileSync(path.join(root, "video-worker", "package.json"), "utf8"));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ["@siir/contracts", "@siir/server-kit", "fastify"]);
});
