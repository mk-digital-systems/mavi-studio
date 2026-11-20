/* Mavi Kadraj — dışa aktarma hattı.
   Her kareyi kendi anında çizip H.264 ile, sesi AAC-LC ile kodlar ve klasik (parçasız, moov başta) MP4 yazar.
   Tamamı cihazda çalışır; ağ kullanmaz. Editörden bağımsızdır: çizimi ve sesi çağıran taraf verir. */
(function (root) {
'use strict';

// Tercih sırası: Main, sonra Constrained Baseline. High kullanılmaz (bkz. YAPILACAKLAR.md, karar 7).
// Kodlayıcılar istenen seviyeyi her zaman vermez (ör. bazı donanım kodlayıcıları 4.0 yerine 4.1 üretir).
// Bu yüzden her aday gerçekten denenir ve üretilen profil/seviye okunur. Önce tam hedefi (Seviye 4.0)
// veren kodlayıcı aranır; hiçbiri vermezse son çare olarak Seviye 4.2'ye kadar olan kabul edilir.
// H.264 seviyesi çözünürlükten gelir: 1080 × 1920 = Seviye 4.0 (8160 makroblok); 2160 × 3840 = 32 400 makroblok, 972 000 makroblok/sn → Seviye 5.1.
const hx = v => v.toString(16).padStart(2, '0');
function levelFor(w, h, fps) {
  const mb = Math.ceil(w / 16) * Math.ceil(h / 16), mbs = mb * fps;
  if (mb <= 8192 && mbs <= 245760) return 40;
  if (mb <= 22080 && mbs <= 589824) return 50;
  return 51;
}
// Tercih sırası: Main, sonra Constrained Baseline; önce tam hedef seviye, olmazsa bir üst seviye (kodlayıcılar bazen yükseltir).
function candidatesFor(o) {
  const lv = levelFor(o.width, o.height, o.fps), hi = lv === 40 ? 42 : lv === 50 ? 51 : 52, M = 'avc1.4d00' + hx(lv), B = 'avc1.42E0' + hx(lv);
  return [
    { codec: M, hardwareAcceleration: 'no-preference', maxLevel: lv }, { codec: M, hardwareAcceleration: 'prefer-software', maxLevel: lv },
    { codec: B, hardwareAcceleration: 'no-preference', maxLevel: lv }, { codec: B, hardwareAcceleration: 'prefer-software', maxLevel: lv },
    { codec: M, hardwareAcceleration: 'no-preference', maxLevel: hi }, { codec: B, hardwareAcceleration: 'no-preference', maxLevel: hi }
  ];
}
const ALLOWED_PROFILES = { 66: 'Constrained Baseline', 77: 'Main' };
const QUEUE_LIMIT = 8;        // kodlayıcıda bekleyen en çok kare
const KEY_SECONDS = 2;        // anahtar kare aralığı
const AUDIO_RATE = 48000;
const AUDIO_BLOCK = 4800;     // 0,1 sn'lik ses parçaları
const MESSAGE_UNSUPPORTED = 'Bu tarayıcı telefon uyumlu MP4 üretemiyor. Güncel Chrome veya Edge kullanın.';

function available() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && !!root.Mediabunny;
}
function videoConfig(candidate, o) {
  return { codec: candidate.codec, width: o.width, height: o.height, bitrate: o.videoBitrate, framerate: o.fps,
    avc: { format: 'avc' }, latencyMode: 'quality', hardwareAcceleration: candidate.hardwareAcceleration };
}
function audioConfig(o) {
  return { codec: 'mp4a.40.2', sampleRate: AUDIO_RATE, numberOfChannels: 2, bitrate: o.audioBitrate };
}
const abortError = () => { const e = new Error('İşlem iptal edildi.'); e.name = 'AbortError'; return e; };
// Zamanlayıcı kullanmayan bekleme: arka plandaki sekmede de yavaşlamaz.
const channel = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
function pause() {
  if (!channel) return new Promise(r => setTimeout(r));
  return new Promise(r => { channel.port1.onmessage = () => r(); channel.port2.postMessage(0); });
}
function dequeued(encoder) {
  return new Promise(resolve => {
    const timer = setTimeout(done, 250);
    function done() { clearTimeout(timer); encoder.removeEventListener('dequeue', done); resolve(); }
    encoder.addEventListener('dequeue', done);
  });
}
function withTimeout(promise, ms, message) {
  let timer; const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/* Birkaç kareyi gerçekten kodlayıp kodlayıcının ürettiği profil ve seviyeyi okur. */
async function trialVideo(candidate, o) {
  const config = videoConfig(candidate, o);
  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) return null;
  const canvas = document.createElement('canvas'); canvas.width = o.width; canvas.height = o.height;
  const c = canvas.getContext('2d'); let description = null, chunks = 0, failure = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => { chunks++; if (meta && meta.decoderConfig && meta.decoderConfig.description && !description) description = meta.decoderConfig.description; },
    error: e => { failure = e; }
  });
  try {
    encoder.configure(config);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = ['#204060', '#406080', '#6080a0'][i]; c.fillRect(0, 0, o.width, o.height);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / o.fps), duration: Math.round(1e6 / o.fps) });
      try { encoder.encode(frame, { keyFrame: i === 0 }); } finally { frame.close(); }
    }
    await withTimeout(encoder.flush(), 8000, 'Kodlayıcı yanıt vermedi.');
  } catch (e) { failure = failure || e; }
  finally { if (encoder.state !== 'closed') try { encoder.close(); } catch {} canvas.width = canvas.height = 0; }
  if (failure || !chunks || !description) return null;
  const bytes = description instanceof ArrayBuffer ? new Uint8Array(description) : new Uint8Array(description.buffer, description.byteOffset, description.byteLength);
  const profile = bytes[1], level = bytes[3], profileName = ALLOWED_PROFILES[profile];
  if (!profileName || level > candidate.maxLevel) return null; // High ya da izin verilenden yüksek seviye kabul edilmez
  return { config, profile, level, profileName, software: candidate.hardwareAcceleration === 'prefer-software',
    label: `H.264 ${profileName} ${(level / 10).toFixed(1)}` };
}
async function trialAudio(o) {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return null;
  const config = audioConfig(o);
  const support = await AudioEncoder.isConfigSupported(config);
  if (!support.supported) return null;
  let chunks = 0, failure = null;
  const encoder = new AudioEncoder({ output: () => { chunks++; }, error: e => { failure = e; } });
  try {
    encoder.configure(config);
    const data = new AudioData({ format: 'f32-planar', sampleRate: AUDIO_RATE, numberOfFrames: AUDIO_BLOCK, numberOfChannels: 2, timestamp: 0, data: new Float32Array(AUDIO_BLOCK * 2) });
    try { encoder.encode(data); } finally { data.close(); }
    await withTimeout(encoder.flush(), 8000, 'Ses kodlayıcı yanıt vermedi.');
  } catch (e) { failure = failure || e; }
  finally { if (encoder.state !== 'closed') try { encoder.close(); } catch {} }
  return failure || !chunks ? null : { config, label: 'AAC-LC' };
}

