import type { AtmosphereId, FxControls, FxModuleId, FxSettings } from "@siir/contracts";
import type { Analysis } from "./analysis";

export const FX_MODULES: { id: FxModuleId; label: string }[] = [
  { id: "highpass", label: "Düşük frekans temizliği" },
  { id: "gate", label: "Hafif gürültü kapısı" },
  { id: "eq", label: "Konuşma EQ'su" },
  { id: "compressor", label: "Kompresör" },
  { id: "deesser", label: "S sesi yumuşatıcı" },
  { id: "reverb", label: "Ortam / yankı" },
];

export const CONTROL_RANGES: Record<keyof FxControls, { min: number; max: number; step: number; label: string; hint: string }> = {
  cleanliness: { min: 0, max: 100, step: 1, label: "Ses temizliği", hint: "Arka plan uğultusunu ve hışırtıyı azaltır." },
  warmth: { min: 0, max: 100, step: 1, label: "Ses sıcaklığı", hint: "Sesi daha dolgun veya daha ince yapar." },
  clarity: { min: 0, max: 100, step: 1, label: "Ses netliği", hint: "Sözcüklerin daha seçilebilir olmasını sağlar." },
  width: { min: 0, max: 100, step: 1, label: "Ortam genişliği", hint: "Yankının sağa-sola yayılma miktarı." },
  reverb: { min: 0, max: 100, step: 1, label: "Yankı miktarı", hint: "Mekânın duyulma düzeyi (üst sınır güvenli tutulur)." },
  outputDb: { min: -6, max: 6, step: 0.5, label: "Çıkış seviyesi", hint: "Genel ses yüksekliği (dB)." },
};

/** Atmosfer şekli: kontrol kaydırıcılarının üzerinde çalıştığı sabit, ölçülü değerler. */
export type PresetShape = {
  decaySec: number; predelayMs: number; damping: number; size: number; erGain: number;
  slapMs: number; slapGain: number; compRatio: number; deessDb: number; lpHz: number; hpExtraHz: number;
};
export type Preset = { id: AtmosphereId; label: string; description: string; defaults: FxControls; shape: PresetShape };

const S = (o: Partial<PresetShape>): PresetShape => ({
  decaySec: 0.3, predelayMs: 6, damping: 0.4, size: 0.7, erGain: 0.5, slapMs: 0, slapGain: 0,
  compRatio: 2.4, deessDb: 3, lpHz: 0, hpExtraHz: 0, ...o,
});

