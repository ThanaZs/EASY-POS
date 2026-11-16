import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

// prepare:false = ใช้ได้กับ connection pooler (Supabase pgbouncer / Neon pooler) บน serverless
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

export function getDb() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set — see .env.example");
  globalForDb.pg ??= postgres(env.DATABASE_URL, { prepare: false, max: 5 });
  return drizzle(globalForDb.pg, { schema });
}
