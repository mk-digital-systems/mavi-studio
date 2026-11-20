import { buildApp } from "./app.js";
import { config } from "./config.js";
import { JobStore } from "./jobs.js";

JobStore.wipeTmp(); // yarım kalmış geçici dosyalar başlangıçta silinir
const { app, jobs } = buildApp({ logger: true });
jobs.start();

// Ham müzik için hiçbir uç nokta yoktur; fon müziği kabul eden uç nokta da yoktur.
// Ses kabul eden tek uç: PUT /api/exports/:id/voice (kullanıcının kendi şiir sesi; tek seferlik, sınırlı, geçici).
app.listen({ port: config.port, host: "127.0.0.1" }).then(() => console.log(`API: http://127.0.0.1:${config.port}`));

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, async () => { await app.close(); process.exit(0); });