export const PRESETS: Record<AtmosphereId, Preset> = {
  clean: { id: "clean", label: "Temiz Stüdyo", description: "Doğal, net, kuru ses.",
    defaults: { cleanliness: 50, warmth: 40, clarity: 55, width: 30, reverb: 12, outputDb: 0 },
    shape: S({ decaySec: 0.25, predelayMs: 4, size: 0.6, damping: 0.5 }) },
  warm: { id: "warm", label: "Sıcak Stüdyo", description: "Dolgun ve yumuşak, kısa oda.",
    defaults: { cleanliness: 50, warmth: 72, clarity: 42, width: 35, reverb: 20, outputDb: 0 },
    shape: S({ decaySec: 0.35, predelayMs: 6, size: 0.7, damping: 0.55 }) },
  intimate: { id: "intimate", label: "Yakın ve Samimi", description: "Kulağa fısıldar gibi, yakın.",
    defaults: { cleanliness: 55, warmth: 66, clarity: 45, width: 20, reverb: 8, outputDb: 0 },
    shape: S({ decaySec: 0.2, predelayMs: 3, size: 0.5, compRatio: 3.2, deessDb: 5 }) },
  "small-hall": { id: "small-hall", label: "Küçük Salon", description: "Küçük bir konser salonu.",
    defaults: { cleanliness: 50, warmth: 50, clarity: 50, width: 55, reverb: 40, outputDb: 0 },
    shape: S({ decaySec: 1.0, predelayMs: 12, size: 1.0, damping: 0.5, erGain: 0.7 }) },
  "big-hall": { id: "big-hall", label: "Büyük Salon", description: "Geniş, yüksek tavanlı salon.",
    defaults: { cleanliness: 50, warmth: 52, clarity: 52, width: 80, reverb: 55, outputDb: 0 },
    shape: S({ decaySec: 2.3, predelayMs: 25, size: 1.5, damping: 0.6, erGain: 0.5 }) },
  stage: { id: "stage", label: "Sahne", description: "Sahne hissi, hafif yankılı.",
    defaults: { cleanliness: 50, warmth: 50, clarity: 58, width: 60, reverb: 38, outputDb: 0 },
    shape: S({ decaySec: 0.7, predelayMs: 18, size: 0.9, slapMs: 110, slapGain: 0.3, compRatio: 2.8 }) },
  cinematic: { id: "cinematic", label: "Sinematik Şiir", description: "Geniş, duygusal, yumuşak kuyruk.",
    defaults: { cleanliness: 50, warmth: 66, clarity: 46, width: 85, reverb: 62, outputDb: 0 },
    shape: S({ decaySec: 2.8, predelayMs: 30, size: 1.6, damping: 0.62, compRatio: 3.0 }) },
  vintage: { id: "vintage", label: "Radyo Atmosferi", description: "Eski radyo tınısı (bant sınırlı).",
    defaults: { cleanliness: 50, warmth: 55, clarity: 62, width: 15, reverb: 14, outputDb: 0 },
    shape: S({ decaySec: 0.3, predelayMs: 5, size: 0.6, lpHz: 7200, hpExtraHz: 130, compRatio: 3.0 }) },
};
export const PRESET_ORDER: AtmosphereId[] = ["clean", "warm", "intimate", "small-hall", "big-hall", "stage", "cinematic", "vintage"];

/** Güvenlik sınırları: yankı anlaşılırlığı bozmasın. */
export const LIMITS = { maxWet: 0.25, maxDecaySec: 3.0, limiterCeilingDb: -1.5 } as const;

// ---------- Ayar yaratma ve doğrulama ----------
export const defaultFx = (preset: AtmosphereId = "clean"): FxSettings => ({
  schemaVersion: 1, enabled: true, preset, controls: { ...PRESETS[preset].defaults }, bypass: {},
});

const num = (v: unknown, min: number, max: number, dflt: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt;

/** Her girdiyi (eski şema, bozuk, kötü niyetli) güvenli bir FxSettings'e çevirir. Hiçbir zaman fırlatmaz. */
export function sanitizeFx(raw: unknown): FxSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const preset: AtmosphereId = typeof o.preset === "string" && o.preset in PRESETS ? (o.preset as AtmosphereId) : "clean";
  const base = PRESETS[preset].defaults;
  const c = (o.controls && typeof o.controls === "object" ? o.controls : {}) as Record<string, unknown>;
  const controls = {} as FxControls;
  (Object.keys(CONTROL_RANGES) as (keyof FxControls)[]).forEach((k) => {
    const r = CONTROL_RANGES[k];
    controls[k] = num(c[k], r.min, r.max, base[k]);
  });
  const bypass: FxSettings["bypass"] = {};
  const b = (o.bypass && typeof o.bypass === "object" ? o.bypass : {}) as Record<string, unknown>;
  for (const m of FX_MODULES) if (b[m.id] === true) bypass[m.id] = true;
  return { schemaVersion: 1, enabled: typeof o.enabled === "boolean" ? o.enabled : true, preset, controls, bypass };
}

/** Atmosferi değiştirir ve kontrolleri o atmosferin varsayılanlarına çeker (çıkış seviyesi ve bypass korunur). */
export const applyPreset = (s: FxSettings, id: AtmosphereId): FxSettings => ({
  ...s, preset: id, controls: { ...PRESETS[id].defaults, outputDb: s.controls.outputDb },
});

