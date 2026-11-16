// คัดลอกไฟล์ WASM ของตัวอ่านบาร์โค้ด (zxing) ไปไว้ใน public/ ให้เว็บโหลดจากโดเมนเราเอง (ไม่พึ่ง CDN ภายนอก)
// รันอัตโนมัติหลัง npm install (postinstall) — ไฟล์ใน public/wasm ต้องตรงกับเวอร์ชันใน node_modules
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/wasm", { recursive: true });
copyFileSync("node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", "public/wasm/zxing_reader.wasm");
console.log("copied zxing_reader.wasm -> public/wasm/");
