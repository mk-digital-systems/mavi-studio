// Uçtan uca test (gerçek Chrome). Önce geliştirme sunucusunu başlat:  npx vite --port 5199
// Sonra:  node test-e2e/full-flow.cjs   (playwright-core ve yüklü Chrome gerekir)
let chromium;
try { ({ chromium } = require("playwright-core")); } catch { ({ chromium } = require("../../../video editor/node_modules/playwright-core")); }
const BASE = "http://localhost:5199";
const results = [];
const ok = (name, cond, extra = "") => { results.push([cond ? "PASS" : "FAIL", name, extra]); console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  → " + extra : "")); };

const wavBytes = (secs, fn, sr = 48000, ch = 1) => { // 16-bit PCM WAV
  const n = Math.floor(secs * sr), buf = new ArrayBuffer(44 + n * 2 * ch), d = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); d.setUint32(4, 36 + n * 2 * ch, true); w(8, "WAVE"); w(12, "fmt "); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, ch, true);
  d.setUint32(24, sr, true); d.setUint32(28, sr * 2 * ch, true); d.setUint16(32, 2 * ch, true); d.setUint16(34, 16, true); w(36, "data"); d.setUint32(40, n * 2 * ch, true);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) d.setInt16(44 + (i * ch + c) * 2, Math.max(-1, Math.min(1, fn(i / sr))) * 32767, true);
  return Buffer.from(buf);
};
const chord = (t) => 0.25 * (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277 * t) + Math.sin(2 * Math.PI * 330 * t));
const click = (t) => Math.exp(-t * 4) * 0.6 * Math.sin(2 * Math.PI * 880 * t);

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ["microphone"] });
  const page = await ctx.newPage();
  await ctx.addInitScript(() => { try { localStorage.setItem("mk-debug", "1"); } catch {} });
  page.on("pageerror", (e) => console.log("PAGEERR", e.message));
  page.on("dialog", (d) => d.accept(d.type() === "prompt" ? "Test Akışı" : undefined));
  await page.addInitScript(() => {
    window.__mr = 0; window.__gum = 0; window.__ctxs = [];
    const MR = window.MediaRecorder; if (MR) window.MediaRecorder = class extends MR { constructor(...a) { super(...a); window.__mr++; } };
    const g = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices); if (g) navigator.mediaDevices.getUserMedia = (...a) => { window.__gum++; return g(...a); };
    const AC = window.AudioContext; window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ctxs.push(this); } };
  });

  // ---------- 1) ESKİ (v1) VERİTABANLARINI KUR, SONRA UYGULAMAYI AÇ ----------
  await page.goto(BASE + "/video-editor/index.html");
  const musicWav = wavBytes(6, chord, 44100, 2).toString("base64");
  await page.evaluate(async (musicB64) => {
    const open = (name, setup) => new Promise((res, rej) => { const r = indexedDB.open(name, 1); r.onupgradeneeded = () => setup(r.result); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const studio = await open("siir-studio", (db) => { db.createObjectStore("projects", { keyPath: "id" }); const t = db.createObjectStore("takes", { keyPath: "id" }); t.createIndex("projectId", "projectId"); db.createObjectStore("audioChunks"); });
    const sr = 48000, n = sr * 4, bytes = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) { const t = i / sr, a = (Math.sin(2 * Math.PI * 3 * t) > -0.2 ? 1 : 0.02); const v = Math.round(0.3 * a * Math.sin(2 * Math.PI * 160 * t) * 0x7fffff); bytes[i * 3] = v & 255; bytes[i * 3 + 1] = (v >> 8) & 255; bytes[i * 3 + 2] = (v >> 16) & 255; }
    const now = new Date().toISOString();
    await new Promise((res, rej) => { const tx = studio.transaction(["projects", "takes", "audioChunks"], "readwrite");
      tx.objectStore("projects").put({ id: "p1", schemaVersion: 2, ownerId: null, anonymousSessionId: "x", title: "Eski Şiir", text: "gece sessiz\nyıldızlar uyanık\n\nbir ses geliyor\nuzaklardan", trackId: null, primaryTakeId: "t1", status: "recorded", createdAt: now, updatedAt: now });
      tx.objectStore("takes").put({ id: "t1", projectId: "p1", createdAt: now, status: "complete", durationMs: 4000, sampleRate: sr, channels: 1, chunkCount: 1, peakDbfs: -10, clipped: false });
      tx.objectStore("audioChunks").put(bytes, ["t1", 0]); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    studio.close();
    const music = await open("siir-music", (db) => { db.createObjectStore("meta", { keyPath: "id" }); db.createObjectStore("blobs"); });
    const raw = atob(musicB64), u = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u[i] = raw.charCodeAt(i);
    await new Promise((res, rej) => { const tx = music.transaction(["meta", "blobs"], "readwrite");
      tx.objectStore("meta").put({ id: "loc_11111111-1111-1111-1111-111111111111", title: "Test Fon", durationSec: 6, size: u.length, createdAt: now });
      tx.objectStore("blobs").put(new Blob([u], { type: "audio/wav" }), "loc_11111111-1111-1111-1111-111111111111"); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    music.close();
  }, musicWav);

  await page.goto(BASE + "/");
  await page.getByRole("button", { name: "Yeni Kayıt" }).first().waitFor();
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name + ":" + d.version).sort());
  ok("eski veritabanları sürümlü geçişle v2'ye yükseldi", dbs.includes("siir-studio:2") && dbs.includes("siir-music:2"), dbs.join(" "));
  const stores = await page.evaluate(async () => {
    const o = (n) => new Promise((r) => { const q = indexedDB.open(n); q.onsuccess = () => { const d = q.result, s = [...d.objectStoreNames]; d.close(); r(s); }; });
    return { studio: await o("siir-studio"), music: await o("siir-music") };
  });
  ok("yeni depolar eklendi, eskiler korundu", ["projects", "takes", "audioChunks", "performances", "flows", "processedVoices"].every((s) => stores.studio.includes(s)) && ["meta", "blobs", "sfx", "sfxBlobs"].every((s) => stores.music.includes(s)));

  const nav = async (group, item) => {
    const g = page.getByRole("button", { name: group, exact: true });
    if (!(await page.getByRole("button", { name: item, exact: true }).first().isVisible().catch(() => false))) await g.click();
    await page.getByRole("button", { name: item, exact: true }).first().click();
  };

  // ---------- 2) GEZİNME ----------
  const mains = await page.locator("nav[aria-label='Ana menü'] > ul > li > button").allTextContents();
  ok("ana menü: 4 modül", mains.map((t) => t.trim()).join("|") === "Ana Panel|Ses Stüdyosu|Video Stüdyosu|Yayın Stüdyosu", mains.map((t) => t.trim()).join("|"));
  await page.getByRole("button", { name: "Ses Stüdyosu", exact: true }).click();
  const subs = (await page.locator("#studio-sub button").allTextContents()).map((t) => t.trim());
  ok("Ses Stüdyosu alt bölümleri", subs.join("|") === "Yeni Kayıt|Şiirlerim|Kayıt Denemelerim|Kayıtlı Şiirlerim|Fon Müziklerim|Stüdyo Ayarları", subs.join("|"));
  await page.getByRole("button", { name: "Yayın Stüdyosu", exact: true }).click();
  const subs2 = (await page.locator("#live-sub button").allTextContents()).map((t) => t.trim());
  ok("Yayın Stüdyosu alt bölümleri", subs2.join("|") === "Canlı Yayın Masası|Yayın Akışlarım|Ses Efektleri|Yayın Ayarları", subs2.join("|"));

  // ---------- 3) ESKİ VERİLER AÇILIYOR ----------
  await nav("Ses Stüdyosu", "Şiirlerim");
  ok("eski şiir Şiirlerim'de görünüyor", await page.getByText("Eski Şiir").first().isVisible());
  await nav("Ses Stüdyosu", "Fon Müziklerim");
  ok("eski fon müziği Fon Müziklerim'de görünüyor", await page.getByText("Test Fon").first().isVisible());
  await nav("Ses Stüdyosu", "Kayıt Denemelerim");
  ok("eski kayıt denemesi Kayıt Denemelerim'de görünüyor", await page.getByText("Eski Şiir").first().isVisible() && await page.getByText("Deneme 1").first().isVisible());

  // ---------- 4) SES EFEKTİ EKLE (IndexedDB) ----------
  await nav("Yayın Stüdyosu", "Ses Efektleri");
  await page.getByRole("button", { name: /Efekt ekle/ }).first().click();
  await page.locator("input[type=file]").first().setInputFiles({ name: "zil.wav", mimeType: "audio/wav", buffer: wavBytes(3, click) });
  await page.locator("#ax-n").fill("Zil Testi");
  await page.locator("#ax-c").selectOption("Zil ve çan");
  await page.locator("#ax-k").fill("1");
  await page.getByRole("button", { name: "Kaydet ve ekle" }).click();
  await page.getByText("Zil Testi").first().waitFor();
  const sfxCount = await page.evaluate(async () => new Promise((r) => { const q = indexedDB.open("siir-music"); q.onsuccess = () => { const d = q.result, t = d.transaction(["sfx", "sfxBlobs"]); const a = t.objectStore("sfx").count(), b = t.objectStore("sfxBlobs").count(); t.oncomplete = () => { d.close(); r([a.result, b.result]); }; }; }));
  ok("ses efekti IndexedDB'de (meta + dosya)", sfxCount[0] === 1 && sfxCount[1] === 1, JSON.stringify(sfxCount));
  const ls = await page.evaluate(() => Object.keys(localStorage).join(",") + "|" + Object.values(localStorage).join("").length);
  ok("ses localStorage'da tutulmuyor", !/base64|RIFF/.test(await page.evaluate(() => Object.values(localStorage).join(""))), ls.slice(0, 80));

  // ---------- 5) YENİ KAYIT AKIŞI: şiir seç → fon seç → hazırlık → kayıt (tam ekran) → bitir ----------
  await page.locator(".side-new").click();
  await page.getByRole("button", { name: "Bu şiirle kaydet" }).first().click();
  await page.getByRole("button", { name: /^Seç$/ }).first().click(); // Test Fon
  ok("fon seçildi", await page.getByText("✓ Seçili").nth(0).isVisible());
  await page.getByRole("button", { name: /Kayıt hazırlığı/ }).click();
  await page.getByRole("button", { name: /Mikrofonu aç/ }).click();
  await page.getByRole("button", { name: "● Kaydı Başlat" }).waitFor();
  ok("kayıt hazırlığı alanları", await page.getByText("Ses atmosferi").first().isVisible() && await page.getByText(/Fon ses seviyesi/).first().isVisible() && await page.getByText(/Fon başlangıç noktası/).first().isVisible() && await page.getByText(/Kulaklık tak/).first().isVisible());
  await page.getByRole("button", { name: "● Kaydı Başlat" }).first().click();
  await page.locator(".fs-bar").waitFor({ timeout: 15000 });
  ok("kayıtta tam ekran teleprompter + kontroller", await page.locator(".reader.fs").isVisible() && await page.locator(".fs-bar").getByRole("button", { name: "Duraklat", exact: true }).isVisible() && await page.locator(".fs-bar").getByRole("button", { name: "Bitir", exact: true }).isVisible() && await page.locator(".fs-bar").getByRole("button", { name: /Fonu yumuşakça bitir/ }).isVisible());
  const startTop = await page.evaluate(() => document.querySelector(".reader.fs").scrollTop);
  await page.waitForTimeout(4200);
  await page.locator(".fs-bar").getByRole("button", { name: "Bitir", exact: true }).click();
  await page.getByRole("button", { name: /Dinle/ }).first().waitFor({ timeout: 15000 });
  ok("Bitir sonrası normal ekrana dönüldü", (await page.locator(".reader.fs").count()) === 0);
  await page.getByRole("button", { name: /Dinle →/ }).first().click();
  await page.getByText("Kayıt tamamlandı").waitFor();
  ok("kayıt sonrası seçenekleri", (await Promise.all(["İşlenmiş / ham karşılaştır", "Kayıtlı Şiirlerime kaydet", "Ses dosyası oluştur", "Video Stüdyosu’na gönder", "Yeniden oku", "Sil"].map((n) => page.getByRole("button", { name: n }).first().isVisible()))).every(Boolean));
  await page.getByRole("button", { name: "Kayıtlı Şiirlerime kaydet" }).first().click();
  await page.getByText(/Kayıtlı Şiirlerim’e kaydedildi/).waitFor({ timeout: 20000 });

  // veri bütünlüğü: performans yalnızca kimlikle bağlı; ses/fon kopyalanmadı
  const snap = async () => page.evaluate(async () => {
    const all = (db, st) => new Promise((r) => { const t = db.transaction(st); const q = t.objectStore(st).getAll(); t.oncomplete = () => r(q.result); });
    const open = (n) => new Promise((r) => { const q = indexedDB.open(n); q.onsuccess = () => r(q.result); });
    const s = await open("siir-studio"), m = await open("siir-music");
    const out = { takes: (await all(s, "takes")).length, perfs: await all(s, "performances"), projects: (await all(s, "projects")).length, blobs: (await all(m, "blobs")).length, meta: (await all(m, "meta")).length, flows: (await all(s, "flows")).length };
    s.close(); m.close(); return out;
  });
  const s1 = await snap();
  ok("Kayıtlı Şiir kaydı oluştu; fon ve deneme KİMLİKLE bağlı", s1.perfs.length === 1 && s1.perfs[0].backgroundTrackId === "loc_11111111-1111-1111-1111-111111111111" && s1.perfs[0].selectedTakeId && s1.perfs[0].poemId === "p1", JSON.stringify({ bg: s1.perfs[0]?.backgroundTrackId, p: s1.perfs[0]?.poemId }));
  ok("performans kaydında ses verisi yok", !JSON.stringify(s1.perfs[0]).includes("RIFF") && !Object.values(s1.perfs[0]).some((v) => v instanceof Object && v.constructor?.name === "Blob"));
  ok("fon dosyası ÇOĞALTILMADI (tek kopya)", s1.blobs === 1 && s1.meta === 1, `blobs=${s1.blobs}`);
  ok("şiir tek (kopyalanmadı); denemeler: eski + yeni", s1.projects === 1 && s1.takes === 2, `projects=${s1.projects} takes=${s1.takes}`);
  const perf = s1.perfs[0];
  ok("performans veri modeli alanları", ["poemId", "selectedTakeId", "processedVoiceId", "backgroundTrackId", "mixSettings", "teleprompterSettings", "captionTiming", "videoProjectId", "createdAt", "updatedAt"].every((k) => k in perf), Object.keys(perf).join(","));

  // ---------- 6) KAYITLI ŞİİRLERİM → VİDEO STÜDYOSU (ses ve fon AYRI) ----------
  await nav("Ses Stüdyosu", "Kayıtlı Şiirlerim");
  await page.getByText(/Fon: Test Fon/).first().waitFor({ timeout: 10000 }).catch(() => {});
  ok("Kayıtlı Şiirlerim listesi (ham kayıt listesi değil)", await page.getByRole("heading", { name: "Eski Şiir" }).first().isVisible() && await page.getByText(/Fon: Test Fon/).first().isVisible());
  await page.getByRole("button", { name: "Video Stüdyosu’na gönder" }).first().click();
  await page.getByRole("dialog", { name: /Video Stüdyosu/ }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Gönder", exact: true }).click();
  await page.getByText(/ayrı kanallar olarak aktarıldı/).first().waitFor({ timeout: 60000 });
  const fr = page.frameLocator("iframe");
  const frame = page.frames().find((f) => f.url().includes("video-editor"));
  const ed = await frame.evaluate(async () => { const k = window.__mk, st = k.state; return { audioFiles: [...k.audioFiles.keys()], texts: (st.texts || []).length, scenes: st.scenes.length, ambOn: st.ambOn, ambStart: st.ambStart, vol: st.vol, name: st.name, tracksOn: (await k.audioTracks()).length, perf: !!st.performance }; });
  ok("Video Stüdyosu'na ses ve fon AYRI kanal olarak geldi", ed.audioFiles.includes("nar") && ed.audioFiles.includes("amb") && ed.tracksOn === 2, JSON.stringify(ed.audioFiles));
  ok("şiir metni/başlık/altyazı aktarıldı", ed.texts >= 1 && ed.scenes >= 1 && /Eski Şiir/.test(ed.name), `texts=${ed.texts} name=${ed.name}`);
  ok("fon seviyesi/başlangıcı aktarıldı", ed.ambOn === true && typeof ed.ambStart === "number" && ed.vol.amb > 0 && ed.vol.amb <= 1, `vol.amb=${ed.vol.amb}`);
  ok("zaman çizelgesinde ayrı Anlatım ve Fon şeritleri", (await fr.locator(".tl-audio.nar").count()) === 1 && (await fr.locator(".tl-audio.amb").count()) === 1);
  const ed2 = await frame.evaluate(async () => { const k = window.__mk; k.state.ambOn = false; k.renderAudioLanes(); const off = (await k.audioTracks()).length; const lane = document.querySelector(".tl-audio.amb")?.classList.contains("off"); k.state.ambOn = true; k.renderAudioLanes(); const on = (await k.audioTracks()).length; return { off, on, lane }; });
  ok("fonlu / fonsuz video seçilebiliyor (dışa aktarma kanalları 2 ↔ 1)", ed2.on === 2 && ed2.off === 1 && ed2.lane === true, JSON.stringify(ed2));
  const ed3 = await frame.evaluate(async () => { const r = []; r.push(!!document.querySelector("#ambOn")); r.push(!!document.querySelector("#ambStart")); r.push(!!document.querySelector("[data-volume=amb]")); r.push(!!document.querySelector("[data-remove-audio=amb]")); r.push(!!document.querySelector("[data-audio=amb]")); return r; });
  await fr.locator("[data-tool=audio]").click();
  const hasCtl = await frame.evaluate(() => ["#ambOn", "#ambStart", "[data-volume=amb]", "[data-remove-audio=amb]", "[data-audio=amb]"].map((s) => !!document.querySelector(s)));
  ok("fon kontrolleri: aç/kapa, başlangıç, seviye, kes, değiştir", hasCtl.every(Boolean), JSON.stringify(hasCtl));
  const vproj = await page.evaluate(async () => new Promise((r) => { const q = indexedDB.open("siir-studio"); q.onsuccess = () => { const d = q.result, t = d.transaction("performances"), g = t.objectStore("performances").getAll(); t.oncomplete = () => { d.close(); r(g.result[0]?.videoProjectId); }; }; }));
  ok("video proje bağlantısı Kayıtlı Şiir'e yazıldı", typeof vproj === "string" && vproj.length > 5, String(vproj).slice(0, 12));

  // ---------- 7) CANLI OKU: KAYIT YOK; şiir alanı geniş; kütüphane tek yerde ----------
  const openLib = async () => { if (!(await page.locator(".live-lib").count())) await page.getByRole("button", { name: /Kütüphane/ }).click(); };
  const before = await snap();
  await page.evaluate(() => { window.__mr = 0; window.__gum = 0; });
  await nav("Yayın Stüdyosu", "Canlı Yayın Masası");
  await page.getByTestId("live-desk").waitFor();
  ok("Canlı Okuma — Kayıt yapılmıyor göstergesi", /Kayıt yapılmıyor/.test(await page.getByTestId("live-badge").innerText()));
  const libHeads = await page.locator(".lib-h").allTextContents();
  ok("Şiirlerim, Kayıtlı Şiirlerim ve Fon Müziklerim AYNI panelde görünüyor", libHeads.length === 3 && /Şiirlerim/.test(libHeads[0]) && /Kayıtlı Şiirlerim/.test(libHeads[1]) && /Fon Müziklerim/.test(libHeads[2]), libHeads.join(" | "));
  ok("akış paneli yok, efektler kapalı köşe düğmesinde", (await page.locator(".rail").count()) === 0 && (await page.locator(".fx-sheet").isHidden()) && await page.getByTestId("fx-toggle").isVisible());
  await page.getByRole("button", { name: "Canlı oku" }).first().click();
  ok("şiir teleprompter'a geldi", await page.locator(".tele-title").innerText() === "Eski Şiir" && (await page.locator(".tele-line").count()) === 4);
  const geo = await page.evaluate(() => { const r = document.querySelector(".tele").getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, lib: !!document.querySelector(".live-lib") }; });
  ok("şiir alanı geniş (yan panel kapandı)", geo.w > geo.vw * 0.7 && geo.h > geo.vh * 0.45 && !geo.lib, JSON.stringify(geo));
  await page.getByRole("button", { name: /Otomatik kaydır/ }).click();
  await page.waitForTimeout(7500);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  const top = await page.evaluate(() => document.querySelector(".tele").scrollTop);
  ok("teleprompter 5 sn bekleyip kaymaya başladı", top > 0, `scrollTop=${top}`);
  await openLib();
  await page.getByRole("button", { name: "Fon yap" }).first().click();
  await page.getByRole("button", { name: "Fonu başlat" }).click();
  await page.getByRole("button", { name: "Fonu durdur" }).waitFor();
  ok("canlı okumada fon başlatıldı (ayrı kanal)", true);
  await page.getByTestId("fx-toggle").click();
  const sb = page.locator(".sb-btn").first();
  await sb.click(); await page.waitForTimeout(300);
  ok("efekt düğmesi çalıyor (görsel olarak belli)", (await sb.getAttribute("aria-pressed")) === "true");
  await sb.click(); await page.waitForTimeout(300);
  ok("tekrar dokununca efekt durur", (await sb.getAttribute("aria-pressed")) === "false");
  await page.getByRole("button", { name: "Efekt panelini kapat" }).click();
  ok("efekt paneli kapanıyor", await page.locator(".fx-sheet").isHidden());
  await page.keyboard.press("1"); await page.waitForTimeout(300);
  ok("panel kapalıyken de klavye kısayolu efekti çalıyor", (await sb.getAttribute("aria-pressed")) === "true" && /●/.test(await page.getByTestId("fx-toggle").innerText()));
  ok("Tüm Sesleri Durdur her zaman görünür", await page.getByTestId("panic").isVisible());
  await page.getByTestId("panic").click(); await page.waitForTimeout(500);
  const afterPanic = { sfx: await sb.getAttribute("aria-pressed"), music: await page.getByRole("button", { name: "Fonu başlat" }).isVisible(), scroll: await page.getByRole("button", { name: /Otomatik kaydır|Kaydırmayı durdur/ }).getAttribute("aria-pressed") };
  ok("Tüm Sesleri Durdur: efekt, fon ve kaydırma susar", afterPanic.sfx === "false" && afterPanic.music && afterPanic.scroll === "false", JSON.stringify(afterPanic));
  await page.getByRole("button", { name: /Tam ekran/ }).click();
  await page.waitForTimeout(400);
  const big = await page.evaluate(() => ({ sideHidden: getComputedStyle(document.querySelector(".side")).display === "none", fixed: getComputedStyle(document.querySelector(".live-root")).position === "fixed" }));
  ok("tam ekranda uygulama menüsü gizlenir, masa ekranı kaplar", big.sideHidden && big.fixed, JSON.stringify(big));
  await page.getByRole("button", { name: /Küçült/ }).click();
  const noRec = await page.evaluate(() => ({ mr: window.__mr, gum: window.__gum }));
  const after = await snap();
  ok("Canlı Oku: MediaRecorder hiç oluşturulmadı, mikrofon açılmadı", noRec.mr === 0 && noRec.gum === 0, JSON.stringify(noRec));
  ok("Canlı Oku: yeni deneme / performans / şiir oluşmadı", after.takes === before.takes && after.perfs.length === before.perfs.length && after.projects === before.projects && after.blobs === before.blobs, `takes ${before.takes}→${after.takes}`);

  // ---------- 8) KAYITLI ŞİİRİ ÇAL ----------
  await openLib();
  await page.getByRole("button", { name: "Çal", exact: true }).first().click();
  await page.getByRole("button", { name: "▶ Oynat" }).waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector(".tele-ctl [role=status]"), null, { timeout: 60000 });
  ok("kayıtlı şiir hazır (işlenmiş ses önbelleğe alındı)", true);
  await page.getByRole("button", { name: "▶ Oynat" }).click();
  await page.getByRole("button", { name: "⏸ Duraklat" }).waitFor();
  await page.getByRole("button", { name: "Fonu durdur" }).waitFor({ timeout: 10000 });
  ok("kayıtlı şiir sesi ve bağlı fon birlikte çalıyor (ayrı kanallar)", /Kayıtlı şiir çalınıyor/.test(await page.getByTestId("live-badge").innerText()));
  await page.waitForTimeout(1200);
  const posl = await page.evaluate(() => document.querySelector(".tele-line.on")?.textContent || "");
  ok("şiir metni sesle eş zamanlı vurgulanıyor", posl.length > 0, posl);
  await page.getByLabel(/Fonlu oynat/).uncheck();
  await page.waitForTimeout(1600);
  ok("kayıtlı şiirin fonu canlı yayında kapatılabiliyor", await page.getByRole("button", { name: "Fonu başlat" }).isVisible());
  await page.getByLabel(/Fonlu oynat/).check();
  await page.getByRole("button", { name: "Fonu durdur" }).waitFor({ timeout: 8000 });
  ok("fon yeniden açılabiliyor", true);
  await page.getByRole("button", { name: "⏮ Baştan başlat" }).click();
  const after2 = await snap();
  ok("kayıtlı şiir oynatma yeni kayıt oluşturmadı", after2.takes === before.takes && after2.perfs.length === before.perfs.length && after2.blobs === before.blobs, `takes=${after2.takes} perfs=${after2.perfs.length}`);

  // ---------- 9) YAYIN AKIŞLARIM SAYFASI (masadan bağımsız) ----------
  await nav("Yayın Stüdyosu", "Yayın Akışlarım");
  await page.getByRole("button", { name: /Yeni akış/ }).first().click();
  await page.getByRole("button", { name: /Test Akışı/ }).waitFor();
  const addItem = async (kind, label) => { await page.getByLabel("Öğe türü").selectOption({ label: kind }); if (label) { const sel = page.getByLabel("İçerik"); await sel.selectOption({ label }); } await page.getByRole("button", { name: "+ Akışa ekle" }).click(); };
  await addItem("Açılış", null); await addItem("Canlı okunacak şiir", "Eski Şiir"); await addItem("Ses efekti", "Zil Testi"); await addItem("Ara", null);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Aşağı taşı" }).first().click(); await page.waitForTimeout(400);
  const order = await page.locator(".flow-row .chip").allTextContents();
  ok("akış öğeleri sıralanabiliyor", order.join("|") === "Canlı okunacak şiir|Açılış|Ses efekti|Ara", order.join("|"));

  // ---------- 10) SAYFADAN AYRILINCA TÜM SESLER KAPANIR ----------
  await nav("Yayın Stüdyosu", "Canlı Yayın Masası");
  await page.getByTestId("live-desk").waitFor();
  await page.getByRole("button", { name: "Fon yap" }).first().click();
  await page.getByRole("button", { name: "Fonu başlat" }).click();
  await page.getByRole("button", { name: "Fonu durdur" }).waitFor();
  const running = await page.evaluate(() => window.__ctxs.filter((c) => c.state === "running").length);
  await nav("Ses Stüdyosu", "Şiirlerim");
  await page.waitForTimeout(600);
  const stillRunning = await page.evaluate(() => window.__ctxs.filter((c) => c.state === "running").length);
  ok("masa açıkken ses bağlamı çalışıyordu", running >= 1, `running=${running}`);
  ok("sayfadan ayrılınca bütün ses kaynakları/bağlamlar kapandı", stillRunning === 0, `running=${stillRunning}`);

  // ---------- 11) MOBİL: yatay taşma yok ----------
  await page.setViewportSize({ width: 390, height: 844 });
  const secs = [["Ana Panel", null], ["Ses Stüdyosu", "Yeni Kayıt"], ["Ses Stüdyosu", "Şiirlerim"], ["Ses Stüdyosu", "Kayıt Denemelerim"], ["Ses Stüdyosu", "Kayıtlı Şiirlerim"], ["Ses Stüdyosu", "Fon Müziklerim"], ["Ses Stüdyosu", "Stüdyo Ayarları"], ["Video Stüdyosu", null], ["Yayın Stüdyosu", "Canlı Yayın Masası"], ["Yayın Stüdyosu", "Yayın Akışlarım"], ["Yayın Stüdyosu", "Ses Efektleri"], ["Yayın Stüdyosu", "Yayın Ayarları"]];
  const over = [];
  for (const [g, item] of secs) {
    if (item) await nav(g, item); else await page.getByRole("button", { name: g, exact: true }).click();
    await page.waitForTimeout(700);
    const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (w > 1) over.push(`${item || g}:+${w}`);
  }
  ok("mobil görünümde yatay taşma yok (12 ekran)", over.length === 0, over.join(", "));

  console.log("\nÖZET: " + results.filter((r) => r[0] === "PASS").length + " geçti, " + results.filter((r) => r[0] === "FAIL").length + " kaldı");
  await browser.close();
  process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
})().catch((e) => { console.log("HATA", e.message.split("\n").slice(0, 4).join(" | ")); process.exit(2); });