const probes = new Map();
/* Bu cihazın hedef biçimi üretebildiğini doğrular. Sonuç oturum boyunca saklanır.
   options: { width, height, fps, videoBitrate, audioBitrate, audio: boolean, hardwareAcceleration } */
function probe(options) {
  const o = Object.assign({ fps: 30, videoBitrate: 6e6, audioBitrate: 160000, audio: false }, options);
  const key = [o.width, o.height, o.fps, o.videoBitrate, o.audioBitrate, !!o.audio, o.hardwareAcceleration || ''].join('|');
  if (!probes.has(key)) probes.set(key, (async () => {
    const started = performance.now();
    if (!available()) return { ok: false, reason: MESSAGE_UNSUPPORTED };
    // Ölçüm için kodlayıcı türü açıkça istenmişse yalnızca o denenir; seviye için üst sınır 4.2'dir.
    const candidates = o.hardwareAcceleration
      ? ['avc1.4d00', 'avc1.42E0'].map(p => ({ codec: p + hx(levelFor(o.width, o.height, o.fps)), hardwareAcceleration: o.hardwareAcceleration, maxLevel: 52 }))
      : candidatesFor(o);
    let video = null;
    for (const candidate of candidates) { video = await trialVideo(candidate, o).catch(() => null); if (video) break; }
    if (!video) return { ok: false, reason: MESSAGE_UNSUPPORTED };
    let audio = null;
    if (o.audio) {
      audio = await trialAudio(o).catch(() => null);
      if (!audio) return { ok: false, reason: 'Bu tarayıcı sesi telefon uyumlu biçimde (AAC) kodlayamıyor. Güncel Chrome veya Edge kullanın.' };
    }
    return { ok: true, video, audio, label: video.label + (audio ? ' + ' + audio.label : ''), ms: Math.round(performance.now() - started) };
  })());
  return probes.get(key);
}

/* Videoyu üretir.
   options: {
     canvas, width, height, fps, frames,        // canvas: her karenin çizildiği tuval
     draw(t, i),                                // i. kareyi (t saniye) tuvale çizer
     prepare(t, i)?,                            // çizimden önce beklenmesi gereken hazırlık (ör. klip karesine gitmek)
     audio?: AudioBuffer (48 kHz, 2 kanal),     // yoksa ses izi yazılmaz
     videoBitrate, audioBitrate, hardwareAcceleration,
     onProgress(oran, kare)?, signal?: AbortSignal
   }
   Dönen: { buffer: ArrayBuffer, type: 'video/mp4', label, frames, ms, maxQueue } */
