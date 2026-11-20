import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { applyPreset, defaultFx } from "../src/audio/fx/settings";
import { defaultMix } from "../src/shared/mix";
import { _useStore, defaultSettings, getSettings, migrateLegacyPrefs, resetSettings, sanitizeSettings, SECTIONS, updateSettings } from "../src/shared/settings";
import { migrateProject, sanitizeReading } from "../src/storage/migrate";

class MemStore { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }
let mem: MemStore;
beforeEach(() => { mem = new MemStore(); _useStore(mem); });

test("varsayılanlar: yalnızca desteklenen alanlar, güvenli aralıkta", () => {
  const d = defaultSettings();
  assert.deepEqual(d.audio, { deviceId: "", countdownSec: 3 });
  assert.deepEqual(d.newProject.fx, defaultFx()); assert.deepEqual(d.newProject.mix, defaultMix());
  assert.equal(d.reading.speed, 28); assert.equal(d.appearance.startSection, "home");
  assert.deepEqual(sanitizeSettings(d), d, "varsayılan kendi doğrulamasından değişmeden geçer");
});

test("bozuk/kötü niyetli ayarlar güvenli varsayılana döner ve aralıklara sıkışır", () => {
  const d = defaultSettings();
  for (const bad of [null, undefined, 5, "x", [], { audio: 5 }, { newProject: "x" }]) assert.deepEqual(sanitizeSettings(bad), d);
  const s = sanitizeSettings({
    audio: { deviceId: "x".repeat(500), countdownSec: 7 }, reading: { speed: 9999, fontScale: -1, lineHeight: NaN, autoScroll: "evet" },
    appearance: { theme: "neon", textScale: 50, sidebar: "gizli", startSection: "<script>" },
    video: { target: "myspace", orientation: "x", palette: "y", captions: 1, showTitle: null },
    music: { favorites: ["trk_0001", "trk_0001", "../x", 5, "trk_0002"] },
    newProject: { fx: { preset: "<x>", controls: { reverb: 1e9 } }, mix: { format: "flac", music: { gainDb: 99 } } },
  });
  assert.equal(s.audio.deviceId.length, 200); assert.equal(s.audio.countdownSec, 3);
  assert.deepEqual(s.reading, { speed: 90, fontScale: 0.8, lineHeight: 1.5, autoScroll: true });
  assert.deepEqual(s.appearance, { theme: "system", textScale: 1.3, sidebar: "full", startSection: "home" });
  assert.deepEqual(s.video, d.video); assert.deepEqual(s.music.favorites, ["trk_0001", "trk_0002"]);
  assert.equal(s.newProject.fx.preset, "clean"); assert.equal(s.newProject.fx.controls.reverb, 100);
  assert.equal(s.newProject.mix.format, "wav"); assert.equal(s.newProject.mix.music.gainDb, 0);
  for (const sec of SECTIONS) assert.equal(sanitizeSettings({ appearance: { startSection: sec } }).appearance.startSection, sec);
});

test("saklama: güncelleme doğrulanır, kaydedilir, yeniden okunur; bozuk kayıt varsayılana döner", () => {
  updateSettings((s) => ({ ...s, reading: { ...s.reading, speed: 44 }, appearance: { ...s.appearance, theme: "light" } }));
  assert.equal(getSettings().reading.speed, 44);
  _useStore(mem); // önbelleği sıfırla: depodan okunmalı
  assert.equal(getSettings().reading.speed, 44); assert.equal(getSettings().appearance.theme, "light");
  updateSettings((s) => ({ ...s, reading: { ...s.reading, speed: 1e9 } })); assert.equal(getSettings().reading.speed, 90, "yazarken de sıkıştırılır");
  mem.setItem("siir.settings", "{bozuk"); _useStore(mem); assert.deepEqual(getSettings(), defaultSettings());
  resetSettings(); assert.equal(mem.getItem("siir.settings"), null);
});

test("depo yoksa/dolu ise bellekte çalışır, hata fırlatmaz", () => {
  _useStore(undefined);
  updateSettings((s) => ({ ...s, audio: { ...s.audio, countdownSec: 5 } })); assert.equal(getSettings().audio.countdownSec, 5);
  _useStore({ getItem: () => null, setItem: () => { throw new Error("kota"); }, removeItem: () => {} });
  updateSettings((s) => ({ ...s, audio: { ...s.audio, countdownSec: 0 } })); assert.equal(getSettings().audio.countdownSec, 0);
});

test("eski tercihler (siir.prefs) yeni şemaya taşınır; yeni ayar varsa eskisi yok sayılır", () => {
  mem.setItem("siir.prefs", JSON.stringify({ countFrom: 5, speed: 60, deviceId: "abc" })); _useStore(mem);
  const s = getSettings(); assert.equal(s.audio.countdownSec, 5); assert.equal(s.reading.speed, 60); assert.equal(s.audio.deviceId, "abc");
  assert.deepEqual(migrateLegacyPrefs({ countFrom: 99, speed: "x" }).audio.countdownSec, 3);
  updateSettings((x) => ({ ...x, reading: { ...x.reading, speed: 12 } })); _useStore(mem); assert.equal(getSettings().reading.speed, 12);
});

test("genel ayar ile proje ayrımı: genel varsayılan yeni projeye geçer, proje içi değer genel ayarı ezer ve geri etkilemez", () => {
  const fx = applyPreset(defaultFx(), "cinematic");
  updateSettings((s) => ({ ...s, newProject: { ...s.newProject, fx, mix: { ...s.newProject.mix, reader: "Mustafa Öner", music: { ...s.newProject.mix.music, gainDb: -24 } } }, reading: { ...s.reading, speed: 40 } }));
  // yeni proje (migrateProject, newProject ile aynı varsayılanları kullanan saf yol): proje, eski kayıt gibi kendi değerlerini taşır
  const g = getSettings();
  const project = { ...migrateProject({ id: "p1", title: "Özlemimsin" }), fx: g.newProject.fx, mix: g.newProject.mix };
  assert.equal(project.fx.preset, "cinematic"); assert.equal(project.mix.reader, "Mustafa Öner"); assert.equal(project.mix.music.gainDb, -24);
  // projede değişiklik genel ayarı değiştirmez
  project.mix = { ...project.mix, music: { ...project.mix.music, gainDb: -10 } };
  assert.equal(getSettings().newProject.mix.music.gainDb, -24);
  // okuma hızı: proje değeri yoksa genel; varsa proje
  assert.equal(project.reading?.speed ?? getSettings().reading.speed, 40);
  const withSpeed = migrateProject({ id: "p2", reading: { speed: 55 } }); assert.equal(withSpeed.reading?.speed ?? getSettings().reading.speed, 55);
  // genel ayar sonradan değişse de projedeki değer sabit kalır
  updateSettings((s) => ({ ...s, reading: { ...s.reading, speed: 20 } })); assert.equal(withSpeed.reading?.speed, 55);
});

test("projeye özel okuma tercihi doğrulanır; eski projelerde yoktur", () => {
  assert.deepEqual(sanitizeReading({ speed: 9999 }), { speed: 90 }); assert.deepEqual(sanitizeReading({ speed: 1 }), { speed: 8 });
  for (const bad of [null, undefined, {}, { speed: "x" }, { speed: NaN }, 5]) assert.equal(sanitizeReading(bad), undefined);
  assert.equal("reading" in migrateProject({ id: "eski" }), false);
  assert.deepEqual(migrateProject({ id: "x", reading: { speed: 33 } }).reading, { speed: 33 });
});
