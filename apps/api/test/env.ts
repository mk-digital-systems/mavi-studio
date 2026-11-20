// Test ortamı: kısa sınırlar ve izole veri dizini. config içe aktarılmadan ÖNCE yüklenmelidir (ilk import).
import path from "node:path";
process.env.SIIR_DATA_DIR = path.join(process.env.TEMP ?? ".", "siir-api-test-data");
process.env.MAX_EXPORTS_PER_DAY = "3";
process.env.MAX_UPLOAD_BYTES = String(2 * 1024 * 1024);
process.env.MAX_CONCURRENT_MIX = "2";
