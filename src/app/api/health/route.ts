import { sql } from "drizzle-orm";
import { getDb } from "@/adapters/db/postgres/client";

// /api/health        → เช็กว่าเว็บทำงาน (ไม่แตะ DB)
// /api/health?db=1   → ping ฐานข้อมูลด้วย (วัดความเร็ว DB / ใช้กับตัว ping กันเครื่องเย็น + กัน Supabase pause)
//                      + เคลียร์ connection ที่ค้าง (ตัว ping เรียกทุกไม่กี่นาที)
//
// ทำไมต้องเคลียร์: บน Vercel ถ้า request ถูกตัดกลางคัน (ผู้ใช้เปลี่ยนหน้า/รีเฟรช) ฟังก์ชันอาจถูกพักทั้งที่คำสั่ง SQL ยังส่งไม่ครบ
// → ฝั่ง Postgres ค้างสถานะ active + ClientRead (รอข้อมูลจาก client ที่ไม่มีวันมา) และยึด connection ของ pooler ไว้
// → request อื่นค้างตาม (เคยเห็นค้าง ~2 นาที, หน้าเว็บขึ้น React error #412 "Connection closed")
// คำสั่งปกติของแอปใช้ < 1 วินาที — ค้างสถานะนี้เกิน 30 วิ = ค้างแน่นอน ปิดทิ้งได้อย่างปลอดภัย
export async function GET(req: Request) {
  const body: Record<string, unknown> = { ok: true, app: "easy-pos", time: new Date().toISOString() };
  if (new URL(req.url).searchParams.get("db") === "1") {
    const t0 = performance.now();
    try {
      const db = getDb();
      await db.execute(sql`select 1`);
      body.dbMs = Math.round(performance.now() - t0);
      // กรองก่อน (MATERIALIZED) แล้วค่อยสั่งปิด — กันไม่ให้ไปเรียก pg_terminate_backend กับ connection ของ role อื่น (ไม่มีสิทธิ์)
      const killed = await db.execute<{ pid: number }>(sql`
        with stuck as materialized (
          select pid from pg_stat_activity
          where usename = current_user and pid <> pg_backend_pid()
            and (
              (state = 'active' and wait_event = 'ClientRead' and query_start < now() - interval '30 seconds')
              or (state like 'idle in transaction%' and state_change < now() - interval '60 seconds')
            )
        )
        select pid from stuck where pg_terminate_backend(pid)`);
      body.stuckCleared = killed.length;
      if (killed.length) console.warn(`[health] cleared ${killed.length} stuck DB connection(s)`);
    } catch (e) {
      console.error("[health] db check failed", e);
      return Response.json({ ...body, ok: false, db: "error" }, { status: 503 });
    }
  }
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
