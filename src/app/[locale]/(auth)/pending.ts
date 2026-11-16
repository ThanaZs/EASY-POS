import "server-only";
import { cookies } from "next/headers";

/** cookie เก็บอีเมลที่กำลังยืนยัน OTP / รีเซ็ตรหัสผ่าน (httpOnly, 30 นาที) */
export const PENDING_EMAIL_COOKIE = "ep_auth_email";

export async function readPendingEmail(): Promise<string> {
  return (await cookies()).get(PENDING_EMAIL_COOKIE)?.value ?? "";
}
