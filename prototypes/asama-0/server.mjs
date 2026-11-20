// Aşama 0 — atılabilir doğrulama sunucusu. Bağımlılık yok. Ürün kodu değildir.
// Çalıştır: node server.mjs  →  http://localhost:5170
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const hasFfmpeg = () => spawnSync("ffmpeg", ["-version"]).status === 0;

// Sentetik ses + sentetik müzik → ducking + fade + loudnorm → 48k/24bit stereo WAV.
// Müzik ve ses tamamen sentetiktir; gerçek içerik/dosya kullanılmaz.
function mixTest() {
  return new Promise((resolve) => {
    if (!hasFfmpeg()) return resolve({ ok: false, reason: "ffmpeg bulunamadı (PATH)." });
    const out = path.join(process.env.TEMP || ".", `siir-a0-${Date.now()}.wav`);
    const filter =
      "[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=2[v][sc];" +
      "[1:a]volume=-18dB,afade=t=in:d=2,afade=t=out:st=8:d=2[m];" +
      "[m][sc]sidechaincompress=threshold=0.05:ratio=6:attack=80:release=600[ducked];" +
      "[v][ducked]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1:LRA=11[o]";
    const args = [
      "-y", "-f", "lavfi", "-i", "sine=f=220:d=10:sample_rate=48000",
      "-f", "lavfi", "-i", "sine=f=110:d=10:sample_rate=48000",
      "-filter_complex", filter, "-map", "[o]", "-ar", "48000", "-c:a", "pcm_s24le", out,
    ];
    const t0 = Date.now();
    const p = spawn("ffmpeg", args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      const size = code === 0 ? fs.statSync(out).size : 0;
      if (code === 0) fs.rmSync(out, { force: true }); // geçici dosya hemen silinir
      resolve({ ok: code === 0, ms: Date.now() - t0, bytes: size, log: err.slice(-400) });
    });
  });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/api/mix-test" && req.method === "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(await mixTest()));
    }
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end("yok");
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(5170, "127.0.0.1", () => console.log("Aşama 0: http://localhost:5170"));
