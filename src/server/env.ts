import "server-only";
import { z } from "zod";

// ทุกค่าที่ขึ้นกับผู้ให้บริการอยู่ใน env — ย้ายคลาวด์ = เปลี่ยน env ไม่ต้องแก้โค้ด
const schema = z.object({
  DATABASE_URL: z.string().optional(),
  DB_DRIVER: z.enum(["postgres"]).default("postgres"),
  AUTH_PROVIDER: z.enum(["none", "better-auth", "supabase"]).default("none"),
  AUTH_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APP_URL: z.string().default("http://localhost:3000"),
});

export const env = schema.parse(process.env);
