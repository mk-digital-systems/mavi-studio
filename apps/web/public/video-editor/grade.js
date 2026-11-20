/* Mavi Kadraj — renk ve görünüm hattı (piksel işleme).
   Pozlama, ton eğrisi (kontrast/gölge/aydınlık), doygunluk, doğal canlılık (ten korumalı), sıcaklık, bölünmüş ton,
   siyah-beyaz/sepya ve halesiz keskinleştirme. Tarayıcıdan bağımsızdır; ImageData benzeri {data,width,height} alır.
   Sonuç önizleme ve dışa aktarmada aynı koddan çıkar. */
(function (root) {
'use strict';
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const SCALARS = ['exposure', 'contrast', 'shadows', 'highlights', 'roll', 'fade', 'saturation', 'vibrance', 'warmth', 'sharp', 'bw', 'sepia', 'shAmt', 'hiAmt'];

// ---- Hazır görünümler (yoğunluk 100'de bu değerler; yoğunluk düştükçe nötre yaklaşır) ----
// Sinematik: dengeli kontrast, aydınlıkta ayrıntı (roll), kontrollü gölge, doğal ten (düşük sıcaklık/doygunluk kayması).
// film: eski film görünümü seçilince açılan varsayılan film efektleri (hafif).
const LOOKS = {
  none: { name: 'Orijinal' },
  'dogal-sinema': { name: 'Doğal Sinema', cat: 'sinema', contrast: .18, highlights: -.20, shadows: -.06, roll: .5, saturation: -.04, vibrance: .12, warmth: .03, fade: .015, shAmt: .10, hiAmt: .07, splitSh: [.10, .28, .36], splitHi: [1, .86, .70] },
  'canli-sinema': { name: 'Canlı Sinema', cat: 'sinema', contrast: .24, highlights: -.18, shadows: -.03, roll: .42, saturation: .10, vibrance: .40, warmth: .02, sharp: .22, shAmt: .09, hiAmt: .07, splitSh: [.10, .30, .38], splitHi: [1, .85, .68] },
  'sicak-sonbahar': { name: 'Sıcak Sonbahar', cat: 'sinema', exposure: .04, contrast: .16, highlights: -.14, shadows: -.02, roll: .38, saturation: .06, vibrance: .24, warmth: .30, fade: .025, shAmt: .10, hiAmt: .15, splitSh: [.36, .22, .12], splitHi: [1, .72, .45] },
  'soguk-sisli': { name: 'Soğuk ve Sisli', cat: 'sinema', contrast: -.08, highlights: -.05, shadows: .14, roll: .30, saturation: -.12, vibrance: .08, warmth: -.22, fade: .07, shAmt: .18, hiAmt: .08, splitSh: [.20, .36, .46], splitHi: [.85, .93, 1] },
  'renkli-eski': { name: 'Renkli Eski Film', cat: 'film', contrast: .12, highlights: -.10, roll: .35, saturation: -.14, vibrance: .06, warmth: .12, fade: .05, shAmt: .10, hiAmt: .12, splitSh: [.12, .22, .22], splitHi: [1, .82, .55], film: { grain: 28, vignette: 28, dust: 14, flicker: 8, weave: 8 } },
  'soluk-hati': { name: 'Soluk Hatıra', cat: 'film', contrast: -.12, highlights: -.10, roll: .30, saturation: -.38, warmth: .10, fade: .10, shAmt: .06, hiAmt: .06, splitSh: [.30, .30, .34], splitHi: [1, .90, .75], film: { grain: 20, vignette: 20, dust: 10, flicker: 5, weave: 5 } },
  'sepya': { name: 'Sepya', cat: 'film', contrast: .15, highlights: -.08, roll: .3, fade: .04, sepia: 1, film: { grain: 25, vignette: 30, dust: 14, flicker: 8, weave: 6 } },
  'siyah-beyaz': { name: 'Siyah Beyaz Film', cat: 'film', contrast: .28, shadows: -.05, highlights: -.08, roll: .32, fade: .02, bw: 1, film: { grain: 32, vignette: 25, dust: 15, flicker: 8, weave: 8 } }
};

// Sahne ayarlarından hat parametreleri. adj alanları: sat, vib, con, exp, warm (−1..1), sharp (0..1).
function params(look, amount, adj) {
  const L = LOOKS[look] || LOOKS.none, a = clamp(amount == null ? 1 : amount), j = adj || {};
  const p = {};
  for (const k of SCALARS) p[k] = (L[k] || 0) * a;
  p.splitSh = L.splitSh || [.5, .5, .5]; p.splitHi = L.splitHi || [.5, .5, .5];
  p.saturation += j.sat || 0; p.vibrance += j.vib || 0; p.contrast += j.con || 0; p.exposure += (j.exp || 0) * 1.2; p.warmth += j.warm || 0; p.sharp += j.sharp || 0;
  p.contrast = clamp(p.contrast, -1, 1.2); p.saturation = clamp(p.saturation, -1, 1); p.vibrance = clamp(p.vibrance, -1, 1.2); p.warmth = clamp(p.warmth, -1, 1); p.sharp = clamp(p.sharp, 0, 1);
  return p;
}
function isNeutral(p) { return SCALARS.every(k => Math.abs(p[k]) < 1e-4); }
// Önbellek anahtarı: yalnızca sonucu etkileyen değerler.
function key(p) { return SCALARS.map(k => p[k].toFixed(3)).join(',') + '|' + p.splitSh.join(',') + '|' + p.splitHi.join(','); }

// ---- Tablolar ----
const TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; TO_LIN[i] = c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }
const FROM_LIN = new Float32Array(4097);
for (let i = 0; i <= 4096; i++) { const l = i / 4096; FROM_LIN[i] = l <= .0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - .055; }
const lin2gam = l => FROM_LIN[(clamp(l) * 4096 + .5) | 0];
const softClip = x => (x < .85 ? x : .85 + .15 * (1 - Math.exp(-(x - .85) / .15)));   // pozlama artınca aydınlıkta ayrıntı kalsın
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Ton eğrisi: gölge/aydınlık, kontrast (S eğrisi, uçlar sabit), aydınlık yumuşatma (beyaz noktayı hafif indirir), siyah kaldırma.
function buildTone(p) {
  const T = new Float32Array(1025);
  for (let k = 0; k <= 1024; k++) {
    const v = k / 1024;
    let f = v + p.shadows * .22 * (4 * v * Math.pow(1 - v, 3)) + p.highlights * .22 * (4 * v * v * v * (1 - v));
    f = clamp(f);
    const ss = f * f * (3 - 2 * f); f = f + p.contrast * (ss - f);
    f = clamp(f);
    if (p.roll > 0) f -= p.roll * .10 * smooth(.72, 1, f);
    f = p.fade + clamp(f) * (1 - p.fade);
    T[k] = clamp(f);
  }
  return T;
}

// Renk tonu (derece), 0–360
function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  if (c < 1e-6) return 0;
  let h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  h *= 60; return h < 0 ? h + 360 : h;
}

