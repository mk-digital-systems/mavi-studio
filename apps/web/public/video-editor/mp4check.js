/* Mavi Kadraj — MP4 yapı denetleyicisi.
   Dosyanın gerçek kapsayıcısını, codec'lerini, kare zamanlarını ve sürelerini baytlardan okur.
   Tarayıcıda (window.Mp4Check) ve Node'da (require) çalışır; ağ kullanmaz, bağımlılığı yoktur. */
(function (root) {
'use strict';

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'mvex', 'moof', 'traf', 'edts']);
const AVC_PROFILES = { 66: 'Baseline', 77: 'Main', 88: 'Extended', 100: 'High', 110: 'High 10', 122: 'High 4:2:2', 244: 'High 4:4:4' };
const AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
const VIDEO_NAMES = { avc1: 'H.264', avc3: 'H.264', vp09: 'VP9', vp08: 'VP8', av01: 'AV1', hvc1: 'H.265', hev1: 'H.265' };
const AUDIO_NAMES = { mp4a: 'AAC', Opus: 'Opus', opus: 'Opus', 'ac-3': 'AC-3', fLaC: 'FLAC' };

function inspect(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = bytes.length;
  const u8 = p => bytes[p], u16 = p => view.getUint16(p), u32 = p => view.getUint32(p), i32 = p => view.getInt32(p);
  const u64 = p => view.getUint32(p) * 4294967296 + view.getUint32(p + 4);
  const str = (p, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(bytes[p + i]); return s; };

  const report = {
    size, isMp4: false, endsOnBoxBoundary: true, topLevel: [], order: [], brands: null,
    fragmented: false, fragments: 0, moovBeforeMdat: null, movie: null, tracks: []
  };

  function* boxes(start, end) {
    let p = start;
    while (p + 8 <= end) {
      let len = u32(p), header = 8; const type = str(p + 4, 4);
      if (len === 1) { if (p + 16 > end) { yield { type, start: p, body: p + 8, end, broken: true }; return; } len = u64(p + 8); header = 16; }
      else if (len === 0) len = end - p;
      if (len < header || p + len > end) { yield { type, start: p, body: p + header, end, broken: true }; return; }
      yield { type, start: p, body: p + header, end: p + len, broken: false };
      p += len;
    }
    if (p !== end) yield { type: '', start: p, body: p, end, broken: true };
  }

  // ---- üst düzey kutular ----
  for (const b of boxes(0, size)) {
    if (b.broken) { report.endsOnBoxBoundary = false; if (!b.type) break; }
    report.topLevel.push({ type: b.type, offset: b.start, size: b.end - b.start });
    const last = report.order[report.order.length - 1];
    if (last && last.type === b.type) last.count++; else report.order.push({ type: b.type, count: 1 });
    if (b.type === 'moof') report.fragments++;
    if (b.broken) break;
  }
  const first = report.topLevel[0];
  report.isMp4 = !!first && first.type === 'ftyp';
  report.fragmented = report.fragments > 0;
  const moovAt = report.topLevel.findIndex(b => b.type === 'moov'), mdatAt = report.topLevel.findIndex(b => b.type === 'mdat');
  report.moovBeforeMdat = moovAt < 0 ? null : (mdatAt < 0 || moovAt < mdatAt);

  const trex = new Map();
  let track = null, traf = null;
  const fragSamples = new Map(); // izKimliği -> {durations:[], sync:[], cto:boolean}

  function sampleEntry(t, p, end) {
    const count = u32(p + 4); let q = p + 8;
    for (let n = 0; n < count && q + 8 <= end; n++) {
      const len = u32(q), fourcc = str(q + 4, 4), stop = Math.min(end, q + len);
      if (len < 8) break;
      t.codec = fourcc;
      let sub = stop;
      if (t.handler === 'vide') { t.codedWidth = u16(q + 32); t.codedHeight = u16(q + 34); sub = q + 86; }
      else if (t.handler === 'soun') { t.channels = u16(q + 24); t.sampleRate = u32(q + 32) >>> 16; sub = q + 36; }
      while (sub + 8 <= stop) {
        const bl = u32(sub), bt = str(sub + 4, 4), bb = sub + 8, be = sub + bl;
        if (bl < 8 || be > stop) break;
        if (bt === 'avcC') {
          const profile = u8(bb + 1), compat = u8(bb + 2), level = u8(bb + 3);
          let name = AVC_PROFILES[profile] || ('profil ' + profile);
          if (profile === 66 && (compat & 0x40)) name = 'Constrained Baseline';
          t.avc = { profile, compat, level, profileName: name, nalLengthSize: (u8(bb + 4) & 3) + 1,
            codecString: 'avc1.' + [profile, compat, level].map(v => v.toString(16).padStart(2, '0')).join('') };
        } else if (bt === 'esds') {
          try {
            let r = bb + 4;
            const len = () => { let v = 0; for (let i = 0; i < 4; i++) { const c = u8(r++); v = (v << 7) | (c & 0x7f); if (!(c & 0x80)) break; } return v; };
            if (u8(r++) === 3) { len(); r += 2; const flags = u8(r++); if (flags & 0x80) r += 2; if (flags & 0x40) r += 1 + u8(r); if (flags & 0x20) r += 2; }
            if (u8(r++) === 4) {
              len(); const oti = u8(r); r += 13;
              t.aac = { objectTypeIndication: oti };
              if (u8(r++) === 5) {
                len(); const b0 = u8(r), b1 = u8(r + 1), aot = b0 >> 3, fi = ((b0 & 7) << 1) | (b1 >> 7);
                t.aac.audioObjectType = aot; t.aac.sampleRate = AAC_RATES[fi] || null; t.aac.channels = (b1 >> 3) & 15;
              }
            }
          } catch (e) { t.aac = { error: String(e.message || e) }; }
        } else if (bt === 'colr' && str(bb, 4) === 'nclx') {
          t.color = { primaries: u16(bb + 4), transfer: u16(bb + 6), matrix: u16(bb + 8), fullRange: !!(u8(bb + 10) & 0x80) };
        }
        sub = be;
      }
      q += len;
    }
  }

  function walk(start, end) {
    for (const b of boxes(start, end)) {
      if (b.broken) return;
      const p = b.body;
      switch (b.type) {
        case 'ftyp': {
          const compatible = []; for (let q = p + 8; q + 4 <= b.end; q += 4) compatible.push(str(q, 4));
          report.brands = { major: str(p, 4), minor: u32(p + 4), compatible }; break;
        }
        case 'mvhd': {
          const v1 = u8(p) === 1, timescale = v1 ? u32(p + 20) : u32(p + 12), duration = v1 ? u64(p + 24) : u32(p + 16);
          report.movie = { timescale, duration, seconds: timescale ? duration / timescale : 0 }; break;
        }
        case 'trak': track = { id: null, handler: null, codec: null, timescale: 0 }; report.tracks.push(track); break;
        case 'tkhd': {
          const v1 = u8(p) === 1, o = v1 ? p + 36 : p + 24;
          track.id = v1 ? u32(p + 20) : u32(p + 12); track.tkhdDuration = v1 ? u64(p + 28) : u32(p + 20);
          track.width = u32(o + 52) / 65536; track.height = u32(o + 56) / 65536; break;
        }
        case 'elst': {
          const v1 = u8(p) === 1, n = u32(p + 4); track.edits = []; let q = p + 8;
          for (let i = 0; i < n && q < b.end; i++) {
            if (v1) { track.edits.push({ duration: u64(q), mediaTime: view.getInt32(q + 8) * 4294967296 + u32(q + 12) }); q += 20; }
            else { track.edits.push({ duration: u32(q), mediaTime: i32(q + 4) }); q += 12; }
          } break;
        }
        case 'mdhd': {
          const v1 = u8(p) === 1; track.timescale = v1 ? u32(p + 20) : u32(p + 12); track.mdhdDuration = v1 ? u64(p + 24) : u32(p + 16); break;
        }
        case 'hdlr': if (track && !track.handler) track.handler = str(p + 8, 4); break;
        case 'stsd': sampleEntry(track, p, b.end); break;
        case 'stts': { const n = u32(p + 4); track.stts = []; for (let i = 0; i < n; i++) track.stts.push([u32(p + 8 + i * 8), u32(p + 12 + i * 8)]); break; }
        case 'stss': { const n = u32(p + 4); track.stss = []; for (let i = 0; i < n; i++) track.stss.push(u32(p + 8 + i * 4) - 1); break; }
        case 'ctts': { const n = u32(p + 4); track.cttsNonZero = false; for (let i = 0; i < n; i++) if (u32(p + 12 + i * 8) !== 0) { track.cttsNonZero = true; break; } break; }
        case 'stsz': { const fixed = u32(p + 4), n = u32(p + 8); track.sampleSizes = { fixed, count: n, at: p + 12 }; break; }
        case 'stsc': { const n = u32(p + 4); track.stsc = []; for (let i = 0; i < n; i++) track.stsc.push([u32(p + 8 + i * 12), u32(p + 12 + i * 12)]); break; }
        case 'stco': { const n = u32(p + 4); track.chunks = []; for (let i = 0; i < n; i++) track.chunks.push(u32(p + 8 + i * 4)); break; }
        case 'co64': { const n = u32(p + 4); track.chunks = []; for (let i = 0; i < n; i++) track.chunks.push(u64(p + 8 + i * 8)); break; }
        case 'mehd': report.mehd = true; break;
        case 'trex': trex.set(u32(p + 4), { duration: u32(p + 12), size: u32(p + 16), flags: u32(p + 20) }); break;
        case 'traf': traf = { id: null, duration: 0, flags: 0 }; break;
        case 'tfhd': {
          const flags = u32(p) & 0xffffff; traf.id = u32(p + 4); let q = p + 8;
          const d = trex.get(traf.id) || { duration: 0, size: 0, flags: 0 }; traf.duration = d.duration; traf.flags = d.flags;
          if (flags & 1) q += 8; if (flags & 2) q += 4;
          if (flags & 8) { traf.duration = u32(q); q += 4; } if (flags & 0x10) q += 4; if (flags & 0x20) traf.flags = u32(q);
          break;
        }
        case 'trun': {
          const flags = u32(p) & 0xffffff, n = u32(p + 4); let q = p + 8, firstFlags = null;
          if (flags & 1) q += 4; if (flags & 4) { firstFlags = u32(q); q += 4; }
          if (!fragSamples.has(traf.id)) fragSamples.set(traf.id, { durations: [], sync: [], cto: false });
          const store = fragSamples.get(traf.id);
          for (let i = 0; i < n; i++) {
            let duration = traf.duration, sampleFlags = traf.flags;
            if (flags & 0x100) { duration = u32(q); q += 4; } if (flags & 0x200) q += 4;
            if (flags & 0x400) { sampleFlags = u32(q); q += 4; } else if (i === 0 && firstFlags !== null) sampleFlags = firstFlags;
            if (flags & 0x800) { if (u32(q) !== 0) store.cto = true; q += 4; }
            store.durations.push(duration); store.sync.push(!(sampleFlags & 0x10000));
          } break;
        }
      }
      if (CONTAINERS.has(b.type)) walk(b.body, b.end);
    }
  }
  walk(0, size);

  // ---- iz özetleri ----
  for (const t of report.tracks) {
    t.type = t.handler === 'vide' ? 'video' : t.handler === 'soun' ? 'audio' : 'other';
    let durations, sync;
    const frag = fragSamples.get(t.id);
    if (frag) { durations = frag.durations; sync = frag.sync; t.compositionOffsets = frag.cto; }
    else {
      durations = []; for (const [count, delta] of t.stts || []) for (let i = 0; i < count; i++) durations.push(delta);
      sync = durations.map(() => !t.stss); if (t.stss) for (const i of t.stss) if (i < sync.length) sync[i] = true;
      t.compositionOffsets = !!t.cttsNonZero;
    }
    const total = durations.reduce((a, b) => a + b, 0), scale = t.timescale || 1;
    t.samples = durations.length; t.seconds = total / scale; t.headerSeconds = (t.mdhdDuration || 0) / scale;
    const distinct = new Set(durations);
    const distribution = new Map();for(const duration of durations)distribution.set(duration,(distribution.get(duration)||0)+1);
    t.durationDistribution = [...distribution].map(([ticks,count])=>({ticks,milliseconds:ticks/scale*1000,count})).sort((a,b)=>a.ticks-b.ticks);
    t.distinctDurations = distinct.size;
    t.minDurationMs = durations.length ? Math.min(...distinct) / scale * 1000 : 0;
    t.maxDurationMs = durations.length ? Math.max(...distinct) / scale * 1000 : 0;
    t.constantRate = durations.length > 0 && distinct.size === 1;
    t.rate = t.seconds ? t.samples / t.seconds : 0;
    if (t.type === 'video') {
      t.keyframes = []; sync.forEach((s, i) => { if (s) t.keyframes.push(i); });
      t.firstIsKey = sync[0] === true;
      let gap = 0, prev = 0; for (const k of t.keyframes) { gap = Math.max(gap, k - prev); prev = k; } gap = Math.max(gap, t.samples - prev);
      t.maxKeyframeInterval = t.keyframes.length ? gap : t.samples;
      t.lateFrames = durations.filter(d => d / scale > 0.0667).length;
    }
    // H.264 dilim türleri: yalnızca klasik (parçasız) düzende örnek konumları bilinir.
    if (t.type === 'video' && t.avc && !frag && t.chunks && t.stsc && t.sampleSizes) {
      const types = { I: 0, P: 0, B: 0, other: 0 }; let idrMismatch = 0, sample = 0;
      const sizeOf = i => t.sampleSizes.fixed || u32(t.sampleSizes.at + i * 4);
      for (let c = 0; c < t.chunks.length && sample < t.samples; c++) {
        let per = 0; for (const [firstChunk, n] of t.stsc) if (firstChunk <= c + 1) per = n;
        let offset = t.chunks[c];
        for (let k = 0; k < per && sample < t.samples; k++, sample++) {
          const len = sizeOf(sample), stop = offset + len; let q = offset, found = false, idr = false;
          while (q + t.avc.nalLengthSize < stop && !found) {
            let nal = 0; for (let j = 0; j < t.avc.nalLengthSize; j++) nal = nal * 256 + u8(q + j);
            q += t.avc.nalLengthSize; const kind = u8(q) & 0x1f;
            if (kind === 1 || kind === 5) {
              const raw = []; for (let j = q + 1; j < Math.min(q + nal, q + 12); j++) { if (raw.length >= 2 && u8(j) === 3 && u8(j - 1) === 0 && u8(j - 2) === 0) continue; raw.push(u8(j)); }
              let bit = 0; const read = () => { const v = (raw[bit >> 3] >> (7 - (bit & 7))) & 1; bit++; return v; };
              const ue = () => { let zeros = 0; while (bit < raw.length * 8 && read() === 0) zeros++; let v = 1; for (let j = 0; j < zeros; j++) v = v * 2 + read(); return v - 1; };
              ue(); const st = ue() % 5; types[st === 2 || st === 4 ? 'I' : st === 0 || st === 3 ? 'P' : st === 1 ? 'B' : 'other']++;
              idr = kind === 5; found = true;
            }
            q += nal;
          }
          if (found && idr !== sync[sample]) idrMismatch++;
          offset = stop;
        }
      }
      t.sliceTypes = types; t.idrMismatch = idrMismatch;
    }
    delete t.stts; delete t.stss; delete t.stsc; delete t.chunks; delete t.sampleSizes; delete t.cttsNonZero;
  }
  report.video = report.tracks.filter(t => t.type === 'video');
  report.audio = report.tracks.filter(t => t.type === 'audio');
  report.seconds = Math.max(0, ...report.tracks.map(t => t.seconds));
  return report;
}

