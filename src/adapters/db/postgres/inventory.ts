import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { calcSaleTotals } from "@/core/domain/sale";
import { packPrice, type Product, type Sale, type SaleHeader, type SaleItem, type StockMovement } from "@/core/domain/types";
import { businessDate } from "@/core/lib/format";
import type { DailySales, ProductRepo, SaleRepo, StockRepo } from "@/core/ports/repositories";
import { getDb } from "./client";
import { products, saleItems, sales, stockMovements } from "./schema";

type ProductRow = typeof products.$inferSelect;
type MovementRow = typeof stockMovements.$inferSelect;
type SaleRow = typeof sales.$inferSelect;

const toProduct = (r: ProductRow): Product => ({ ...r });
const toMovement = (r: MovementRow): StockMovement => ({
  id: r.id,
  storeId: r.storeId,
  productId: r.productId,
  productName: r.productName,
  type: r.type,
  qty: r.qty,
  qtyBefore: r.qtyBefore,
  qtyAfter: r.qtyAfter,
  note: r.note,
  refSaleId: r.refSaleId,
  actorId: r.actorId,
  createdAt: r.createdAt,
});
const toSaleHeader = (r: SaleRow): SaleHeader => ({
  id: r.id,
  storeId: r.storeId,
  receiptNo: r.receiptNo,
  subtotalMinor: r.subtotalMinor,
  discountMinor: r.discountMinor,
  taxMinor: r.taxMinor,
  totalMinor: r.totalMinor,
  paidMinor: r.paidMinor,
  changeMinor: r.changeMinor,
  paymentMethod: r.paymentMethod,
  status: r.status,
  cashierId: r.cashierId,
  customerId: r.customerId,
  businessDate: r.businessDate,
  voidedAt: r.voidedAt,
  voidReason: r.voidReason,
  createdAt: r.createdAt,
});

function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const err = e as { code?: string; cause?: unknown };
  return err.code === "23505" || isUniqueViolation(err.cause);
}

/** แปลง error ซ้ำของบาร์โค้ดเป็นรหัสที่หน้าเว็บเข้าใจ */
async function mapDuplicate<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isUniqueViolation(e)) throw new Error("DUPLICATE_BARCODE");
    throw e;
  }
}

