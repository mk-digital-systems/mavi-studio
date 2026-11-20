// Test ortamı: izole veri dizini ve hızlı kodlama. config içe aktarılmadan ÖNCE yüklenmelidir (ilk import).
import path from "node:path";
process.env.SIIR_DATA_DIR = path.join(process.env.TEMP ?? ".", "siir-video-test-data");
process.env.VIDEO_X264_PRESET = "ultrafast";
process.env.MAX_VIDEOS_PER_DAY = "100";
process.env.MAX_EXPORTS_PER_DAY = "50";
process.env.MAX_UPLOAD_BYTES = String(8 * 1024 * 1024);
