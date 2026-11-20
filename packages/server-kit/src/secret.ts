import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

/**
 * İmza anahtarı. Üretimde ortamdan ZORUNLU. Geliştirmede, API ve video işçisi (ayrı süreçler) aynı anahtarı
 * paylaşabilsin diye veri dizininde bir kez üretilip saklanır (dizin git'e girmez).
 */
export function loadSigningSecret(opt: { dataDir: string; env?: string; production: boolean }): string {
  if (opt.env) return opt.env;
  if (opt.production) throw new Error("Üretimde SIGNING_SECRET zorunludur.");
  const f = path.join(opt.dataDir, "dev-signing-secret");
  if (existsSync(f)) return readFileSync(f, "utf8").trim();
  mkdirSync(opt.dataDir, { recursive: true });
  const s = randomBytes(32).toString("hex");
  writeFileSync(f, s, { mode: 0o600 });
  return s;
}
