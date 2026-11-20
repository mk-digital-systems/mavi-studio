import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPreset, CONTROL_RANGES, defaultFx, LIMITS, PRESETS, PRESET_ORDER, resolveParams, sanitizeFx } from "../src/audio/fx/settings";
import { migrateProject, migrateTake, effectiveFx } from "../src/storage/migrate";

test("8 hazır atmosfer var ve değerleri güvenli aralıkta", () => {
  assert.equal(PRESET_ORDER.length, 8);
  assert.deepEqual(PRESET_ORDER.map((id) => PRESETS[id].label), [
    "Temiz Stüdyo", "Sıcak Stüdyo", "Yakın ve Samimi", "Küçük Salon", "Büyük Salon", "Sahne", "Sinematik Şiir", "Radyo Atmosferi"]);
  for (const id of PRESET_ORDER) {
    const p = PRESETS[id];
    for (const k of Object.keys(CONTROL_RANGES) as (keyof typeof CONTROL_RANGES)[]) {
      assert.ok(p.defaults[k] >= CONTROL_RANGES[k].min && p.defaults[k] <= CONTROL_RANGES[k].max, `${id}.${k}`);
    }
    assert.ok(p.shape.decaySec <= LIMITS.maxDecaySec, `${id} decay`);
    const r = resolveParams(defaultFx(id));
    assert.ok(r.wet <= LIMITS.maxWet, `${id} wet`);
    assert.ok(r.wet <= 0.2, `${id} varsayılan yankı ölçülü`);
  }
});

test("yankı kaydırıcısı en uçta bile %25'i aşmaz, süre 3 sn'yi aşmaz", () => {
  for (const id of PRESET_ORDER) {
    const s = { ...defaultFx(id), controls: { ...defaultFx(id).controls, reverb: 100 } };
    const r = resolveParams(s);
    assert.ok(r.wet <= 0.25 + 1e-9); assert.ok(r.reverb.decaySec <= 3);
  }
});

test("atmosfer değişimi kontrolleri günceller, çıkış seviyesini korur", () => {
  const s = { ...defaultFx("clean"), controls: { ...defaultFx("clean").controls, outputDb: 2 } };
  const n = applyPreset(s, "cinematic");
  assert.equal(n.preset, "cinematic"); assert.equal(n.controls.reverb, PRESETS.cinematic.defaults.reverb); assert.equal(n.controls.outputDb, 2);
});

test("geçersiz ayarlar güvenli varsayılana döner", () => {
  const d = defaultFx();
  for (const bad of [null, undefined, 5, "x", [], {}, { preset: "yok" }, { controls: "x" }, { schemaVersion: 99 }]) {
    const s = sanitizeFx(bad);
    assert.equal(s.schemaVersion, 1); assert.equal(s.preset, "clean"); assert.equal(s.enabled, true);
    assert.deepEqual(s.controls, d.controls);
  }
  const s = sanitizeFx({ preset: "warm", enabled: "evet", controls: { reverb: 9999, warmth: -5, clarity: NaN, width: Infinity, cleanliness: "a", outputDb: 50 }, bypass: { reverb: true, gate: 1, saçma: true } });
  assert.equal(s.preset, "warm"); assert.equal(s.enabled, true);
  assert.equal(s.controls.reverb, 100); assert.equal(s.controls.warmth, 0); assert.equal(s.controls.outputDb, 6);
  assert.equal(s.controls.clarity, PRESETS.warm.defaults.clarity); assert.equal(s.controls.cleanliness, PRESETS.warm.defaults.cleanliness);
  assert.deepEqual(s.bypass, { reverb: true });
});

test("ayarlar JSON gidiş-dönüşte aynı kalır", () => {
  const s = { ...applyPreset(defaultFx(), "stage"), bypass: { deesser: true as const } };
  assert.deepEqual(sanitizeFx(JSON.parse(JSON.stringify(s))), s);
});

test("eski şema (v1, fx yok) varsayılan ayarlarla açılır", () => {
  const v1 = { id: "p1", schemaVersion: 1, ownerId: null, anonymousSessionId: "a", title: "Eski", text: "dize", trackId: "trk_0001",
    primaryTakeId: null, status: "recorded", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" };
  const p = migrateProject(v1);
  assert.equal(p.schemaVersion, 2); assert.equal(p.title, "Eski"); assert.equal(p.trackId, "trk_0001"); assert.equal(p.status, "recorded");
  assert.deepEqual(p.fx, defaultFx());
  assert.equal(migrateProject(null).schemaVersion, 2);
  assert.equal(migrateProject({ ...v1, fx: { preset: "warm", controls: { reverb: 1e9 } } }).fx.controls.reverb, 100);
});

test("deneme göçü ve etkin ayar seçimi", () => {
  const p = migrateProject({ id: "p" }); const base = { id: "t", projectId: "p" } as never;
  assert.equal(migrateTake(base).fx, undefined);
  assert.equal(effectiveFx(p, migrateTake(base)), p.fx);
  const t = migrateTake({ id: "t", projectId: "p", fx: { preset: "vintage" } });
  assert.equal(effectiveFx(p, t).preset, "vintage");
});
