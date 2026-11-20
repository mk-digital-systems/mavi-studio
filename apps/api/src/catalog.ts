import { readFileSync } from "node:fs";
import type { TrackPublic } from "@siir/contracts";

type License = {
  type: string; attributionRequired: boolean; attributionText: string;
  allowsCommercialUse: boolean; allowsSocialMediaUse: boolean;
  allowsSaaSRedistribution: boolean; allowsUserGeneratedOutput: boolean;
  evidencePath: string; evidenceVerifiedAt: string;
};
export type TrackRecord = {
  id: string; title: string; artist: string; cover: string; durationSec: number;
  genre: string; mood: string[]; tempoBpm: number; baseHz: number; active: boolean; license: License;
};

const production = process.env.NODE_ENV === "production";

/** Yayın kapısı: üretimde placeholder veya eksik izin/kanıt içeren aktif parça sunucuyu durdurur. */
export function validateCatalog(tracks: TrackRecord[]): string[] {
  const errors: string[] = [];
  for (const t of tracks.filter((x) => x.active)) {
    const l = t.license;
    if (l.type === "placeholder") { if (production) errors.push(`${t.id}: placeholder üretimde yasak`); continue; }
    if (!(l.allowsCommercialUse && l.allowsSocialMediaUse && l.allowsSaaSRedistribution && l.allowsUserGeneratedOutput))
      errors.push(`${t.id}: lisans izinleri eksik`);
    if (!l.evidencePath || !l.evidenceVerifiedAt) errors.push(`${t.id}: lisans kanıtı doğrulanmamış`);
    if (l.attributionRequired && !l.attributionText) errors.push(`${t.id}: atıf metni eksik`);
  }
  return errors;
}

export function loadCatalog(): TrackRecord[] {
  const tracks = JSON.parse(readFileSync(new URL("../catalog/tracks.json", import.meta.url), "utf8")) as TrackRecord[];
  const errors = validateCatalog(tracks);
  if (errors.length) throw new Error("Katalog doğrulaması başarısız:\n" + errors.join("\n"));
  return tracks;
}

/** Yalnızca herkese açık alan kümesi; dosya yolu ve lisans kanıtı asla dönmez. */
export const toPublic = (t: TrackRecord): TrackPublic => ({
  id: t.id, title: t.title, artist: t.artist, cover: t.cover, durationSec: t.durationSec,
  genre: t.genre, mood: t.mood, tempoBpm: t.tempoBpm,
  attributionRequired: t.license.attributionRequired,
  ...(t.license.attributionRequired ? { attributionText: t.license.attributionText } : {}),
});