/* Beklentiye uymayan her nokta için Türkçe bir neden döndürür; boş dizi = geçti.
   expect: { width, height, fps, frames, seconds, audio: true|false, profiles: [...], level, maxKeyInterval } */
function validate(report, expect) {
  const e = Object.assign({ fps: 30, profiles: ['Main', 'Constrained Baseline'], level: 40, maxKeyInterval: 60 }, expect || {});
  const out = [], sn = v => v.toFixed(2).replace('.', ',') + ' sn';
  if (!report.isMp4) { out.push('Dosya MP4 değil: ilk kutu ftyp değil.'); return out; }
  if (!report.endsOnBoxBoundary) out.push('Dosya kutu sınırında bitmiyor; yarım kalmış olabilir.');
  if (report.fragmented) out.push(`Parçalı MP4 (${report.fragments} parça); klasik MP4 bekleniyor.`);
  if (report.moovBeforeMdat === false) out.push('Dizin kutusu (moov) verinin (mdat) arkasında.');
  if (report.moovBeforeMdat === null) out.push('Dizin kutusu (moov) yok.');
  if (report.video.length !== 1) out.push(`Görüntü izi sayısı ${report.video.length}; 1 bekleniyor.`);
  const v = report.video[0];
  if (v) {
    if (v.codec !== 'avc1') out.push(`Görüntü codec'i ${VIDEO_NAMES[v.codec] || v.codec}; H.264 bekleniyor.`);
    else if (v.avc) {
      if (!e.profiles.includes(v.avc.profileName)) out.push(`H.264 profili ${v.avc.profileName}; ${e.profiles.join(' ya da ')} bekleniyor.`);
      if (v.avc.level > e.level) out.push(`H.264 seviyesi ${(v.avc.level / 10).toFixed(1)}; en çok ${(e.level / 10).toFixed(1)} bekleniyor.`);
    }
    if (e.width && (v.codedWidth !== e.width || v.codedHeight !== e.height)) out.push(`Çözünürlük ${v.codedWidth} × ${v.codedHeight}; ${e.width} × ${e.height} bekleniyor.`);
    if (!v.samples) out.push('Görüntü izinde kare yok.');
    else {
      if (!v.constantRate) out.push(`Kare süreleri eşit değil: ${v.distinctDurations} farklı süre, en uzun aralık ${Math.round(v.maxDurationMs)} ms.`);
      else if (Math.abs(v.rate - e.fps) > 0.01) out.push(`Kare hızı ${v.rate.toFixed(2)}; ${e.fps} bekleniyor.`);
      if (!v.firstIsKey) out.push('İlk kare anahtar kare değil.');
      if (v.maxKeyframeInterval > e.maxKeyInterval) out.push(`Anahtar kare aralığı ${v.maxKeyframeInterval} kare; en çok ${e.maxKeyInterval} olmalı.`);
      if (v.compositionOffsets || (v.sliceTypes && v.sliceTypes.B > 0)) out.push('B-kare var.');
      if (v.idrMismatch) out.push(`${v.idrMismatch} karede anahtar kare işareti ile kare türü uyuşmuyor.`);
      if (e.frames != null && v.samples !== e.frames) out.push(`Kare sayısı ${v.samples}; ${e.frames} bekleniyor.`);
    }
    const frame = 1 / e.fps;
    if (report.movie && report.movie.duration === 0) out.push('Başlıktaki toplam süre 0.');
    else if (report.movie && Math.abs(report.movie.seconds - report.seconds) > frame + 0.001) out.push(`Başlıktaki toplam süre ${sn(report.movie.seconds)}; gerçek süre ${sn(report.seconds)}.`);
    if (Math.abs(v.headerSeconds - v.seconds) > frame + 0.001) out.push(`Görüntü izinin başlık süresi ${sn(v.headerSeconds)}; gerçek süre ${sn(v.seconds)}.`);
    if (e.seconds != null && Math.abs(v.seconds - e.seconds) > frame + 0.001) out.push(`Görüntü süresi ${sn(v.seconds)}; ${sn(e.seconds)} bekleniyor.`);
  }
  if (e.audio === false && report.audio.length) out.push('Ses izi var; sessiz projede beklenmiyor.');
  if (e.audio === true) {
    if (report.audio.length !== 1) out.push(`Ses izi sayısı ${report.audio.length}; 1 bekleniyor.`);
    const a = report.audio[0];
    if (a) {
      if (a.codec !== 'mp4a' || !a.aac || a.aac.audioObjectType !== 2) out.push(`Ses codec'i ${a.codec === 'mp4a' ? 'AAC (LC değil)' : (AUDIO_NAMES[a.codec] || a.codec)}; AAC-LC bekleniyor.`);
      const rate = (a.aac && a.aac.sampleRate) || a.sampleRate, channels = (a.aac && a.aac.channels) || a.channels;
      if (rate !== 48000) out.push(`Ses örnekleme hızı ${rate} Hz; 48000 bekleniyor.`);
      if (channels !== 2) out.push(`Ses kanalı ${channels}; 2 (stereo) bekleniyor.`);
      if (v && Math.abs(a.seconds - v.seconds) > 0.05) out.push(`Ses süresi ${sn(a.seconds)}; görüntü süresi ${sn(v.seconds)}.`);
      if (Math.abs(a.headerSeconds - a.seconds) > 0.05) out.push(`Ses izinin başlık süresi ${sn(a.headerSeconds)}; gerçek süre ${sn(a.seconds)}.`);
    }
  }
  return out;
}

