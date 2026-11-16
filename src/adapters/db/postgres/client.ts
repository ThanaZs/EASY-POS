import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

// prepare:false = ใช้ได้กับ connection pooler (Supabase pgbouncer / Neon pooler) บน serverless
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

export function getDb() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set — see .env.example");
  globalForDb.pg ??= postgres(env.DATABASE_URL, {
    prepare: false,
    max: env.DATABASE_POOL_MAX,
    // DEBUG_SQL=1 ใน .env.local → พิมพ์ทุก query ลง console (ไว้นับ/หาจุดช้า)
    debug: process.env.DEBUG_SQL === "1" ? (_c, q) => console.info(`[sql] ${q.replace(/\s+/g, " ").slice(0, 140)}`) : undefined,
  });
  return drizzle(globalForDb.pg, { schema });
}