function apply(img, p) {
  if (isNeutral(p)) return img;
  const d = img.data, n = img.width * img.height;
  const gain = Math.pow(2, p.exposure), tone = buildTone(p);
  let gr = 1 + .18 * p.warmth, gg = 1 + .02 * p.warmth, gb = 1 - .18 * p.warmth;
  const ln = .2126 * gr + .7152 * gg + .0722 * gb; gr = gr * gain / ln; gg = gg * gain / ln; gb = gb * gain / ln;
  const useTone = Math.abs(p.contrast) > 1e-4 || Math.abs(p.shadows) > 1e-4 || Math.abs(p.highlights) > 1e-4 || p.roll > 0 || p.fade > 0;
  const sat0 = 1 + p.saturation, vib = p.vibrance, shA = p.shAmt, hiA = p.hiAmt;
  const lumC = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  const shO = p.splitSh.map(c => c - lumC(p.splitSh)), hiO = p.splitHi.map(c => c - lumC(p.splitHi));
  const guard = p.bw < .5 && p.sepia < .5 && (p.saturation > 1e-4 || p.vibrance > 1e-4 || p.contrast > 1e-4 || p.warmth !== 0 || p.shAmt > 0 || p.hiAmt > 0);
  const doSat = Math.abs(p.saturation) > 1e-4 || Math.abs(vib) > 1e-4, doSplit = shA > 1e-4 || hiA > 1e-4, bw = p.bw, sep = p.sepia;
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    // Ten koruması: girdi pikselinin ten ağırlığı ve doygunluğu (sonda doygunluk artışı en çok %15 ile sınırlanır)
    let skinIn = 0, satIn = 0;
    if (guard) {
      const r0 = d[o] / 255, g0 = d[o + 1] / 255, b0 = d[o + 2] / 255, mx0 = Math.max(r0, g0, b0), mn0 = Math.min(r0, g0, b0);
      satIn = mx0 > 1e-4 ? (mx0 - mn0) / mx0 : 0;
      skinIn = clamp(1 - (Math.abs(hueOf(r0, g0, b0) - 28) - 12) / 20) * smooth(.12, .3, satIn) * (1 - smooth(.6, .85, satIn));
    }
    let r = softClip(TO_LIN[d[o]] * gr), g = softClip(TO_LIN[d[o + 1]] * gg), b = softClip(TO_LIN[d[o + 2]] * gb);
    r = lin2gam(r); g = lin2gam(g); b = lin2gam(b);
    if (useTone) { r = tone[(r * 1024 + .5) | 0]; g = tone[(g * 1024 + .5) | 0]; b = tone[(b * 1024 + .5) | 0]; }
    let y = .2126 * r + .7152 * g + .0722 * b;
    if (doSat) {
      let cs = sat0;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx > 1e-4 ? (mx - mn) / mx : 0;
      // ten tonları (turuncu bölge, orta doygunluk): hem canlılık hem genel doygunluk artışı burada yumuşatılır
      const skin = (cs > 1 || vib > 0) ? clamp(1 - (Math.abs(hueOf(r, g, b) - 28) - 12) / 20) * smooth(.12, .3, s) * (1 - smooth(.6, .85, s)) : 0;
      if (cs > 1) cs = 1 + (cs - 1) * (1 - .6 * skin);
      if (vib > 0) cs *= 1 + vib * 1.1 * (1 - s) * (1 - .95 * skin);   // zaten doygun renklere az, soluk renklere çok
      else if (vib < 0) cs *= 1 + vib * s;
      if (cs !== 1) {
        let dr = r - y, dg = g - y, db = b - y, k = cs;
        if (k > 1) {   // taşma olursa renk tonunu bozmadan doygunluğu sınırla
          const lim = c => (c > 1e-6 ? (1 - y) / c : c < -1e-6 ? y / -c : 1e9);
          k = Math.min(k, lim(dr), lim(dg), lim(db)); if (k < 1) k = 1;
        }
        r = clamp(y + dr * k); g = clamp(y + dg * k); b = clamp(y + db * k); y = .2126 * r + .7152 * g + .0722 * b;
      }
    }
    if (doSplit) {
      const ws = (1 - y) * (1 - y) * shA, wh = y * y * hiA;
      r = clamp(r + shO[0] * ws + hiO[0] * wh); g = clamp(g + shO[1] * ws + hiO[1] * wh); b = clamp(b + shO[2] * ws + hiO[2] * wh);
    }
    if (skinIn > .05) {
      for (let it = 0; it < 2; it++) {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), so = mx > 1e-4 ? (mx - mn) / mx : 0, cap = satIn * 1.15;
        if (so <= cap + 1e-4) break;
        const target = so + (cap - so) * skinIn, f = target / so, yy = .2126 * r + .7152 * g + .0722 * b;
        r = yy + (r - yy) * f; g = yy + (g - yy) * f; b = yy + (b - yy) * f;
      }
    }
    if (bw > 0 || sep > 0) {
      const l = .2126 * r + .7152 * g + .0722 * b;
      if (bw > 0) { r += (l - r) * bw; g += (l - g) * bw; b += (l - b) * bw; }
      if (sep > 0) { const sr = clamp(l * 1.08 + .02), sg = clamp(l * .80 + .01), sb = clamp(l * .56); r += (sr - r) * sep; g += (sg - g) * sep; b += (sb - b) * sep; }
    }
    d[o] = clamp(r) * 255 + .5; d[o + 1] = clamp(g) * 255 + .5; d[o + 2] = clamp(b) * 255 + .5;
  }
  if (p.sharp > .01) sharpen(img, p.sharp);
  return img;
}

