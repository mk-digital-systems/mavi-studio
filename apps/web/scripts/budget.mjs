// Performans bütçesi: derlenmiş dosyaların gzip boyutları ve üçüncü taraf istek yokluğu.
// Kullanım: npm run budget  (önce vite build çalıştırır)
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const BUDGET = { js: 130 * 1024, css: 12 * 1024, html: 3 * 1024 }; // gzip bayt (ilk yükleme)
const files = readdirSync(path.join(dist, "assets"));
const size = (f) => gzipSync(readFileSync(path.join(dist, f))).length;
const sum = (ext) => files.filter((f) => f.endsWith(ext)).reduce((a, f) => a + size("assets/" + f), 0);
const result = { js: sum(".js"), css: sum(".css"), html: size("index.html") };

let fail = false;
for (const k of Object.keys(BUDGET)) {
  const ok = result[k] <= BUDGET[k];
  fail ||= !ok;
  console.log(`${ok ? "PASS" : "FAIL"} ${k.toUpperCase()} gzip ${(result[k] / 1024).toFixed(1)} KB (bütçe ${(BUDGET[k] / 1024).toFixed(0)} KB)`);
}
// Gizlilik/performans: derlenmiş çıktı harici bir alan adına istek içermemeli (yazı tipi, CDN, izleyici yok).
// Yalnızca XML ad alanı (SVG) bildirimleri ve Turnstile (isteğe bağlı bot koruması) hariç.
const code = files.filter((f) => f.endsWith(".js") || f.endsWith(".css")).map((f) => readFileSync(path.join(dist, "assets", f), "utf8")).join("\n") + readFileSync(path.join(dist, "index.html"), "utf8");
const urls = [...new Set(code.match(/https?:\/\/[a-z0-9.-]+/gi) ?? [])]
  .filter((u) => !/w3\.org|reactjs\.org|react\.dev|mustafaoner\.net|challenges\.cloudflare\.com|localhost|127\.0\.0\.1/i.test(u));
console.log(`${urls.length === 0 ? "PASS" : "FAIL"} üçüncü taraf adres yok ${urls.join(", ")}`);
if (urls.length) fail = true;
process.exit(fail ? 1 : 0);
