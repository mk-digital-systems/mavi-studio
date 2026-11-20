import { buildVideoApp } from "./app.js";
import { config } from "./config.js";
import { VideoJobStore } from "./jobs.js";

VideoJobStore.wipeWork(); // yarım kalmış geçici dosyalar başlangıçta silinir
const { app, jobs } = buildVideoApp({ logger: true });
jobs.start();

// Video işçisi yalnızca ExportBundle + imzalı ses başvurusu ile beslenir; dosya yükleme ucu yoktur.
app.listen({ port: config.port, host: "127.0.0.1" }).then(() => console.log(`Video işçisi: http://127.0.0.1:${config.port}`));
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, async () => { await app.close(); process.exit(0); });
