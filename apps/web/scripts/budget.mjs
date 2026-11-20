// Performans bütçesi: derlenmiş dosyaların gzip boyutları ve üçüncü taraf istek yokluğu.
// Kullanım: npm run budget  (önce vite build çalıştırır)
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const BUDGET = { js: 130 * 1024, css: 12 * 1024, html: 3 * 1024 }; // gzip bayt (ilk yükleme)
const TOTAL_JS = 220 * 1024; // tüm JS parçalarının toplamı (tembel parçalar dahil)
const files = readdirSync(path.join(dist, "assets"));
// İlk yükleme: index.html'in doğrudan yüklediği dosyalar. Tembel yüklenen sayfa parçaları (yayın masası, akışlar…) ilk yüklemeye girmez,
// ama toplam JS için ayrı bir üst sınır vardır.
const html0 = readFileSync(path.join(dist, "index.html"), "utf8");
const initial = new Set([...html0.matchAll(/assets\/([^"']+\.(?:js|css))/g)].map((m) => m[1]));
const size = (f) => gzipSync(readFileSync(path.join(dist, f))).length;
const sum = (ext, only = initial) => files.filter((f) => f.endsWith(ext) && (!only || only.has(f))).reduce((a, f) => a + size("assets/" + f), 0);
const result = { js: sum(".js"), css: sum(".css"), html: size("index.html") };

let fail = false;
const totalJs = sum(".js", null), okTotal = totalJs <= TOTAL_JS;
fail ||= !okTotal;
console.log(`${okTotal ? "PASS" : "FAIL"} JS toplam gzip ${(totalJs / 1024).toFixed(1)} KB (üst sınır ${(TOTAL_JS / 1024).toFixed(0)} KB)`);
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