async function render(options) {
  const o = Object.assign({ fps: 30, videoBitrate: 6e6, audioBitrate: 160000 }, options);
  const plan = await probe(Object.assign({}, o, { audio: !!o.audio }));
  if (!plan.ok) throw new Error(plan.reason);
  const M = root.Mediabunny, started = performance.now();
  const qLimit = o.width * o.height > 3e6 ? 3 : QUEUE_LIMIT;   // 4K karelerde bellek için daha kısa kuyruk
  const target = new M.BufferTarget();
  const output = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const videoSource = new M.EncodedVideoPacketSource('avc');
  output.addVideoTrack(videoSource, { frameRate: o.fps });
  let audioSource = null;
  if (o.audio) { audioSource = new M.EncodedAudioPacketSource('aac'); output.addAudioTrack(audioSource); }

  let failure = null, chain = Promise.resolve(), maxQueue = 0, videoEncoder = null, audioEncoder = null;
  const fail = e => { if (!failure) failure = e instanceof Error ? e : new Error(String(e && e.message || e)); };
  const check = () => { if (failure) throw failure; if (o.signal && o.signal.aborted) throw abortError(); };
  const feed = source => (chunk, meta) => { chain = chain.then(() => source.add(M.EncodedPacket.fromEncodedChunk(chunk), meta)).catch(fail); };

  try {
    await output.start();
    videoEncoder = new VideoEncoder({ output: feed(videoSource), error: fail });
    videoEncoder.configure(plan.video.config);
    let left = null, right = null, samples = 0, cursor = 0;
    if (o.audio) {
      if (o.audio.sampleRate !== AUDIO_RATE) throw new Error('Ses karışımı 48 kHz olmalı.');
      left = o.audio.getChannelData(0); right = o.audio.numberOfChannels > 1 ? o.audio.getChannelData(1) : left; samples = o.audio.length;
      audioEncoder = new AudioEncoder({ output: feed(audioSource), error: fail });
      audioEncoder.configure(plan.audio.config);
    }
    const pushAudio = async until => {
      const stop = Math.min(samples, until);
      while (cursor < stop) {
        check();
        const n = Math.min(AUDIO_BLOCK, samples - cursor), data = new Float32Array(n * 2);
        data.set(left.subarray(cursor, cursor + n), 0); data.set(right.subarray(cursor, cursor + n), n);
        const block = new AudioData({ format: 'f32-planar', sampleRate: AUDIO_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(cursor / AUDIO_RATE * 1e6), data });
        try { audioEncoder.encode(block); } finally { block.close(); }
        cursor += n;
        while (audioEncoder.encodeQueueSize >= qLimit * 4) { check(); await dequeued(audioEncoder); }
      }
    };

    const keyEvery = Math.max(1, Math.round(o.fps * KEY_SECONDS)), micro = 1e6 / o.fps;
    for (let i = 0; i < o.frames; i++) {
      check();
      const t = i / o.fps;
      if (o.prepare) await o.prepare(t, i);
      o.draw(t, i);
      const frame = new VideoFrame(o.canvas, { timestamp: Math.round(i * micro), duration: Math.round(micro) });
      try { videoEncoder.encode(frame, { keyFrame: i % keyEvery === 0 }); } finally { frame.close(); }
      maxQueue = Math.max(maxQueue, videoEncoder.encodeQueueSize);
      while (videoEncoder.encodeQueueSize >= qLimit) { check(); await dequeued(videoEncoder); }
      if (audioEncoder) await pushAudio(Math.ceil((i + 1) / o.fps * AUDIO_RATE));
      if (i % 4 === 3 || i === o.frames - 1) {
        await chain; await pause();
        if (o.onProgress) o.onProgress((i + 1) / o.frames, i + 1);
      }
    }
    check();
    if (audioEncoder) await pushAudio(samples);
    await videoEncoder.flush();
    if (audioEncoder) await audioEncoder.flush();
    await chain; check();
    await output.finalize();
    return { buffer: target.buffer, type: 'video/mp4', label: plan.label, frames: o.frames, ms: Math.round(performance.now() - started), maxQueue };
  } catch (e) {
    try { await output.cancel(); } catch {}
    throw e;
  } finally {
    for (const encoder of [videoEncoder, audioEncoder]) if (encoder && encoder.state !== 'closed') try { encoder.close(); } catch {}
  }
}

root.MaviExport = { available, probe, render, levelFor, MESSAGE_UNSUPPORTED, QUEUE_LIMIT };
})(typeof self !== 'undefined' ? self : this);
