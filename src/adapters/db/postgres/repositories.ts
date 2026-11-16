import "server-only";
import type { Repositories } from "@/core/ports/repositories";

// TODO(phase 1): implement ทีละ repo ด้วย getDb() + schema.ts
// ดู docs/ROADMAP.md หัวข้อ Phase 1
const notYet = (name: string) =>
  new Proxy({}, {
    get: (_t, method) => () => {
      throw new Error(`${name}.${String(method)} not implemented yet (see docs/ROADMAP.md)`);
    },
  });

export function createPostgresRepositories(): Repositories {
  return {
    users: notYet("users") as Repositories["users"],
    stores: notYet("stores") as Repositories["stores"],
    products: notYet("products") as Repositories["products"],
    stock: notYet("stock") as Repositories["stock"],
    sales: notYet("sales") as Repositories["sales"],
  };
}
