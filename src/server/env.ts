import "server-only";
import { z } from "zod";

// ทุกค่าที่ขึ้นกับผู้ให้บริการอยู่ใน env — ย้ายคลาวด์ = เปลี่ยน env ไม่ต้องแก้โค้ด
const schema = z.object({
  DATABASE_URL: z.string().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  DB_DRIVER: z.enum(["postgres"]).default("postgres"),
  AUTH_PROVIDER: z.enum(["better-auth"]).default("better-auth"), // อนาคต: "supabase" | "clerk" ...
  AUTH_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // อีเมล (OTP) — Gmail: SMTP_USER=อีเมล gmail, SMTP_PASS=App Password 16 ตัว
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM_NAME: z.string().default("EASY-POS (no-reply)"),
  APP_URL: z.string().optional(),
  // Vercel ใส่ให้อัตโนมัติ (ไม่มี https://)
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_DEPLOYMENT_ID: z.string().optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
});

export const env = schema.parse(process.env);

const https = (host?: string) => (host ? `https://${host}` : undefined);

/** URL หลักของแอป: APP_URL > โดเมน production ของ Vercel > localhost */
export const appUrl = env.APP_URL || https(env.VERCEL_PROJECT_PRODUCTION_URL) || "http://localhost:3000";

/** origin ที่อนุญาตให้ส่งฟอร์ม/ล็อกอิน (รวม URL preview ของ Vercel แต่ละ deploy) */
export const trustedOrigins = [appUrl, https(env.VERCEL_URL)].filter((u): u is string => Boolean(u));


/** รหัสเวอร์ชันที่ deploy อยู่ (เปลี่ยนทุกครั้งที่ deploy) — dev = "dev" */
export const buildId = env.VERCEL_DEPLOYMENT_ID || env.VERCEL_GIT_COMMIT_SHA || "dev";