// ---------- Kullanıcı kontrolleri → DSP parametreleri ----------
export type ChainParams = {
  inputDb: number; hpfHz: number;
  expander: { thrDb: number; ratio: number; rangeDb: number };
  eq: { lowShelfDb: number; mudDb: number; presenceDb: number; airDb: number; lpHz: number };
  comp: { thrDb: number; ratio: number; kneeDb: number; attMs: number; relMs: number; makeupDb: number };
  deess: { maxRedDb: number; ratioThr: number };
  outputDb: number;
  wet: number; stereoWidth: number;
  reverb: { decaySec: number; predelayMs: number; damping: number; size: number; erGain: number; slapMs: number; slapGain: number };
  bypass: Partial<Record<FxModuleId, boolean>>;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function resolveParams(s: FxSettings, a?: Analysis): ChainParams {
  const { controls: c, bypass } = s;
  const sh = PRESETS[s.preset].shape;
  const silent = !!a?.flags.silent;
  // Giriş kazancı: konuşmayı ≈ −21 dBFS RMS'e getir; en yüksek tepe −3 dBFS'i geçmesin; sessizse yükseltme.
  let inputDb = 0;
  if (a && !silent) inputDb = clamp(-21 - a.speechDb, -12, Math.min(12, -3 - a.peakDb));
  const speech = a && !silent ? a.speechDb + inputDb : -21;
  const floor = a && !silent ? a.noiseFloorDb + inputDb : -60;
  // Gate eşiği: gürültü tabanının biraz üstü, konuşmanın en az 18 dB altı.
  const gateThr = clamp(floor + 6, -70, speech - 18);
  const rangeDb = silent ? 0 : (c.cleanliness / 100) * 14;
  const wet = Math.min(LIMITS.maxWet, (c.reverb / 100) * LIMITS.maxWet);
  const on = s.enabled;
  return {
    inputDb: on ? inputDb : 0,
    hpfHz: clamp(70 + c.cleanliness * 0.4, 70, 110) + sh.hpExtraHz,
    expander: { thrDb: gateThr, ratio: 1.3 + (c.cleanliness / 100) * 0.9, rangeDb },
    eq: {
      lowShelfDb: (c.warmth - 50) * 0.07,             // ±3.5 dB @ 180 Hz
      mudDb: -Math.max(0, (c.warmth - 50) * 0.04),    // sıcaklık artınca çamur kesimi
      presenceDb: (c.clarity - 50) * 0.08,            // ±4 dB @ 3.2 kHz
      airDb: (c.clarity - 50) * 0.04 - (c.warmth - 50) * 0.02, // hava (±2 dB)
      lpHz: sh.lpHz,
    },
    comp: { thrDb: clamp(speech - 2, -40, -10), ratio: sh.compRatio, kneeDb: 8, attMs: 12, relMs: 150, makeupDb: 0 },
    deess: { maxRedDb: sh.deessDb, ratioThr: 0.5 },
    outputDb: on ? c.outputDb : 0,
    wet: on ? wet : 0,
    stereoWidth: (c.width / 100) * 1.5,
    reverb: {
      decaySec: Math.min(LIMITS.maxDecaySec, sh.decaySec), predelayMs: sh.predelayMs, damping: sh.damping, size: sh.size,
      erGain: sh.erGain, slapMs: sh.slapMs, slapGain: sh.slapGain,
    },
    bypass: s.enabled ? bypass : { highpass: true, gate: true, eq: true, compressor: true, deesser: true, reverb: true },
  };
}

/** Yankı kuyruğu süresi (sn): efekt açık ve yankı varsa decay + pay; yoksa kısa. */
export function tailSeconds(s: FxSettings, a?: Analysis): number {
  if (!s.enabled) return 0.05;
  const p = resolveParams(s, a);
  return p.bypass.reverb || p.wet < 0.001 ? 0.2 : Math.min(3.5, p.reverb.decaySec + 0.5);
}
