import "server-only";
import { and, asc, desc, eq, isNull, lt, ne, sql } from "drizzle-orm";
import type {
  Store,
  StoreInvite,
  StoreMember,
  User,
} from "@/core/domain/types";
import { inviteState } from "@/core/domain/invite";
import { normalizeCode, randomCode } from "@/core/lib/code";
import type {
  AuditEntry,
  AuditRepo,
  CatalogItem,
  CatalogRepo,
  Repositories,
  StoreRepo,
  UserRepo,
} from "@/core/ports/repositories";
import { getDb } from "./client";
import { productRepo, saleRepo, stockRepo } from "./inventory";
import {
  accounts,
  auditLogs,
  catalogItems,
  storeInvites,
  storeMembers,
  stores,
  users,
} from "./schema";

// ===== แปลงแถว DB → domain =====
type UserRow = typeof users.$inferSelect;
type StoreRow = typeof stores.$inferSelect;
type MemberRow = typeof storeMembers.$inferSelect;
type InviteRow = typeof storeInvites.$inferSelect;

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  displayName: r.displayName,
  locale: r.locale,
  timeZone: r.timeZone,
  createdAt: r.createdAt,
});

const toStore = (r: StoreRow): Store => ({
  id: r.id,
  name: r.name,
  code: r.code,
  ownerId: r.ownerId,
  currency: r.currency,
  timeZone: r.timeZone,
  locale: r.locale,
  taxRateBp: r.taxRateBp,
  taxIncluded: r.taxIncluded,
  lowStockThreshold: r.lowStockThreshold,
  receiptFooter: r.receiptFooter,
  allowNegativeStock: r.allowNegativeStock,
  createdAt: r.createdAt,
});

const toMember = (r: MemberRow): StoreMember => ({
  id: r.id,
  storeId: r.storeId,
  userId: r.userId,
  role: r.role,
  permissions: (r.permissions ?? {}) as StoreMember["permissions"],
  status: r.status,
  joinedAt: r.joinedAt,
});

const toInvite = (r: InviteRow): StoreInvite => ({
  id: r.id,
  storeId: r.storeId,
  code: r.code,
  role: r.role,
  maxUses: r.maxUses,
  usedCount: r.usedCount,
  expiresAt: r.expiresAt,
  createdBy: r.createdBy,
  createdAt: r.createdAt,
});

/** unique violation ของ Postgres */
function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const err = e as { code?: string; cause?: unknown };
  return err.code === "23505" || isUniqueViolation(err.cause);
}

/** ลองใหม่เมื่อรหัสสุ่มชนกัน (โอกาสน้อยมาก) */
async function withUniqueCode<T>(
  fn: (code: string) => Promise<T>,
  length = 6,
): Promise<T> {
  for (let i = 0; i < 5; i++) {
    try {
      return await fn(randomCode(length));
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new Error("Could not generate a unique code");
}

function userRepo(): UserRepo {
  const db = getDb();
  return {
    async findById(id) {
      const [r] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return r ? toUser(r) : null;
    },
    async findByEmail(email) {
      const [r] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);
      return r ? toUser(r) : null;
    },
    async updateProfile(id, patch) {
      const [r] = await db
        .update(users)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return toUser(r);
    },
    async hasPassword(id) {
      const rows = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(eq(accounts.userId, id), eq(accounts.providerId, "credential")),
        )
        .limit(1);
      return rows.length > 0;
    },
    async deleteAccount(id) {
      await db.transaction(async (tx) => {
        await tx.delete(stores).where(eq(stores.ownerId, id)); // cascade: สินค้า, บิล, สต็อก, สมาชิก, รหัสเชิญ
        await tx
          .update(storeInvites)
          .set({ createdBy: null })
          .where(eq(storeInvites.createdBy, id));
        await tx.delete(users).where(eq(users.id, id)); // cascade: sessions, accounts, store_members
      });
    },
  };
}

