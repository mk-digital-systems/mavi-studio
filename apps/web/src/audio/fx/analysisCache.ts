import type { Take } from "@siir/contracts";
import { analyzeReader, type TakeReader } from "../../storage/takeReader";
import { Analyzer, type Analysis } from "./analysis";

const cache = new Map<string, Analysis>();

/** Bir denemenin çözümlemesi (konuşma düzeyi, tepe, taşma…). Aynı oturumda tekrar hesaplanmaz. */
export async function analysisFor(take: Take, reader: TakeReader, onProgress?: (p: number) => void): Promise<Analysis> {
  const hit = cache.get(take.id);
  if (hit) return hit;
  const a = (await analyzeReader(reader, (fs) => new Analyzer(fs), onProgress)) as Analysis;
  cache.set(take.id, a);
  return a;
}
export const cachedAnalysis = (id: string) => cache.get(id) ?? null;
