import type { Section } from "../shared/settings";
import type { IconName } from "./icons";

export type NavItem = { id: Section; label: string; icon: IconName };
export type NavGroup = { id: "studio" | "live"; label: string; icon: IconName; items: NavItem[] };

/** Ses Stüdyosu'nun alt bölümleri: bağımsız ürünler değil, aynı stüdyonun parçaları. Şiir, deneme ve kayıtlı şiir ayrı içerik türleridir. */
export const STUDIO_SUB: NavItem[] = [
  { id: "studio", label: "Yeni Kayıt", icon: "mic" },
  { id: "poems", label: "Şiirlerim", icon: "book" },
  { id: "recordings", label: "Kayıt Denemelerim", icon: "wave" },
  { id: "performances", label: "Kayıtlı Şiirlerim", icon: "star" },
  { id: "music", label: "Fon Müziklerim", icon: "music" },
  { id: "settings", label: "Stüdyo Ayarları", icon: "settings" },
];
/** Yayın Stüdyosu'nun alt bölümleri. */
export const LIVE_SUB: NavItem[] = [
  { id: "live", label: "Canlı Yayın Masası", icon: "live" },
  { id: "flows", label: "Yayın Akışlarım", icon: "list" },
  { id: "sfx", label: "Ses Efektleri", icon: "bolt" },
  { id: "live-settings", label: "Yayın Ayarları", icon: "settings" },
];
export const GROUPS: NavGroup[] = [
  { id: "studio", label: "Ses Stüdyosu", icon: "mic", items: STUDIO_SUB },
  { id: "live", label: "Yayın Stüdyosu", icon: "live", items: LIVE_SUB },
];
export const STUDIO_SECTIONS: Section[] = STUDIO_SUB.map((n) => n.id);
export const LIVE_SECTIONS: Section[] = LIVE_SUB.map((n) => n.id);
export const inStudio = (s: Section) => STUDIO_SECTIONS.includes(s);
export const inLive = (s: Section) => LIVE_SECTIONS.includes(s);
/** Bir bölümün ait olduğu ana modül. */
export const moduleOf = (s: Section): "home" | "studio" | "video" | "live" => (s === "home" ? "home" : inStudio(s) ? "studio" : inLive(s) ? "live" : "video");

/** Ana menü: dört modül. Video Arşivi, Video Stüdyosu'nun içinde bir sekmedir. */
export const MAIN_NAV: NavItem[] = [
  { id: "home", label: "Ana Panel", icon: "home" },
  { id: "studio", label: "Ses Stüdyosu", icon: "mic" },
  { id: "video", label: "Video Stüdyosu", icon: "film" },
  { id: "live", label: "Yayın Stüdyosu", icon: "live" },
];
const TITLES: Partial<Record<Section, string>> = { archive: "Video Arşivi" };
export const sectionTitle = (s: Section) => TITLES[s] ?? [...STUDIO_SUB, ...LIVE_SUB, ...MAIN_NAV].find((n) => n.id === s)?.label ?? "";
/** Açılış ekranı seçenekleri: yalnızca ana modüller. */
export const START_OPTIONS: { id: Section; label: string }[] = MAIN_NAV.map(({ id, label }) => ({ id, label }));