/* Dosyadan okunan gerçek değerlerle kısa durum satırı. */
function describe(report) {
  const v = report.video[0], a = report.audio[0], parts = [];
  parts.push(report.isMp4 ? (report.fragmented ? 'Parçalı MP4' : 'MP4') : 'Bilinmeyen kapsayıcı');
  let codecs = '';
  if (v) codecs = (VIDEO_NAMES[v.codec] || v.codec) + (v.avc ? ` ${v.avc.profileName} ${(v.avc.level / 10).toFixed(1)}` : '');
  if (a) codecs += ' + ' + (a.codec === 'mp4a' && a.aac && a.aac.audioObjectType === 2 ? 'AAC-LC' : (AUDIO_NAMES[a.codec] || a.codec));
  if (codecs) parts.push(codecs);
  if (v) { parts.push(`${v.codedWidth} × ${v.codedHeight}`); parts.push(v.constantRate ? `${Math.round(v.rate * 100) / 100} kare/sn` : 'değişken kare hızı'); }
  if (!a) parts.push('ses yok');
  parts.push((report.size / 1048576).toFixed(1).replace('.', ',') + ' MB');
  return parts.join(' · ');
}

const api = { inspect, validate, describe };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Mp4Check = api;
})(typeof self !== 'undefined' ? self : this);
