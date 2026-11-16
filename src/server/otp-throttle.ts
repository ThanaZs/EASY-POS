import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/adapters/db/postgres/client";
import { verifications } from "@/adapters/db/postgres/schema";

/** ส่ง OTP ซ้ำได้หลังกี่วินาที (กันกดรัว / ยิงอีเมลใส่คนอื่น) — ใช้ DB จึงได้ผลบน serverless หลายเครื่อง */
export const OTP_COOLDOWN_SECONDS = 60;

/** true = เพิ่งส่ง OTP ประเภทนี้ให้อีเมลนี้ไป ยังไม่ครบเวลา cooldown */
export async function otpRecentlySent(type: "email-verification" | "forget-password", email: string): Promise<boolean> {
  const since = new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000);
  const rows = await getDb()
    .select({ id: verifications.id })
    .from(verifications)
    .where(and(eq(verifications.identifier, `${type}-otp-${email.toLowerCase()}`), gt(verifications.updatedAt, since)))
    .limit(1);
  return rows.length > 0;
}
