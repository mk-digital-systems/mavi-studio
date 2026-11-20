import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Ducker, envelope, nextIndex, OverloadDetector, prevIndex, sliderToGain } from "../src/audio/broadcast/ducking";
import { moveItem, sanitizeFlow } from "../src/storage/flows";
import { safeStartVolume, sanitizeSfx, SFX_CATEGORIES } from "../src/storage/sfx";
import { checkMusicFile, cleanMeta, isLocalTrack } from "../src/storage/music";
import { sanitizePerformance } from "../src/storage/performances";
import { stanzaCues } from "../src/shared/captions";
import { defaultSettings, sanitizeBroadcast, sanitizeSettings, SECTIONS } from "../src/shared/settings";
import { GROUPS, LIVE_SECTIONS, MAIN_NAV, moduleOf, STUDIO_SECTIONS } from "../src/shell/nav";
import { migrateProject, sanitizeReading } from "../src/storage/migrate";

// ---------- Konuşma önceliği ve ses güvenliği ----------
test("konuşma önceliği: eşik üstünde fon kısılır, kısa duraklarda hemen geri gelmez, bitince geri gelir", () => {
  const d = new Ducker({ enabled: true, amountDb: 12, thresholdDb: -40, holdMs: 400 });
  assert.equal(d.update(-60, 0), 1, "sessizken kısma yok");
  const low = d.update(-20, 100);
  assert.ok(low < 0.3 && low > 0.2, `12 dB ≈ 0.25, geldi ${low}`);
  assert.equal(d.update(-60, 300), low, "300 ms duraksama konuşma sayılır");
  assert.equal(d.update(-60, 700), 1, "uzun sessizlikte fon geri gelir");
  const off = new Ducker({ enabled: false, amountDb: 12, thresholdDb: -40, holdMs: 400 });
  assert.equal(off.update(0, 0), 1, "kapalıyken kısma yok");
});

test("aşırı yüklenme uyarısı yalnızca süreklilikte verilir (tek tepe uyarı sayılmaz)", () => {
  const o = new OverloadDetector(-1.5, 250);
  assert.equal(o.update(-0.5, 0), false); assert.equal(o.update(-0.5, 100), false);
  assert.equal(o.update(-10, 150), false, "düşünce sıfırlanır");
  o.update(-0.5, 200); assert.equal(o.update(-0.5, 500), true);
});

test("kaydırıcı eğrisi, zarf ve akış ilerletme saf işlevleri", () => {
  assert.equal(sliderToGain(0), 0); assert.equal(sliderToGain(1), 1); assert.equal(sliderToGain(0.5), 0.25); assert.equal(sliderToGain(9), 1);
  assert.equal(envelope(0, 10, 2, 2), 0); assert.equal(envelope(1, 10, 2, 2), 0.5); assert.equal(envelope(5, 10, 2, 2), 1); assert.equal(envelope(9, 10, 2, 2), 0.5); assert.equal(envelope(11, 10, 2, 2), 0);
  assert.equal(nextIndex(-1, 3), 0); assert.equal(nextIndex(2, 3), 2); assert.equal(nextIndex(0, 0), -1); assert.equal(prevIndex(0, 3), 0); assert.equal(prevIndex(2, 3), 1);
});