export function productRepo(): ProductRepo {
  const db = getDb();
  return {
    async list(storeId, q = {}) {
      const conds = [eq(products.storeId, storeId), eq(products.isActive, true)];
      const search = q.search?.trim();
      if (search) {
        const like = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
        conds.push(
          or(ilike(products.name, like), ilike(products.sku, like), eq(products.barcode, search), eq(products.packBarcode, search))!,
        );
      }
      if (q.category) conds.push(eq(products.category, q.category));
      if (q.lowStockOnly) {
        conds.push(eq(products.trackStock, true), lte(products.stockQty, products.lowStockThreshold));
      }
      const rows = await db.select().from(products).where(and(...conds)).orderBy(asc(products.name)).limit(1000);
      return rows.map(toProduct);
    },
    async findById(storeId, id) {
      const [r] = await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.id, id)))
        .limit(1);
      return r ? toProduct(r) : null;
    },
    async categories(storeId) {
      const rows = await db
        .selectDistinct({ c: products.category })
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.isActive, true), isNotNull(products.category)))
        .orderBy(asc(products.category));
      return rows.map((r) => r.c!).filter(Boolean);
    },
    async categoryTree(storeId) {
      const rows = await db
        .selectDistinct({ c: products.category, s: products.subcategory })
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.isActive, true), isNotNull(products.category)))
        .orderBy(asc(products.category), asc(products.subcategory));
      const tree = new Map<string, string[]>();
      for (const r of rows) {
        if (!r.c) continue;
        const subs = tree.get(r.c) ?? [];
        if (r.s && !subs.includes(r.s)) subs.push(r.s);
        tree.set(r.c, subs);
      }
      return [...tree].map(([category, subcategories]) => ({ category, subcategories }));
    },
    importRows(storeId, rows, actorId, opts) {
      return db.transaction(async (tx) => {
        const result = { created: 0, updated: 0, skipped: 0 };
        const barcodes = rows.map((r) => r.barcode).filter((b): b is string => Boolean(b));
        const existing = barcodes.length
          ? await tx
              .select()
              .from(products)
              .where(and(eq(products.storeId, storeId), inArray(products.barcode, barcodes)))
              .for("update")
          : [];
        const byBarcode = new Map(existing.map((p) => [p.barcode!, p]));
        const seen = new Set<string>();
        for (const r of rows) {
          if (!r.name.trim()) {
            result.skipped++;
            continue;
          }
          if (r.barcode) {
            if (seen.has(r.barcode)) {
              result.skipped++; // บาร์โค้ดซ้ำในไฟล์เดียวกัน — ใช้แถวแรก
              continue;
            }
            seen.add(r.barcode);
          }
          const old = r.barcode ? byBarcode.get(r.barcode) : undefined;
          const now = new Date();
          if (old) {
            // สินค้าที่มีอยู่แล้ว: แตะสต็อกเฉพาะเมื่อผู้ใช้เลือก "อัปเดตจำนวนคงเหลือ"
            const qtyAfter = opts.updateStock && r.stockQty !== null ? r.stockQty : old.stockQty;
            await tx
              .update(products)
              .set({
                name: r.name,
                priceMinor: r.priceMinor,
                costMinor: r.costMinor,
                category: r.category,
                subcategory: r.subcategory,
                stockQty: qtyAfter,
                isActive: true,
                updatedAt: now,
              })
              .where(eq(products.id, old.id));
            if (qtyAfter !== old.stockQty) {
              await tx.insert(stockMovements).values({
                storeId,
                productId: old.id,
                productName: r.name,
                type: "adjust",
                qty: qtyAfter - old.stockQty,
                qtyBefore: old.stockQty,
                qtyAfter,
                note: "import",
                actorId,
              });
            }
            result.updated++;
          } else {
            const qty = r.stockQty ?? 0;
            const [p] = await tx
              .insert(products)
              .values({
                storeId,
                barcode: r.barcode,
                name: r.name,
                priceMinor: r.priceMinor,
                costMinor: r.costMinor,
                category: r.category,
                subcategory: r.subcategory,
                unit: "ชิ้น",
                stockQty: qty,
              })
              .returning({ id: products.id });
            if (qty !== 0) {
              await tx.insert(stockMovements).values({
                storeId,
                productId: p.id,
                productName: r.name,
                type: "in",
                qty,
                qtyBefore: 0,
                qtyAfter: qty,
                note: "import",
                actorId,
              });
            }
            result.created++;
          }
        }
        return result;
      });
    },
    create(storeId, input, initialQty, actorId) {
      return mapDuplicate(() =>
        db.transaction(async (tx) => {
          const [p] = await tx
            .insert(products)
            .values({ ...input, storeId, stockQty: initialQty })
            .returning();
          if (initialQty !== 0) {
            await tx.insert(stockMovements).values({
              storeId,
              productId: p.id,
              productName: p.name,
              type: "in",
              qty: initialQty,
              qtyBefore: 0,
              qtyAfter: initialQty,
              note: "initial",
              actorId,
            });
          }
          return toProduct(p);
        }),
      );
    },
    update(storeId, id, patch) {
      return mapDuplicate(async () => {
        const [r] = await db
          .update(products)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(products.storeId, storeId), eq(products.id, id)))
          .returning();
        return r ? toProduct(r) : null;
      });
    },
    async deactivate(storeId, id) {
      const [old] = await db
        .select({ imagePath: products.imagePath })
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.id, id)));
      // เอาบาร์โค้ดออกด้วย เพื่อให้นำบาร์โค้ดไปใช้กับสินค้าใหม่ได้; ลบรูปเพื่อประหยัดพื้นที่
      await db
        .update(products)
        .set({ isActive: false, barcode: null, imagePath: null, updatedAt: new Date() })
        .where(and(eq(products.storeId, storeId), eq(products.id, id)));
      return old?.imagePath ?? null;
    },
    async setImage(storeId, id, path) {
      const [old] = await db
        .select({ imagePath: products.imagePath })
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.id, id)));
      if (!old) return null;
      await db
        .update(products)
        .set({ imagePath: path, updatedAt: new Date() })
        .where(and(eq(products.storeId, storeId), eq(products.id, id)));
      return old.imagePath;
    },
  };
}