function storeRepo(): StoreRepo {
  const db = getDb();
  return {
    createWithOwner(input) {
      return withUniqueCode((code) =>
        db.transaction(async (tx) => {
          const [store] = await tx
            .insert(stores)
            .values({ ...input, code })
            .returning();
          await tx.insert(storeMembers).values({
            storeId: store.id,
            userId: input.ownerId,
            role: "owner",
          });
          return toStore(store);
        }),
      );
    },
    async findById(id) {
      const [r] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, id))
        .limit(1);
      return r ? toStore(r) : null;
    },
    async findByCode(code) {
      const [r] = await db
        .select()
        .from(stores)
        .where(eq(stores.code, normalizeCode(code)))
        .limit(1);
      return r ? toStore(r) : null;
    },
    async listForUser(userId) {
      const rows = await db
        .select({ store: stores, member: storeMembers })
        .from(storeMembers)
        .innerJoin(stores, eq(stores.id, storeMembers.storeId))
        .where(eq(storeMembers.userId, userId))
        .orderBy(asc(stores.name));
      return rows.map((r) => ({
        store: toStore(r.store),
        member: toMember(r.member),
      }));
    },
    async getMember(storeId, userId) {
      const [r] = await db
        .select()
        .from(storeMembers)
        .where(
          and(
            eq(storeMembers.storeId, storeId),
            eq(storeMembers.userId, userId),
          ),
        )
        .limit(1);
      return r ? toMember(r) : null;
    },
    async listMembers(storeId) {
      const rows = await db
        .select({
          member: storeMembers,
          user: {
            id: users.id,
            email: users.email,
            displayName: users.displayName,
          },
        })
        .from(storeMembers)
        .innerJoin(users, eq(users.id, storeMembers.userId))
        .where(eq(storeMembers.storeId, storeId))
        .orderBy(asc(storeMembers.joinedAt));
      return rows.map((r) => ({ member: toMember(r.member), user: r.user }));
    },
    async removeMember(storeId, userId) {
      // ลบเจ้าของร้านไม่ได้
      await db
        .delete(storeMembers)
        .where(
          and(
            eq(storeMembers.storeId, storeId),
            eq(storeMembers.userId, userId),
            ne(storeMembers.role, "owner"),
          ),
        );
    },
    async deleteStore(storeId, ownerId) {
      const rows = await db
        .delete(stores)
        .where(and(eq(stores.id, storeId), eq(stores.ownerId, ownerId)))
        .returning({ id: stores.id });
      return rows.length > 0;
    },
    async updateSettings(storeId, patch) {
      const [r] = await db
        .update(stores)
        .set(patch)
        .where(eq(stores.id, storeId))
        .returning();
      return toStore(r);
    },
    createInvite(input) {
      return withUniqueCode(async (code) => {
        const [r] = await db
          .insert(storeInvites)
          .values({ ...input, code })
          .returning();
        return toInvite(r);
      }, 8);
    },
    async listInvites(storeId) {
      const rows = await db
        .select()
        .from(storeInvites)
        .where(eq(storeInvites.storeId, storeId))
        .orderBy(desc(storeInvites.createdAt));
      return rows.map(toInvite);
    },
    async deleteUnusedInvite(storeId, inviteId) {
      const rows = await db
        .delete(storeInvites)
        .where(
          and(
            eq(storeInvites.storeId, storeId),
            eq(storeInvites.id, inviteId),
            eq(storeInvites.usedCount, 0),
          ),
        )
        .returning({ id: storeInvites.id });
      return rows.length > 0;
    },
    async redeemInvite(rawCode, userId) {
      const code = normalizeCode(rawCode);
      return db.transaction(async (tx) => {
        // FOR UPDATE: กันสองคนใช้รหัสสุดท้ายพร้อมกัน
        const [inv] = await tx
          .select()
          .from(storeInvites)
          .where(eq(storeInvites.code, code))
          .for("update")
          .limit(1);
        if (!inv) return { ok: false, reason: "not_found" } as const;
        const state = inviteState(inv);
        if (state !== "active") return { ok: false, reason: state } as const;

        const inserted = await tx
          .insert(storeMembers)
          .values({
            storeId: inv.storeId,
            userId,
            role: inv.role,
            permissions: inv.permissions,
          })
          .onConflictDoNothing()
          .returning({ id: storeMembers.id });
        if (inserted.length === 0)
          return { ok: false, reason: "already_member" } as const;

        await tx
          .update(storeInvites)
          .set({ usedCount: sql`${storeInvites.usedCount} + 1` })
          .where(eq(storeInvites.id, inv.id));
        return { ok: true, storeId: inv.storeId } as const;
      });
    },
  };
}