test("yayın masası KAYIT YAPMAZ: kayıt mekanizması kaynak kodunda hiç yok", () => {
  const src = readFileSync(path.resolve(import.meta.dirname, "../src/audio/broadcast/desk.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  for (const banned of ["MediaRecorder", "AudioWorklet", "createScriptProcessor", "createMediaStreamDestination", "putChunk", "putTake", "savePerformance", "indexedDB"]) assert.ok(!src.includes(banned), `desk.ts içinde ${banned} olmamalı`);
  const live = readFileSync(path.resolve(import.meta.dirname, "../src/features/live/LiveDesk.tsx"), "utf8");
  for (const banned of ["MediaRecorder", "MicRecorder", "putChunk", "putTake", "newProject(", "saveProject"]) assert.ok(!live.includes(banned), `LiveDesk içinde ${banned} olmamalı`);
});

// ---------- Akış, efekt, kayıtlı şiir veri modeli ----------
test("akış: bozuk girdi güvenli hale gelir, sıralama kayıpsızdır", () => {
  const f = sanitizeFlow({ name: "  ", items: [{ kind: "x" }, { kind: "live-poem", refId: "p1", label: "A" }, null, { kind: "note", text: "merhaba" }] });
  assert.equal(f.name, "Yeni akış"); assert.equal(f.items.length, 2); assert.equal(f.items[0].kind, "live-poem");
  assert.deepEqual(sanitizeFlow(null).items, []);
  const m = moveItem([1, 2, 3, 4], 0, 2); assert.deepEqual(m, [2, 3, 1, 4]); assert.deepEqual(moveItem([1, 2], 5, 0), [1, 2]);
});

test("ses efekti: kategori güvenli başlangıç seviyesi, sınırlar ve kısayol doğrulaması", () => {
  assert.equal(SFX_CATEGORIES.length, 14);
  assert.ok(safeStartVolume("Silah/patlama") < safeStartVolume("Rüzgâr"), "yüksek sesli kategori daha kısık başlar");
  const s = sanitizeSfx({ name: "x".repeat(500), category: "<script>", defaultVolume: 9, fadeInSec: -3, shortcut: "AB", maxVoices: 99, loop: "evet", size: NaN });
  assert.equal(s.name.length, 60); assert.equal(s.category, "Özel efektler"); assert.equal(s.defaultVolume, 1); assert.equal(s.fadeInSec, 0);
  assert.equal(s.shortcut, "a"[0] === s.shortcut ? "a" : "", "tek tuşa sıkışır ya da boşalır"); assert.equal(s.maxVoices, 4); assert.equal(s.loop, false);
  assert.equal(sanitizeSfx({ shortcut: "!" }).shortcut, "");
  assert.ok(sanitizeSfx(null).id.startsWith("sfx_"));
});

test("fon müziği: biçim doğrulama ve üst veri temizliği", () => {
  assert.equal(checkMusicFile({ name: "a.mp3", type: "audio/mpeg", size: 10 }), null);
  assert.equal(checkMusicFile({ name: "a.WAV", type: "", size: 10 }), null);
  assert.ok(checkMusicFile({ name: "a.exe", type: "application/x-msdownload", size: 10 }));
  assert.ok(checkMusicFile({ name: "a.mp4", type: "video/mp4", size: 10 }), "video reddedilir");
  assert.ok(checkMusicFile({ name: "a.mp3", type: "audio/mpeg", size: 0 })); assert.ok(checkMusicFile({ name: "a.mp3", type: "audio/mpeg", size: 1e9 }));
  const m = cleanMeta({ title: "  ", artist: "x\u0000y", category: "c".repeat(99), note: "n" }, "Varsayılan");
  assert.equal(m.title, "Varsayılan"); assert.equal(m.artist, "x y"); assert.equal(m.category.length, 30);
  assert.ok(isLocalTrack("loc_abc")); assert.ok(!isLocalTrack("trk_0001")); assert.ok(!isLocalTrack(null));
});

test("kayıtlı şiir: eski/bozuk kayıtlar güvenli hale gelir; yalnızca kimlikle bağlanır (ses verisi içermez)", () => {
  const p = sanitizePerformance({ poemId: "p1", selectedTakeId: "t1", backgroundTrackId: "../../etc", teleprompterSettings: { speed: 9999, fontScale: -4 }, captionTiming: { timings: [{ lineId: "a", startMs: 1, endMs: 2 }, { lineId: 5 }], captions: "x" }, blob: new Uint8Array(10) });
  assert.equal(p.backgroundTrackId, null, "geçersiz fon kimliği düşer"); assert.equal(p.teleprompterSettings.speed, 90); assert.equal(p.teleprompterSettings.fontScale, 0.8);
  assert.equal(p.captionTiming.timings.length, 1); assert.deepEqual(p.captionTiming.captions, []);
  assert.ok(!("blob" in p), "bilinmeyen (ses) alanı atılır");
  assert.equal(sanitizePerformance({ backgroundTrackId: "loc_" + crypto.randomUUID() }).backgroundTrackId?.startsWith("loc_"), true);
  assert.equal(sanitizePerformance({ backgroundTrackId: "trk_0007" }).backgroundTrackId, "trk_0007");
  const fresh = sanitizePerformance(null);
  for (const k of ["poemId", "selectedTakeId", "processedVoiceId", "backgroundTrackId", "mixSettings", "teleprompterSettings", "captionTiming", "videoProjectId", "createdAt", "updatedAt"]) assert.ok(k in fresh, k);
  assert.equal(fresh.backgroundTrackId, null);
});

test("video aktarımı: kıta altyazıları satır zamanından çıkar; zaman yoksa eşit dağıtılır; üst sınıra uyar", () => {
  const text = "bir\niki\n\nüç\ndört";
  const t = [{ lineId: "s0l0", startMs: 1000, endMs: 2000 }, { lineId: "s0l1", startMs: 2000, endMs: 3000 }, { lineId: "s1l0", startMs: 5000, endMs: 6000 }, { lineId: "s1l1", startMs: 6000, endMs: 7000 }];
  const c = stanzaCues(text, t, 10);
  assert.equal(c.length, 2); assert.equal(c[0].start, 1); assert.equal(c[0].end, 3); assert.equal(c[1].start, 5); assert.equal(c[1].text, "üç\ndört");
  const even = stanzaCues(text, [], 8);
  assert.equal(even.length, 2); assert.equal(even[0].start, 0); assert.equal(even[1].end, 8);
  const many = stanzaCues(Array.from({ length: 50 }, (_, i) => `satır ${i}`).join("\n\n"), [], 100, 28);
  assert.ok(many.length <= 28); assert.ok(many.every((x) => x.end > x.start));
});

// ---------- Gezinme ve ayarlar ----------
test("gezinme: dört ana modül; alt bölümler doğru modüle bağlanır; her bölüm bir modüle aittir", () => {
  assert.deepEqual(MAIN_NAV.map((n) => n.label), ["Ana Panel", "Ses Stüdyosu", "Video Stüdyosu", "Yayın Stüdyosu"]);
  assert.deepEqual(GROUPS.find((g) => g.id === "studio")!.items.map((n) => n.label), ["Yeni Kayıt", "Şiirlerim", "Kayıt Denemelerim", "Kayıtlı Şiirlerim", "Fon Müziklerim", "Stüdyo Ayarları"]);
  assert.deepEqual(GROUPS.find((g) => g.id === "live")!.items.map((n) => n.label), ["Canlı Yayın Masası", "Yayın Akışlarım", "Ses Efektleri", "Yayın Ayarları"]);
  for (const s of STUDIO_SECTIONS) assert.equal(moduleOf(s), "studio");
  for (const s of LIVE_SECTIONS) assert.equal(moduleOf(s), "live");
  assert.equal(moduleOf("video"), "video"); assert.equal(moduleOf("archive"), "video"); assert.equal(moduleOf("home"), "home");
  for (const s of SECTIONS) assert.ok(["home", "studio", "video", "live"].includes(moduleOf(s)), s);
});

test("yayın ayarları: bozuk girdi güvenli varsayılana döner; eski ayarlar yayın alanı olmadan açılır", () => {
  const d = defaultSettings().broadcast;
  assert.deepEqual(sanitizeBroadcast(null), d);
  const b = sanitizeBroadcast({ volumes: { mic: 9, music: -1, voice: "x" }, duck: { amountDb: 999, thresholdDb: 5, enabled: "evet" }, micToOutput: "evet", darkMode: 3 });
  assert.equal(b.volumes.mic, 1); assert.equal(b.volumes.music, 0); assert.equal(b.volumes.voice, d.volumes.voice);
  assert.equal(b.duck.amountDb, 30); assert.equal(b.duck.thresholdDb, -15); assert.equal(b.micToOutput, false);
  const legacy = sanitizeSettings({ schemaVersion: 1, audio: { deviceId: "x", countdownSec: 5 }, reading: { speed: 40 } });
  assert.deepEqual(legacy.broadcast, d); assert.equal(legacy.audio.countdownSec, 5); assert.equal(legacy.reading.speed, 40);
  for (const s of ["live", "flows", "sfx", "live-settings", "performances"]) assert.equal(sanitizeSettings({ appearance: { startSection: s } }).appearance.startSection, s);
});

test("eski şiir kayıtları yeni alanlar olmadan açılır; okuma ayarı yazı büyüklüğüyle genişler", () => {
  const old = migrateProject({ id: "p", title: "Eski", text: "a", trackId: null });
  assert.equal(old.title, "Eski"); assert.equal(old.category, undefined); assert.equal(old.readingNotes, undefined);
  const nw = migrateProject({ id: "p", title: "Yeni", text: "a", category: "  doğa ", readingNotes: "yavaş", reading: { speed: 30, fontScale: 9 } });
  assert.equal(nw.category, "doğa"); assert.equal(nw.readingNotes, "yavaş"); assert.deepEqual(nw.reading, { speed: 30, fontScale: 1.6 });
  assert.deepEqual(sanitizeReading({ fontScale: 1.2 }), { fontScale: 1.2 }); assert.equal(sanitizeReading({}), undefined);
});
