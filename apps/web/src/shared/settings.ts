import { useSyncExternalStore } from "react";
import type { FxSettings, MixSettings, VideoOrientation, VideoPalette, VideoTarget } from "@siir/contracts";
import { defaultFx, sanitizeFx } from "../audio/fx/settings";
import { defaultMix, sanitizeMix } from "./mix";

/**
 * GENEL stüdyo ayarları (cihaza/kullanıcıya ait varsayılanlar). Projeye özel değerler projenin içinde saklanır
 * (Project.fx, Project.mix, Project.reading) ve bu varsayılanları yalnızca YENİ proje açılırken devralır.
 * Burada yalnızca motorlarımızın GERÇEKTEN desteklediği ayarlar bulunur; desteklenmeyenler arayüzde ayrıca belirtilir.
 */
export type Section = "home" | "studio" | "video" | "poems" | "music" | "archive" | "recordings" | "settings" | "performances" | "live" | "flows" | "sfx" | "live-settings";
export const SECTIONS: Section[] = ["home", "studio", "video", "poems", "music", "archive", "recordings", "settings", "performances", "live", "flows", "sfx", "live-settings"];

export type StudioSettings = {
  schemaVersion: 1;
  audio: { deviceId: string; countdownSec: 0 | 3 | 5 };
  /** Yeni projelerin başlangıç değerleri (proje içinde değiştirilebilir). */
  newProject: { fx: FxSettings; mix: MixSettings };
  video: { target: VideoTarget; orientation: VideoOrientation; palette: VideoPalette; captions: boolean; showTitle: boolean };
  music: { favorites: string[] };
  reading: { speed: number; fontScale: number; lineHeight: number; autoScroll: boolean };
  appearance: { theme: "system" | "dark" | "light"; textScale: number; sidebar: "full" | "compact"; startSection: Section };
  /** Yayın Stüdyosu varsayılanları (ses masası). */
  broadcast: BroadcastSettings;
};

export type ChannelId = "mic" | "music" | "voice" | "sfx";
export type BroadcastSettings = {
  volumes: Record<ChannelId, number>;      // 0–1 başlangıç seviyeleri
  duck: { enabled: boolean; amountDb: number; thresholdDb: number };  // konuşma önceliği
  micToOutput: boolean;                     // mikrofon ana çıkışa verilsin mi (kulaklık gerekir)
  darkMode: boolean;                        // karanlık yayın modu
};
export const defaultBroadcast = (): BroadcastSettings => ({
  volumes: { mic: 1, music: 0.8, voice: 1, sfx: 0.8 }, duck: { enabled: true, amountDb: 12, thresholdDb: -42 }, micToOutput: false, darkMode: true,
});
export function sanitizeBroadcast(raw: unknown): BroadcastSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>, d = defaultBroadcast(), v = o.volumes ?? {}, k = o.duck ?? {};
  return {
    volumes: { mic: num(v.mic, 0, 1, d.volumes.mic), music: num(v.music, 0, 1, d.volumes.music), voice: num(v.voice, 0, 1, d.volumes.voice), sfx: num(v.sfx, 0, 1, d.volumes.sfx) },
    duck: { enabled: bool(k.enabled, d.duck.enabled), amountDb: num(k.amountDb, 0, 30, d.duck.amountDb), thresholdDb: num(k.thresholdDb, -70, -15, d.duck.thresholdDb) },
    micToOutput: bool(o.micToOutput, false), darkMode: bool(o.darkMode, true),
  };
}

export const defaultSettings = (): StudioSettings => ({
  schemaVersion: 1,
  audio: { deviceId: "", countdownSec: 3 },
  newProject: { fx: defaultFx(), mix: defaultMix() },
  video: { target: "tiktok", orientation: "portrait", palette: "dusk", captions: true, showTitle: true },
  music: { favorites: [] },
  reading: { speed: 28, fontScale: 1, lineHeight: 1.5, autoScroll: true },
  appearance: { theme: "system", textScale: 1, sidebar: "full", startSection: "home" },
  broadcast: defaultBroadcast(),
});

const num = (v: unknown, min: number, max: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : d);

