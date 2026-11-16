import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/adapters/db/postgres/client";
import * as schema from "@/adapters/db/postgres/schema";
import { defaultLocale, defaultTimeZone } from "@/i18n/config";
import { env } from "./env";

// Better Auth — เก็บ user/session ใน Postgres ตัวเดียวกับข้อมูลร้าน
// เปลี่ยนผู้ให้บริการ auth: แก้ไฟล์นี้ + src/server/session.ts เท่านั้น (หน้าเว็บเรียกผ่าน session.ts)
function createAuth() {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined;

  return betterAuth({
    baseURL: env.APP_URL,
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
    session: { modelName: "sessions" },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    advanced: { database: { generateId: "uuid" } }, // ให้ Postgres สร้าง uuid เอง
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    socialProviders: google,
    plugins: [nextCookies()], // ให้ server action ตั้ง cookie session ได้
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { auth?: Auth };

/** สร้างตอนเรียกใช้ครั้งแรก (ไม่ต่อ DB ตอน build) */
export function getAuth(): Auth {
  return (globalForAuth.auth ??= createAuth());
}

export const googleEnabled = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
