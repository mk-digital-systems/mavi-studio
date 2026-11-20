import type { PoemText } from "@siir/contracts";

export function parsePoem(raw: string): PoemText {
  const stanzas = raw
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((s) => s.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((l) => l.length);
  return {
    raw,
    stanzas: stanzas.map((lines, si) => ({
      id: `s${si}`,
      lines: lines.map((text, li) => ({ id: `s${si}l${li}`, text })),
    })),
  };
}
const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
export const slug = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (c) => map[c])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "siir";
export const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
