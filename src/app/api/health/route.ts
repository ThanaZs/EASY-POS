import { sql } from "drizzle-orm";
import { getDb } from "@/adapters/db/postgres/client";

// /api/health        → เช็กว่าเว็บทำงาน (ไม่แตะ DB)
// /api/health?db=1   → ping ฐานข้อมูลด้วย (วัดความเร็ว DB / ใช้กับตัว ping กันเครื่องเย็น + กัน Supabase pause)
export async function GET(req: Request) {
  const body: Record<string, unknown> = { ok: true, app: "easy-pos", time: new Date().toISOString() };
  if (new URL(req.url).searchParams.get("db") === "1") {
    const t0 = performance.now();
    try {
      await getDb().execute(sql`select 1`);
      body.dbMs = Math.round(performance.now() - t0);
    } catch {
      return Response.json({ ...body, ok: false, db: "error" }, { status: 503 });
    }
  }
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
