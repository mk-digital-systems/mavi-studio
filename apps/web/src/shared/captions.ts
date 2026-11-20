import type { LineTiming } from "@siir/contracts";
import { parsePoem } from "./util";

export type StanzaCue = { text: string; start: number; end: number };

/**
 * Şiir kıtalarını video zaman çizelgesi için altyazıya çevirir (saniye). Satır zamanlaması varsa ona göre,
 * yoksa (konuşma bulunamadı) ses süresine satır sayısı oranında eşit dağıtılır. En çok `max` altyazı üretir (bitişik kıtalar birleşir).
 */
export function stanzaCues(text: string, timings: LineTiming[], durationSec: number, max = 28): StanzaCue[] {
  const stanzas = parsePoem(text).stanzas, byId = new Map(timings.map((t) => [t.lineId, t]));
  const total = stanzas.reduce((a, s) => a + s.lines.length, 0) || 1;
  let acc = 0;
  let cues: StanzaCue[] = stanzas.map((s) => {
    const ts = s.lines.map((l) => byId.get(l.id)).filter((t): t is LineTiming => !!t);
    const body = s.lines.map((l) => l.text).join("\n");
    const cue = ts.length
      ? { text: body, start: Math.min(...ts.map((t) => t.startMs)) / 1000, end: Math.max(...ts.map((t) => t.endMs)) / 1000 }
      : { text: body, start: (acc / total) * durationSec, end: ((acc + s.lines.length) / total) * durationSec };
    acc += s.lines.length;
    return cue;
  });
  while (cues.length > max) {
    let k = 0, best = Infinity;
    for (let i = 0; i < cues.length - 1; i++) {
      const len = cues[i].end - cues[i].start + (cues[i + 1].end - cues[i + 1].start);
      if (len < best) { best = len; k = i; }
    }
    cues.splice(k, 2, { text: cues[k].text + "\n\n" + cues[k + 1].text, start: cues[k].start, end: cues[k + 1].end });
  }
  cues = cues.map((c) => ({ ...c, end: Math.max(c.end, c.start + 0.5) }));
  return cues;
}