// Üç geçişli kutu bulanıklığı (gauss yaklaşımı), ayrılabilir.
function boxBlur(src, w, h, rad) {
  const a = new Float32Array(src), t = new Float32Array(src.length), inv = 1 / (2 * rad + 1);
  const pass = (from, to, len, step, count, stride) => {
    for (let c = 0; c < count; c++) {
      const base = c * stride; let acc = 0;
      for (let k = -rad; k <= rad; k++) acc += from[base + Math.min(len - 1, Math.max(0, k)) * step];
      for (let k = 0; k < len; k++) {
        to[base + k * step] = acc * inv;
        acc += from[base + Math.min(len - 1, k + rad + 1) * step] - from[base + Math.max(0, k - rad) * step];
      }
    }
  };
  for (let it = 0; it < 3; it++) { pass(a, t, w, 1, h, w); pass(t, a, h, w, w, 1); }
  return a;
}
// Parlaklık kanalında maskeleme: ayrıntı artar, kenarlarda beyaz hale oluşmaz (yerel en küçük/en büyük değerle sınırlı).
function sharpen(img, amount) {
  const w = img.width, h = img.height, d = img.data, n = w * h, L = new Float32Array(n);
  for (let i = 0, o = 0; i < n; i++, o += 4) L[i] = (.2126 * d[o] + .7152 * d[o + 1] + .0722 * d[o + 2]) / 255;
  const rad = Math.max(1, Math.round(Math.max(w, h) / 1800)), B = boxBlur(L, w, h, rad), gain = amount * 1.1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, l = L[i];
      let delta = (l - B[i]) * gain;
      if (delta > .08) delta = .08; else if (delta < -.08) delta = -.08;
      let lo = l, hi = l;
      for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) { const v = L[i + yy * w + xx]; if (v < lo) lo = v; if (v > hi) hi = v; }
      let nl = l + delta; if (nl > hi) nl = hi; else if (nl < lo) nl = lo;
      const dl = (nl - l) * 255, o = i * 4;
      d[o] = clamp(d[o] + dl, 0, 255) ; d[o + 1] = clamp(d[o + 1] + dl, 0, 255); d[o + 2] = clamp(d[o + 2] + dl, 0, 255);
    }
  }
  return img;
}

const api = { LOOKS, SCALARS, params, isNeutral, key, apply, sharpen, hueOf, clamp };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Grade = api;
})(typeof self !== 'undefined' ? self : this);
