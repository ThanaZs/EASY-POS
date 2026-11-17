import "server-only";
import type { Repositories } from "@/core/ports/repositories";
import type { FileStorage } from "@/core/ports/storage";
import { env } from "./env";

// จุดเดียวที่เลือกว่าจะใช้ DB/adapter ตัวไหน
// อนาคต: เพิ่ม case "mysql" / "firestore" / "http-api" ได้โดยไม่แตะ UI หรือ core
export async function getRepositories(): Promise<Repositories> {
  switch (env.DB_DRIVER) {
    case "postgres": {
      const { createPostgresRepositories } = await import("@/adapters/db/postgres/repositories");
      return createPostgresRepositories();
    }
  }
}

/** ที่เก็บไฟล์ (รูปสินค้า) — null = ยังไม่ได้ตั้งค่า (ฟีเจอร์รูปจะถูกซ่อน) */
export async function getStorage(): Promise<FileStorage | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return null;
  const { createSupabaseStorage } = await import("@/adapters/storage/supabase");
  return createSupabaseStorage({ url: env.SUPABASE_URL, key: env.SUPABASE_SECRET_KEY, bucket: env.STORAGE_BUCKET });
}
