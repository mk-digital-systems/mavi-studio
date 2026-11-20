import type { CaptionCue, VideoOrientation } from "@siir/contracts";

/** ASS zaman biçimi: H:MM:SS.cc (yüzde saniye). */
export function assTime(ms: number): string {
  const cs = Math.max(0, Math.round(ms / 10));
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

/** Metni ASS Dialogue alanı için kaçırır: satır sonu → \N, geçersiz kılma ayracı olan { } kaldırılır, \ düz yazılır. */
export function assEscape(text: string): string {
  return text.replace(/\r/g, "").replace(/[{}]/g, "").replace(/\\/g, "/").split("\n").map((l) => l.trim()).filter(Boolean).join("\\N");
}

const FONT_SIZE: Record<VideoOrientation, number> = { portrait: 66, landscape: 58, square: 62 };

export type AssInput = {
  width: number; height: number; orientation: VideoOrientation; durationMs: number;
  cues: CaptionCue[]; title: string; credits: { poet: string; reader: string }; attribution?: string;
  captions: boolean; showTitle: boolean;
};

/**
 * Altyazı + başlık + künye içeren ASS dosyası (libass ile yakılır).
 * - Her cue: ortada, yumuşak giriş/çıkış; cue'lar çakışmaz (bitiş, sonrakinin başlangıcıyla sınırlanır).
 * - Başlık: üstte, ilk 5 sn. Künye/atıf: altta; atıf gerekiyorsa tüm süre boyunca görünür.
 */
export function buildAss(i: AssInput): string {
  const fs = FONT_SIZE[i.orientation], mH = Math.round(i.width * 0.08), mV = Math.round(i.height * 0.06);
  const hdr = [
    "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${i.width}`, `PlayResY: ${i.height}`, "WrapStyle: 0", "ScaledBorderAndShadow: yes", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Cue,Lora,${fs},&H00FFFFFF,&H000000FF,&H99000000,&H66000000,0,0,0,0,100,100,0,0,1,3,2,5,${mH},${mH},${mV},1`,
    `Style: Title,Lora,${Math.round(fs * 0.62)},&H00A8D6F5,&H000000FF,&H99000000,&H66000000,-1,0,0,0,100,100,1,0,1,2,1,8,${mH},${mH},${mV},1`,
    `Style: Credit,Lora,${Math.round(fs * 0.36)},&HCCFFFFFF,&H000000FF,&H99000000,&H66000000,0,0,0,0,100,100,0,0,1,2,1,2,${mH},${mH},${mV},1`,
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const ev: string[] = [];
  const add = (style: string, s: number, e: number, text: string, fade = "{\\fad(350,350)}") => {
    if (e <= s || !text) return;
    ev.push(`Dialogue: 0,${assTime(s)},${assTime(Math.min(e, i.durationMs))},${style},,0,0,0,,${fade}${text}`);
  };
  if (i.showTitle && i.title) add("Title", 0, Math.min(5000, i.durationMs), assEscape(i.title), "{\\fad(600,600)}");
  if (i.captions) {
    const cues = [...i.cues].sort((a, b) => a.startMs - b.startMs);
    cues.forEach((c, k) => {
      const next = cues[k + 1]?.startMs ?? Infinity;
      const end = Math.min(c.endMs, next - 40, i.durationMs);
      add("Cue", c.startMs, Math.max(end, c.startMs + 300), assEscape(c.text));
    });
  }
  const who = [i.credits.poet && `Şiir: ${i.credits.poet}`, i.credits.reader && `Seslendiren: ${i.credits.reader}`].filter(Boolean).join("  ·  ");
  if (i.attribution) add("Credit", 0, i.durationMs, assEscape((who ? who + "\n" : "") + i.attribution), "");
  else if (who) add("Credit", Math.max(0, i.durationMs - 5000), i.durationMs, assEscape(who), "{\\fad(500,0)}");
  return hdr.concat(ev).join("\n") + "\n";
}

/** Şiir metninden satırları (lineId ile) çıkarır; istemcideki ayrıştırmayla aynı kimlik düzeni (s{kıta}l{satır}). */
export function poemLines(text: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  text.replace(/\r/g, "").split(/\n\s*\n/).map((s) => s.split("\n").map((l) => l.trim()).filter(Boolean)).filter((l) => l.length)
    .forEach((lines, si) => lines.forEach((t, li) => out.push({ id: `s${si}l${li}`, text: t })));
  return out;
}

/** İstemci altyazı göndermediyse, zamanlamalardan türetir (her satır bir cue). */
export function cuesFromTimings(text: string, timings: { lineId: string; startMs: number; endMs: number }[]): CaptionCue[] {
  const byId = new Map(poemLines(text).map((l) => [l.id, l.text]));
  return timings.filter((t) => byId.has(t.lineId)).map((t) => ({ startMs: t.startMs, endMs: t.endMs, text: byId.get(t.lineId)!, lineIds: [t.lineId] }));
}
