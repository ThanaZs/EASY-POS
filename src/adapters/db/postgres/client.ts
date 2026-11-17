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
    // ห้ามส่งหลายคำสั่งซ้อนใน connection เดียว (pipelining): ผ่าน pooler แบบ transaction (Supavisor) แล้วค้างถาวร
    // (เคยทำหน้ายอดขายค้าง — query 4 ตัวพร้อมกันบน pool 2 ช่อง) → คำสั่งที่เกินจำนวน connection รอคิวฝั่งแอปแทน
    max_pipeline: 1,
    // serverless + pooler: ปิด connection ที่ว่างก่อนฝั่ง pooler/เครือข่ายตัดทิ้งเงียบๆ (ไม่งั้น query แรกหลังว่างนานอาจค้าง/error)
    idle_timeout: 20,
    max_lifetime: 60 * 10,
    connect_timeout: 10,
    // DEBUG_SQL=1 ใน .env.local → พิมพ์ทุก query ลง console (ไว้นับ/หาจุดช้า)
    debug: process.env.DEBUG_SQL === "1" ? (_c, q) => console.info(`[sql] ${q.replace(/\s+/g, " ").slice(0, 140)}`) : undefined,
  });
  return drizzle(globalForDb.pg, { schema });
}