function auditRepo(): AuditRepo {
  const db = getDb();
  return {
    async log(e) {
      await db.insert(auditLogs).values({
        storeId: e.storeId,
        actorId: e.actorId,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        details: {
          actorName: e.actorName,
          entityName: e.entityName,
          changes: e.changes,
          note: e.note,
        },
      });
    },
    async list(storeId, q = {}) {
      const conds = [eq(auditLogs.storeId, storeId)];
      if (q.entityId) conds.push(eq(auditLogs.entityId, q.entityId));
      if (q.before) conds.push(lt(auditLogs.createdAt, q.before));
      const rows = await db
        .select()
        .from(auditLogs)
        .where(and(...conds))
        .orderBy(desc(auditLogs.createdAt))
        .limit(Math.min(q.limit ?? 100, 500));
      return rows.map((r) => {
        const d = (r.details ?? {}) as {
          actorName?: string;
          entityName?: string;
          changes?: AuditEntry["changes"];
          note?: string;
        };
        return {
          id: r.id,
          at: r.createdAt,
          actorId: r.actorId,
          actorName: d.actorName ?? "",
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          entityName: d.entityName ?? "",
          changes: d.changes ?? null,
          note: d.note ?? "",
        };
      });
    },
  };
}

function catalogRepo(): CatalogRepo {
  const db = getDb();
  const toItem = (r: typeof catalogItems.$inferSelect): CatalogItem => ({
    barcode: r.barcode,
    name: r.name,
    brand: r.brand,
    category: r.category,
    subcategory: r.subcategory,
    unit: r.unit,
    imagePath: r.imagePath,
    imageUrl: r.imageUrl,
    source: r.source as CatalogItem["source"],
  });
  return {
    async get(barcode) {
      const [r] = await db
        .select()
        .from(catalogItems)
        .where(eq(catalogItems.barcode, barcode))
        .limit(1);
      return r ? toItem(r) : null;
    },
    async contribute(items) {
      const rows = items
        .filter((i) => i.barcode && i.name)
        .map((i) => ({ ...i, source: "store" }));
      if (!rows.length) return;
      for (let k = 0; k < rows.length; k += 500) {
        await db
          .insert(catalogItems)
          .values(rows.slice(k, k + 500))
          .onConflictDoUpdate({
            target: catalogItems.barcode,
            set: {
              name: sql`excluded.name`,
              category: sql`excluded.category`,
              subcategory: sql`excluded.subcategory`,
              unit: sql`excluded.unit`,
              source: sql`'store'`,
              updatedAt: sql`now()`,
            },
            setWhere: sql`${catalogItems.source} <> 'store'`, // ข้อมูลจากร้านอื่นที่มีอยู่แล้ว → ไม่ทับ
          });
      }
    },
    async saveExternal(item) {
      await db.insert(catalogItems).values(item).onConflictDoNothing();
    },
    async setImageIfMissing(barcode, imagePath) {
      const rows = await db
        .update(catalogItems)
        .set({ imagePath, updatedAt: sql`now()` })
        .where(
          and(
            eq(catalogItems.barcode, barcode),
            isNull(catalogItems.imagePath),
          ),
        )
        .returning({ b: catalogItems.barcode });
      return rows.length > 0;
    },
  };
}

export function createPostgresRepositories(): Repositories {
  return {
    audit: auditRepo(),
    catalog: catalogRepo(),
    users: userRepo(),
    stores: storeRepo(),
    products: productRepo(),
    stock: stockRepo(),
    sales: saleRepo(),
  };
}
