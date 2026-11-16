import "server-only";
import type { Repositories } from "@/core/ports/repositories";
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