/** Her girdiyi (eski sürüm, bozuk, kötü niyetli) güvenli ayara çevirir. Fırlatmaz. */
export function sanitizeSettings(raw: unknown): StudioSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>, d = defaultSettings();
  const a = o.audio ?? {}, n = o.newProject ?? {}, v = o.video ?? {}, m = o.music ?? {}, r = o.reading ?? {}, p = o.appearance ?? {};
  const cd = a.countdownSec === 0 || a.countdownSec === 3 || a.countdownSec === 5 ? a.countdownSec : d.audio.countdownSec;
  const fav = Array.isArray(m.favorites) ? [...new Set((m.favorites as unknown[]).filter((x): x is string => typeof x === "string" && /^trk_\d{4}$/.test(x)))].slice(0, 50) : [];
  return {
    schemaVersion: 1,
    audio: { deviceId: typeof a.deviceId === "string" ? a.deviceId.slice(0, 200) : "", countdownSec: cd },
    newProject: { fx: n.fx === undefined ? d.newProject.fx : sanitizeFx(n.fx), mix: n.mix === undefined ? d.newProject.mix : sanitizeMix(n.mix) },
    video: {
      target: oneOf(v.target, ["tiktok", "reels", "youtube"] as const, d.video.target),
      orientation: oneOf(v.orientation, ["portrait", "landscape", "square"] as const, d.video.orientation),
      palette: oneOf(v.palette, ["dusk", "dawn", "night", "forest", "ember"] as const, d.video.palette),
      captions: bool(v.captions, true), showTitle: bool(v.showTitle, true),
    },
    music: { favorites: fav },
    reading: { speed: num(r.speed, 8, 90, d.reading.speed), fontScale: num(r.fontScale, 0.8, 1.6, 1), lineHeight: num(r.lineHeight, 1.3, 2, 1.5), autoScroll: bool(r.autoScroll, true) },
    broadcast: sanitizeBroadcast(o.broadcast),
    appearance: {
      theme: oneOf(p.theme, ["system", "dark", "light"] as const, "system"), textScale: num(p.textScale, 0.9, 1.3, 1),
      sidebar: oneOf(p.sidebar, ["full", "compact"] as const, "full"), startSection: oneOf(p.startSection, SECTIONS, "home"),
    },
  };
}

/** Eski `siir.prefs` (countFrom/speed/deviceId) değerlerini yeni şemaya taşır. */
export function migrateLegacyPrefs(raw: unknown): StudioSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>, s = defaultSettings();
  return sanitizeSettings({ ...s, audio: { deviceId: o.deviceId, countdownSec: o.countFrom }, reading: { ...s.reading, speed: o.speed } });
}

// ---------- Depolama (localStorage: küçük tercihler; ses/proje verisi asla) ----------
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const KEY = "siir.settings", LEGACY = "siir.prefs";
let store: Store | undefined = typeof localStorage !== "undefined" ? localStorage : undefined;
let cache: StudioSettings | null = null;
const subs = new Set<() => void>();

/** Testler için: depoyu değiştirir ve önbelleği sıfırlar. */
export function _useStore(s: Store | undefined) { store = s; cache = null; subs.forEach((f) => f()); }

function read(): StudioSettings {
  try {
    const raw = store?.getItem(KEY);
    if (raw) return sanitizeSettings(JSON.parse(raw));
    const old = store?.getItem(LEGACY);
    if (old) return migrateLegacyPrefs(JSON.parse(old));
  } catch { /* bozuk kayıt → varsayılan */ }
  return defaultSettings();
}
export const getSettings = (): StudioSettings => (cache ??= read());

/** Güvenli biçimde günceller (doğrular, saklar, dinleyicileri uyarır). */
export function updateSettings(fn: (s: StudioSettings) => StudioSettings) {
  cache = sanitizeSettings(fn(structuredClone(getSettings())));
  try { store?.setItem(KEY, JSON.stringify(cache)); } catch { /* depolama dolu/kapalı: bellekte kalır */ }
  subs.forEach((f) => f());
}
export function resetSettings() { cache = defaultSettings(); try { store?.removeItem(KEY); } catch { /* */ } subs.forEach((f) => f()); }
export const forgetSettings = () => { cache = null; try { store?.removeItem(KEY); store?.removeItem(LEGACY); } catch { /* */ } subs.forEach((f) => f()); };

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useSettings = () => useSyncExternalStore(subscribe, getSettings, getSettings);
