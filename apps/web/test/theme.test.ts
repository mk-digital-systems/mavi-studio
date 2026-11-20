import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { libraryToBackup, parseAnyBackup, parseBackup, projectToBackup } from "../src/storage/backup";
import { migrateProject } from "../src/storage/migrate";
import { applyPreset, defaultFx } from "../src/audio/fx/settings";

const dir = path.join(import.meta.dirname, "../src");
const base = readFileSync(path.join(dir, "styles.css"), "utf8"), panel = readFileSync(path.join(dir, "panel.css"), "utf8");
const block = (css: string, start: string) => { const i = css.indexOf(start); return css.slice(i, css.indexOf("}", i)); };
const tokens = (blk: string) => Object.fromEntries([...blk.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]])) as Record<string, string>;
const dark = tokens(block(base, ":root {")), light = { ...dark, ...tokens(block(panel, ':root[data-theme="light"]')) };

const lum = (hex: string) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg: string, bg: string, a: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, "0")).join("");

for (const [name, t] of [["koyu", dark], ["açık", light]] as const) {
  test(`${name} tema: metin ve etkileşim renkleri tüm yüzeylerde WCAG AA (≥ 4,5:1), ana metin ≥ 7:1`, () => {
    for (const s of ["bg", "bg2", "surface", "surface2"]) {
      assert.ok(ratio(t.text, t[s]) >= 7, `metin/${s}: ${ratio(t.text, t[s]).toFixed(2)}`);
      for (const k of ["muted", "accent", "ok"]) assert.ok(ratio(t[k], t[s]) >= 4.5, `${k}/${s}: ${ratio(t[k], t[s]).toFixed(2)}`);
    }
    assert.ok(ratio(t["accent-ink"], t.accent) >= 4.5, `birincil düğme (açık uç): ${ratio(t["accent-ink"], t.accent).toFixed(2)}`);
    assert.ok(ratio(t["accent-ink"], t.accent2) >= 4.5, `birincil düğme (koyu uç): ${ratio(t["accent-ink"], t.accent2).toFixed(2)}`);
    assert.ok(ratio(t["danger-ink"], t.danger) >= 4.5, `tehlike düğmesi: ${ratio(t["danger-ink"], t.danger).toFixed(2)}`);
    // uyarı kutuları: yarı saydam renkli arka plan üstünde yazı
    for (const [ink, tint, a] of [["alert-ink", "danger", 0.1], ["warn-ink", "accent", 0.1], ["note-ink", "ok", 0.08]] as const)
      for (const s of ["surface", "bg"]) assert.ok(ratio(t[ink], mix(t[tint], t[s], a)) >= 4.5, `${ink} (${s}): ${ratio(t[ink], mix(t[tint], t[s], a)).toFixed(2)}`);
    assert.ok(ratio(t.accent, t.bg) >= 3, "odak halkası ≥ 3:1");
    assert.ok(ratio(t.line, t.bg) >= 1.1, "yüzey sınırı seçilebilir");
  });
}

test("açık tema, koyu temanın bütün renk değişkenlerini geçersiz kılar (yarım tema kalmaz)", () => {
  const overridden = Object.keys(tokens(block(panel, ':root[data-theme="light"]')));
  for (const k of Object.keys(dark)) assert.ok(overridden.includes(k), `açık temada --${k} tanımlanmamış`);
});

// ---------- Tüm çalışmaların yedeği ----------
const file = (o: unknown) => new File([typeof o === "string" ? o : JSON.stringify(o)], "b.json");

test("kütüphane yedeği: çok proje gidiş-dönüş; ses/müzik içermez; tek proje yedeği de aynı yoldan okunur", async () => {
  const a = { ...migrateProject({ id: "1", title: "Özlemimsin", text: "a\nb", trackId: "trk_0004" }), fx: applyPreset(defaultFx(), "warm") };
  const b = migrateProject({ id: "2", title: "İkinci", text: "c" });
  const bk = libraryToBackup([a, b]);
  assert.equal(bk.format, "siir-studyosu-library"); assert.equal(bk.projects.length, 2);
  assert.ok(!/chunk|blob|private:|filePath|base64|\.flac/i.test(JSON.stringify(bk)));
  const back = await parseAnyBackup(file(bk));
  assert.deepEqual(back.map((x) => x.title), ["Özlemimsin", "İkinci"]); assert.equal(back[0].trackId, "trk_0004"); assert.equal(back[0].fx.preset, "warm");
  assert.equal((await parseAnyBackup(file(projectToBackup(a)))).length, 1);
  assert.equal((await parseBackup(file(projectToBackup(b)))).title, "İkinci");
});

test("kütüphane yedeği: bozuk, sınır aşan ve kötü niyetli girdiler reddedilir ya da güvenli hale gelir", async () => {
  const lib = (projects: unknown, o: Record<string, unknown> = {}) => ({ format: "siir-studyosu-library", version: 1, exportedAt: "x", projects, ...o });
  for (const bad of ["{}", "[]", "yok", JSON.stringify(lib("x")), JSON.stringify(lib([], { version: 2 })), JSON.stringify(lib([{ title: 5, text: "x" }])), JSON.stringify(lib([null])),
    JSON.stringify(lib([{ title: "t", text: "x".repeat(50_001) }])), JSON.stringify(lib(Array.from({ length: 501 }, () => ({ title: "t", text: "m" }))))])
    await assert.rejects(parseAnyBackup(file(bad)), undefined, bad.slice(0, 60));
  await assert.rejects(parseAnyBackup(new File([new Uint8Array(10_000_001)], "big.json")));
  const ok = await parseAnyBackup(file(lib([{ title: "T", text: "m", trackId: "../x", createdAt: "bozuk", fx: { preset: "<s>" }, mix: { format: "flac" } }])));
  assert.equal(ok[0].trackId, null); assert.equal(ok[0].fx.preset, "clean"); assert.equal(ok[0].mix.format, "wav");
});
