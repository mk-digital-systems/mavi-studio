import type { VideoOrientation, VideoPalette, VideoTarget } from "@siir/contracts";

/** 9:16, 16:9 ve 1:1 çıktı boyutları (H.264 için çift sayılar). */
export const DIMENSIONS: Record<VideoOrientation, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
};

/**
 * Platform ön ayarları. `softMaxSec` yalnızca UYARI üretir (engellemez); platform süre sınırları
 * değişebildiği için yayın öncesi güncel değerler doğrulanmalıdır.
 */
export const TARGETS: Record<VideoTarget, { label: string; orientation: VideoOrientation; softMaxSec: number; fps: number; maxrateK: number }> = {
  tiktok: { label: "TikTok", orientation: "portrait", softMaxSec: 600, fps: 30, maxrateK: 8000 },
  reels: { label: "Instagram Reels", orientation: "portrait", softMaxSec: 90, fps: 30, maxrateK: 8000 },
  youtube: { label: "YouTube", orientation: "landscape", softMaxSec: 15 * 60, fps: 30, maxrateK: 12000 },
};

/** Koyu tonlu degradeler: beyaz altyazı okunaklı kalsın (ayrıca yarı saydam karartma uygulanır). Renkler 0xRRGGBB. */
export const PALETTES: Record<VideoPalette, { label: string; colors: [string, string, string] }> = {
  dusk: { label: "Alacakaranlık", colors: ["1d1530", "5a3a52", "7a3e2b"] },
  dawn: { label: "Şafak", colors: ["2a2233", "8a5a44", "c98a5a"] },
  night: { label: "Gece", colors: ["0b1020", "1d2a4d", "34506a"] },
  forest: { label: "Orman", colors: ["0f1f1a", "24453b", "4a6b52"] },
  ember: { label: "Kor", colors: ["1a0f0d", "5a1f2b", "a0502f"] },
};

export const isOrientation = (v: unknown): v is VideoOrientation => typeof v === "string" && v in DIMENSIONS;
export const isTarget = (v: unknown): v is VideoTarget => typeof v === "string" && v in TARGETS;
export const isPalette = (v: unknown): v is VideoPalette => typeof v === "string" && v in PALETTES;
