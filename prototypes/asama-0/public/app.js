// Aşama 0 — atılabilir doğrulama. Ürün kodu değildir.
const $ = (id) => document.getElementById(id);
const TARGET_SR = 48000;

// ---------- IndexedDB (parçalı ses saklama) ----------
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open("siir-a0", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("chunks", { autoIncrement: true });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
  const db = await dbp;
  return new Promise((res, rej) => {
    const t = db.transaction("chunks", mode);
    const out = fn(t.objectStore("chunks"));
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
};
const clearChunks = () => tx("readwrite", (s) => s.clear());
const putChunk = (b) => tx("readwrite", (s) => s.add(b));
const allChunks = () => tx("readonly", (s) => s.getAll());

// ---------- 24-bit paketleme ----------
function f32To24(f32) {
  const out = new Uint8Array(f32.length * 3);
  for (let i = 0, o = 0; i < f32.length; i++, o += 3) {
    let v = Math.max(-1, Math.min(1, f32[i]));
    v = Math.round(v < 0 ? v * 0x800000 : v * 0x7fffff);
    out[o] = v & 255; out[o + 1] = (v >> 8) & 255; out[o + 2] = (v >> 16) & 255;
  }
  return out;
}
function wavFrom24(chunks, sr) {
  const len = chunks.reduce((a, c) => a + c.length, 0);
  const head = new DataView(new ArrayBuffer(44));
  const w = (o, s) => [...s].forEach((c, i) => head.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); head.setUint32(4, 36 + len, true); w(8, "WAVE"); w(12, "fmt ");
  head.setUint32(16, 16, true); head.setUint16(20, 1, true); head.setUint16(22, 1, true);
  head.setUint32(24, sr, true); head.setUint32(28, sr * 3, true); head.setUint16(32, 3, true);
  head.setUint16(34, 24, true); w(36, "data"); head.setUint32(40, len, true);
  return new Blob([head, ...chunks], { type: "audio/wav" });
}

// ---------- Ortam raporu ----------
async function env() {
  const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const types = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"]
    .map((t) => `${t}: ${window.MediaRecorder?.isTypeSupported?.(t)}`).join("\n  ");
  $("env").textContent = [
    `UA: ${navigator.userAgent}`,
    `Güvenli bağlam: ${isSecureContext}`,
    `getUserMedia: ${!!navigator.mediaDevices?.getUserMedia}`,
    `AudioWorklet: ${!!window.AudioWorkletNode}`,
    `OfflineAudioContext: ${!!window.OfflineAudioContext}`,
    `MediaRecorder: ${!!window.MediaRecorder}\n  ${types}`,
    `Wake Lock: ${!!navigator.wakeLock}`,
    `storage.persist: ${!!navigator.storage?.persist}`,
    est ? `Kota: ${(est.quota / 1e6).toFixed(0)} MB, kullanım: ${(est.usage / 1e6).toFixed(1)} MB` : "storage.estimate yok",
  ].join("\n");
}

// ---------- Mikrofon ----------
let ctx, stream, node, srcNode;
async function listDevices() {
  const ds = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
  const sel = $("dev"), cur = sel.value;
  sel.innerHTML = ds.map((d) => `<option value="${d.deviceId}">${d.label || "Mikrofon"}</option>`).join("");
  if (cur) sel.value = cur;
}
async function openMic() {
  closeMic();
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: $("dev").value ? { exact: $("dev").value } : undefined,
      channelCount: 1, sampleRate: TARGET_SR,
      echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    },
  });
  stream.getAudioTracks()[0].addEventListener("ended", () => { $("lvl").textContent = "Cihaz kapandı/çıkarıldı."; if (recording) stopRec("cihaz kaybı"); });
  ctx = new AudioContext({ sampleRate: TARGET_SR, latencyHint: "interactive" });
  await ctx.audioWorklet.addModule("pcm-worklet.js");
  srcNode = ctx.createMediaStreamSource(stream);
  node = new AudioWorkletNode(ctx, "pcm-capture", { numberOfOutputs: 0 });
  srcNode.connect(node);
  node.port.onmessage = onMsg;
  await listDevices();
}
function closeMic() {
  stream?.getTracks().forEach((t) => t.stop());
  ctx?.close(); stream = ctx = node = srcNode = null;
}
let clips = 0;
function onMsg(e) {
  const m = e.data;
  if (m.type === "level") {
    const db = m.peak > 0 ? 20 * Math.log10(m.peak) : -120;
    $("bar").style.width = Math.max(0, Math.min(100, (db + 60) / 60 * 100)) + "%";
    const clip = db > -1; $("bar").classList.toggle("clip", clip);
    if (clip && recording) clips++;
    $("lvl").textContent = `tepe ${db.toFixed(1)} dBFS · RMS ${(20 * Math.log10(m.rms || 1e-6)).toFixed(1)} dBFS`;
  } else if (m.type === "chunk") {
    const bytes = f32To24(m.data);
    totalSamples += m.data.length; pending.push(putChunk(bytes));
  }
}