export function stockRepo(): StockRepo {
  const db = getDb();
  return {
    move(input) {
      return db.transaction(async (tx) => {
        const [p] = await tx
          .select()
          .from(products)
          .where(and(eq(products.storeId, input.storeId), eq(products.id, input.productId)))
          .for("update")
          .limit(1);
        if (!p) return null;
        const qtyAfter = p.stockQty + input.qty;
        await tx
          .update(products)
          .set({ stockQty: qtyAfter, updatedAt: new Date() })
          .where(eq(products.id, p.id));
        const [m] = await tx
          .insert(stockMovements)
          .values({
            storeId: input.storeId,
            productId: p.id,
            productName: p.name,
            type: input.type,
            qty: input.qty,
            qtyBefore: p.stockQty,
            qtyAfter,
            note: input.note,
            actorId: input.actorId,
          })
          .returning();
        return toMovement(m);
      });
    },
    async history(storeId, q = {}) {
      const conds = [eq(stockMovements.storeId, storeId)];
      if (q.productId) conds.push(eq(stockMovements.productId, q.productId));
      const rows = await db
        .select()
        .from(stockMovements)
        .where(and(...conds))
        .orderBy(desc(stockMovements.createdAt))
        .limit(q.limit ?? 200);
      return rows.map(toMovement);
    },
  };
}

