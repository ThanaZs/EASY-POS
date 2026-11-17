import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { getDb } from "@/adapters/db/postgres/client";
import * as schema from "@/adapters/db/postgres/schema";
import { defaultLocale, defaultTimeZone } from "@/i18n/config";
import { appUrl, env, trustedOrigins } from "./env";
import { sendOtpMail } from "./mail";

/** สมัครด้วยอีเมล+รหัสผ่านได้เฉพาะ Gmail (Google ยืนยันตัวตนเจ้าของอีเมลแล้ว) */
export const isGmail = (email: string) => /^[a-z0-9._%+-]+@(gmail|googlemail)\.com$/i.test(email.trim());

// Better Auth — เก็บ user/session ใน Postgres ตัวเดียวกับข้อมูลร้าน
// เปลี่ยนผู้ให้บริการ auth: แก้ไฟล์นี้ + src/server/session.ts เท่านั้น (หน้าเว็บเรียกผ่าน session.ts)
function createAuth() {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined;

  return betterAuth({
    baseURL: appUrl,
    trustedOrigins,
    secret: env.AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    user: {
      modelName: "users",
      fields: { name: "displayName" },
      additionalFields: {
        locale: { type: "string", required: false, defaultValue: defaultLocale, input: true },
        timeZone: { type: "string", required: false, defaultValue: defaultTimeZone, input: true },
      },
    },
    session: {
      modelName: "sessions",
      // แบบ Facebook/แอปทั่วไป: ใช้อยู่เรื่อยๆ = ล็อกอินค้างไปเรื่อยๆ, ไม่ได้เข้าใช้ 60 วัน = ต้องล็อกอินใหม่
      expiresIn: 60 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60, // เข้าใช้วันไหน ต่ออายุให้อีก 60 วัน (อัปเดตวันละครั้ง)
      // เก็บ session ใน cookie ที่เซ็นแล้ว 5 นาที → ไม่ต้อง query DB ทุกหน้า
      // (ผลข้างเคียง: ออกจากระบบที่เครื่องอื่น/แก้โปรไฟล์ อาจช้าสุด 5 นาที — แก้โปรไฟล์จะ refresh ให้ใน saveAccountAction)
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    verification: { modelName: "verifications" },
    advanced: {
      database: { generateId: "uuid" }, // ให้ Postgres สร้าง uuid เอง
      // ชื่อ cookie คงที่ → deploy ใหม่ไม่ต้องล็อกอินใหม่ (หน้าเว็บโหลดเวอร์ชันล่าสุดเองผ่าน deploymentId)
      cookiePrefix: "ep",
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: true, // ต้องยืนยัน OTP ก่อนถึงจะล็อกอินได้
      revokeSessionsOnPasswordReset: true, // ตั้งรหัสใหม่ → เครื่องอื่นหลุดหมด
    },
    emailVerification: { autoSignInAfterVerification: true },
    socialProviders: google,
    // ล็อกอิน Google ด้วยอีเมลเดียวกับบัญชีที่สมัครไว้ → รวมเป็นบัญชีเดียว (Google ยืนยันอีเมลแล้ว)
    account: { modelName: "accounts", accountLinking: { enabled: true, trustedProviders: ["google"] } },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email" && !isGmail(String(ctx.body?.email ?? ""))) {
          throw new APIError("BAD_REQUEST", { message: "Only @gmail.com addresses can sign up", code: "GMAIL_ONLY" });
        }
      }),
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        allowedAttempts: 5, // ใส่ผิดเกิน 5 ครั้ง → ต้องขอรหัสใหม่
        storeOTP: "hashed",
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        disableSignUp: true, // OTP ใช้สร้างบัญชีใหม่ไม่ได้ (สมัครผ่านฟอร์มที่เช็ก Gmail เท่านั้น)
        rateLimit: { window: 60, max: 3 },
        async sendVerificationOTP({ email, otp, type }) {
          await sendOtpMail(email, otp, type);
        },
      }),
      nextCookies(), // ให้ server action ตั้ง cookie session ได้ (ต้องอยู่ท้ายสุด)
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { auth?: Auth };

/** สร้างตอนเรียกใช้ครั้งแรก (ไม่ต่อ DB ตอน build) */
export function getAuth(): Auth {
  return (globalForAuth.auth ??= createAuth());
}

export const googleEnabled = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
