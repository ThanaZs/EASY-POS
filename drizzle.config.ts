import { defineConfig } from "drizzle-kit";

// ให้ `npm run db:migrate` อ่าน DATABASE_URL จาก .env.local เอง (Node 20.12+)
try {
  process.loadEnvFile(".env.local");
} catch {
  // ไม่มีไฟล์ = ใช้ env ของระบบ (เช่นบน CI)
}

export default defineConfig({
  schema: "./src/adapters/db/postgres/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
