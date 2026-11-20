import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBackup, projectToBackup } from "../src/storage/backup";
import { migrateProject } from "../src/storage/migrate";
import { applyPreset, defaultFx } from "../src/audio/fx/settings";

const file = (o: unknown, name = "b.json") => new File([typeof o === "string" ? o : JSON.stringify(o)], name);

test("v2 yedek: efekt ayarlarıyla gidiş-dönüş; ses/müzik/yol içermez", async () => {
  const p = { ...migrateProject({ id: "1", title: "Şiir", text: "a\nb", trackId: "trk_0003" }), fx: { ...applyPreset(defaultFx(), "big-hall"), bypass: { deesser: true as const } } };
  const bk = projectToBackup(p);
  assert.equal(bk.version, 2);
  const back = await parseBackup(file(bk));
  assert.equal(back.title, "Şiir"); assert.equal(back.trackId, "trk_0003"); assert.deepEqual(back.fx, p.fx);
  assert.ok(!/chunk|blob|private:|filePath|base64|\.flac|\.mp3/i.test(JSON.stringify(bk)), "ses/müzik içermemeli");
});

test("v1 yedek (fx yok) varsayılan ayarla açılır", async () => {
  const v1 = { format: "siir-studyosu-project", version: 1, exportedAt: "x", project: { title: "T", text: "m", trackId: null, createdAt: "2026-01-01T00:00:00Z" } };
  assert.deepEqual((await parseBackup(file(v1))).fx, defaultFx());
});

test("bozuk/kötü niyetli fx güvenli varsayılana döner; geçersiz yedek reddedilir", async () => {
  const bad = { format: "siir-studyosu-project", version: 2, exportedAt: "x", project: { title: "T", text: "m", trackId: "../x", createdAt: "bozuk", fx: { preset: "<script>", controls: { reverb: "1e9" }, bypass: { __proto__: { x: 1 } } } } };
  const r = await parseBackup(file(bad));
  assert.deepEqual(r.fx, defaultFx()); assert.equal(r.trackId, null);
  for (const s of ["{}", "[]", "yok", JSON.stringify({ ...bad, version: 3 }), JSON.stringify({ ...bad, format: "x" })]) await assert.rejects(parseBackup(file(s)));
  await assert.rejects(parseBackup(new File([new Uint8Array(1_000_001)], "big.json")));
});