export function saleRepo(): SaleRepo {
  const db = getDb();
  return {
    create(input) {
      // รวมบรรทัดสินค้าเดียวกัน (แยกขายปลีก/ยกลัง) + ตัดจำนวนที่ไม่ถูกต้อง
      const qtyByLine = new Map<string, { productId: string; unit: "base" | "pack"; qty: number }>();
      for (const l of input.lines) {
        const qty = Math.floor(l.qty);
        if (!(qty > 0)) continue;
        const unit = l.unit === "pack" ? "pack" : "base";
        const key = `${l.productId}:${unit}`;
        const cur = qtyByLine.get(key);
        qtyByLine.set(key, { productId: l.productId, unit, qty: (cur?.qty ?? 0) + qty });
      }
      if (qtyByLine.size === 0) return Promise.resolve({ ok: false, reason: "empty" } as const);
      const ids = [...new Set([...qtyByLine.values()].map((l) => l.productId))];

      return db.transaction(async (tx) => {
        // ล็อกต่อร้าน: เลขใบเสร็จไม่ชนกันเมื่อขายพร้อมกันหลายเครื่อง
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.storeId}))`);

        const rows = await tx
          .select()
          .from(products)
          .where(and(eq(products.storeId, input.storeId), inArray(products.id, ids), eq(products.isActive, true)))
          .for("update");
        if (rows.length !== ids.length) return { ok: false, reason: "product_not_found" } as const;

        const byId = new Map(rows.map((p) => [p.id, p]));
        const items: SaleItem[] = [];
        const baseById = new Map<string, number>(); // จำนวนชิ้นที่ต้องตัดสต็อกต่อสินค้า
        for (const l of qtyByLine.values()) {
          const p = byId.get(l.productId)!;
          if (l.unit === "pack") {
            if (!p.packUnit || !p.packSize || p.packSize < 1) return { ok: false, reason: "product_not_found" } as const;
            const baseQty = l.qty * p.packSize;
            items.push({
              productId: p.id,
              name: `${p.name} (${p.packUnit} ×${p.packSize})`,
              qty: l.qty,
              unitPriceMinor: packPrice(p),
              costMinor: p.costMinor * p.packSize,
              discountMinor: 0,
              baseQty,
            });
            baseById.set(p.id, (baseById.get(p.id) ?? 0) + baseQty);
          } else {
            items.push({
              productId: p.id,
              name: p.name,
              qty: l.qty,
              unitPriceMinor: p.priceMinor,
              costMinor: p.costMinor,
              discountMinor: 0,
              baseQty: l.qty,
            });
            baseById.set(p.id, (baseById.get(p.id) ?? 0) + l.qty);
          }
        }
        for (const p of rows) {
          if (p.trackStock && !input.allowNegativeStock && p.stockQty < baseById.get(p.id)!) {
            return { ok: false, reason: "insufficient_stock", productName: p.name } as const;
          }
        }

        const totals = calcSaleTotals(items, {
          billDiscountMinor: Math.max(0, Math.floor(input.billDiscountMinor)),
          taxRateBp: input.taxRateBp,
          taxIncluded: input.taxIncluded,
        });
        const paidMinor = input.paidMinor ?? totals.totalMinor;
        if (paidMinor < totals.totalMinor) return { ok: false, reason: "insufficient_payment" } as const;

        const now = new Date();
        const day = businessDate(now, input.timeZone);
        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(sales)
          .where(and(eq(sales.storeId, input.storeId), eq(sales.businessDate, day)));
        const receiptNo = `${day.replaceAll("-", "").slice(2)}-${String(n + 1).padStart(4, "0")}`;

        const [sale] = await tx
          .insert(sales)
          .values({
            storeId: input.storeId,
            receiptNo,
            ...totals,
            paidMinor,
            changeMinor: paidMinor - totals.totalMinor,
            paymentMethod: input.paymentMethod,
            cashierId: input.cashierId,
            businessDate: day,
            createdAt: now,
          })
          .returning();
        await tx.insert(saleItems).values(items.map((i) => ({ ...i, saleId: sale.id })));

        for (const p of rows) {
          if (!p.trackStock) continue;
          const qty = baseById.get(p.id)!;
          await tx
            .update(products)
            .set({ stockQty: p.stockQty - qty, updatedAt: now })
            .where(eq(products.id, p.id));
          await tx.insert(stockMovements).values({
            storeId: input.storeId,
            productId: p.id,
            productName: p.name,
            type: "sale",
            qty: -qty,
            qtyBefore: p.stockQty,
            qtyAfter: p.stockQty - qty,
            note: receiptNo,
            refSaleId: sale.id,
            actorId: input.cashierId,
          });
        }
        return { ok: true, sale: { ...toSaleHeader(sale), items } } as const;
      });
    },
    async get(storeId, id) {
      const [s] = await db
        .select()
        .from(sales)
        .where(and(eq(sales.storeId, storeId), eq(sales.id, id)))
        .limit(1);
      if (!s) return null;
      const items = await db.select().from(saleItems).where(eq(saleItems.saleId, id)).orderBy(asc(saleItems.name));
      const sale: Sale = {
        ...toSaleHeader(s),
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          qty: i.qty,
          unitPriceMinor: i.unitPriceMinor,
          costMinor: i.costMinor,
          discountMinor: i.discountMinor,
          baseQty: i.baseQty ?? i.qty,
        })),
      };
      return sale;
    },
    async list(storeId, q = {}) {
      const conds = [eq(sales.storeId, storeId)];
      if (q.businessDate) conds.push(eq(sales.businessDate, q.businessDate));
      const rows = await db
        .select()
        .from(sales)
        .where(and(...conds))
        .orderBy(desc(sales.createdAt))
        .limit(q.limit ?? 50);
      return rows.map(toSaleHeader);
    },
    void(storeId, id, actorId, reason) {
      return db.transaction(async (tx) => {
        const [s] = await tx
          .select()
          .from(sales)
          .where(and(eq(sales.storeId, storeId), eq(sales.id, id)))
          .for("update")
          .limit(1);
        if (!s) return { ok: false, reason: "not_found" } as const;
        if (s.status !== "completed") return { ok: false, reason: "already_voided" } as const;
        const now = new Date();
        await tx
          .update(sales)
          .set({ status: "voided", voidedAt: now, voidedBy: actorId, voidReason: reason || null })
          .where(eq(sales.id, id));

        // คืนสต็อก (รวมจำนวนต่อสินค้า) เฉพาะสินค้าที่ยังมีอยู่และนับสต็อก
        const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, id));
        const qtyById = new Map<string, number>();
        for (const i of items) if (i.productId) qtyById.set(i.productId, (qtyById.get(i.productId) ?? 0) + (i.baseQty ?? i.qty));
        if (qtyById.size === 0) return { ok: true } as const;
        const prods = await tx
          .select()
          .from(products)
          .where(and(eq(products.storeId, storeId), inArray(products.id, [...qtyById.keys()])))
          .for("update");
        for (const p of prods) {
          if (!p.trackStock) continue;
          const qty = qtyById.get(p.id)!;
          await tx
            .update(products)
            .set({ stockQty: p.stockQty + qty, updatedAt: now })
            .where(eq(products.id, p.id));
          await tx.insert(stockMovements).values({
            storeId,
            productId: p.id,
            productName: p.name,
            type: "refund",
            qty,
            qtyBefore: p.stockQty,
            qtyAfter: p.stockQty + qty,
            note: s.receiptNo,
            refSaleId: s.id,
            actorId,
          });
        }
        return { ok: true } as const;
      });
    },
    async dailyTotals(storeId, from, to) {
      const rows = await db.execute<{ d: string; c: number; t: string; k: string }>(sql`
        select s.business_date as d,
               count(*)::int as c,
               coalesce(sum(s.total_minor), 0)::text as t,
               coalesce(sum((select sum(i.qty * i.cost_minor) from sale_items i where i.sale_id = s.id)), 0)::text as k
        from sales s
        where s.store_id = ${storeId} and s.status = 'completed'
          and s.business_date between ${from} and ${to}
        group by s.business_date
        order by s.business_date`);
      return rows.map(
        (r): DailySales => ({ businessDate: r.d, count: r.c, totalMinor: Number(r.t), costMinor: Number(r.k) }),
      );
    },
  };
}