// ---------- Kayıt ----------
let recording = false, totalSamples = 0, pending = [], t0 = 0, timer, lastWav = null;
async function startRec() {
  if (!stream) await openMic();
  await ctx.resume();
  await clearChunks(); totalSamples = 0; clips = 0; pending = [];
  recording = true; node.port.postMessage("start"); t0 = performance.now();
  $("rec").disabled = true; $("stop").disabled = false; $("play").disabled = $("wav").disabled = true;
  timer = setInterval(async () => {
    const s = (performance.now() - t0) / 1000;
    const mem = performance.memory ? ` · JS yığın ${(performance.memory.usedJSHeapSize / 1e6).toFixed(0)} MB` : "";
    $("recinfo").textContent = `Kayıtta ${s.toFixed(1)} sn · örnek ${totalSamples} · ≈${(totalSamples * 3 / 1e6).toFixed(1)} MB${mem}`;
    if (s >= +$("limit").value) stopRec("süre sınırı");
  }, 500);
}
async function stopRec(why = "kullanıcı") {
  if (!recording) return;
  recording = false; clearInterval(timer);
  node.port.postMessage("flush"); node.port.postMessage("stop");
  await new Promise((r) => setTimeout(r, 200)); await Promise.all(pending);
  const secs = (performance.now() - t0) / 1000, got = totalSamples / ctx.sampleRate;
  const chunks = await allChunks();
  lastWav = wavFrom24(chunks, ctx.sampleRate);
  $("recinfo").textContent =
    `Bitti (${why}). Duvar saati ${secs.toFixed(1)} sn, kaydedilen ${got.toFixed(1)} sn (fark ${(secs - got).toFixed(2)} sn)\n` +
    `Örnekleme hızı: ${ctx.sampleRate} · WAV ${(lastWav.size / 1e6).toFixed(1)} MB · parça ${chunks.length} · clipping blok ${clips}`;
  closeMic();
  $("rec").disabled = false; $("stop").disabled = true; $("play").disabled = $("wav").disabled = false;
}

// ---------- UI bağlantıları ----------
$("perm").onclick = async () => { try { await openMic(); } catch (e) { $("lvl").textContent = `${e.name}: ${e.message}`; } };
$("dev").onchange = () => openMic().catch((e) => ($("lvl").textContent = `${e.name}: ${e.message}`));
$("rec").onclick = () => startRec().catch((e) => ($("recinfo").textContent = `${e.name}: ${e.message}`));
$("stop").onclick = () => stopRec();
$("play").onclick = () => new Audio(URL.createObjectURL(lastWav)).play();
$("wav").onclick = () => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(lastWav);
  a.download = `a0-${new Date().toISOString().slice(0, 10)}.wav`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$("lat").onclick = async () => {
  const c = new AudioContext({ sampleRate: TARGET_SR });
  await new Promise((r) => setTimeout(r, 300));
  const track = stream?.getAudioTracks()[0]?.getSettings?.() || {};
  $("latinfo").textContent =
    `baseLatency: ${(c.baseLatency * 1000).toFixed(1)} ms\noutputLatency: ${c.outputLatency !== undefined ? (c.outputLatency * 1000).toFixed(1) + " ms" : "desteklenmiyor"}\n` +
    `Gerçek örnekleme hızı: ${c.sampleRate}\nMikrofon ayarları: ${JSON.stringify(track)}`;
  c.close();
};
$("mix").onclick = async () => {
  $("mixinfo").textContent = "çalışıyor…";
  try { $("mixinfo").textContent = JSON.stringify(await (await fetch("/api/mix-test", { method: "POST" })).json(), null, 2); }
  catch (e) { $("mixinfo").textContent = String(e); }
};
navigator.mediaDevices?.addEventListener("devicechange", () => { listDevices(); $("lvl").textContent = "Cihaz listesi değişti."; });
window.addEventListener("beforeunload", (e) => { if (recording) { e.preventDefault(); e.returnValue = ""; } });
navigator.storage?.persist?.();
env();
