import type { Product } from "@/core/domain/types";
import { compareText } from "@/core/lib/compare";

/** ตัวเลือกเรียงรายการสินค้า (?sort=) — "" = ค่าเริ่มต้น: ปักหมุดก่อน แล้วตามชื่อ */
export const SORTS = ["", "new", "priceDesc", "priceAsc", "stockAsc", "stockDesc", "bought"] as const;
export type Sort = (typeof SORTS)[number];
export const parseSort = (v: unknown, allowBought = false): Sort =>
  typeof v === "string" && (SORTS as readonly string[]).includes(v) && (allowBought || v !== "bought") ? (v as Sort) : "";

export const compareName = compareText; // ชื่อแบบธรรมชาติ (ตัวเลขเรียงตามค่า) — core/lib/compare

/** เรียงในหน่วยความจำ (รายการของร้านเดียว ไม่กี่พันชิ้น) — bought = วันที่ซื้อล่าสุด (ไม่เคยซื้อไว้ท้าย) */
export function sortProducts(items: Product[], sort: Sort, lastBought?: (id: string) => number | undefined): Product[] {
  const byName = (a: Product, b: Product) => compareName(a.name, b.name);
  const bought = (p: Product) => lastBought?.(p.id) ?? Number.NEGATIVE_INFINITY;
  const cmp: Record<Sort, (a: Product, b: Product) => number> = {
    "": (a, b) => Number(b.pinned) - Number(a.pinned), // ค่าเริ่มต้น: ปักหมุดขึ้นก่อน
    new: (a, b) => +b.createdAt - +a.createdAt,
    priceDesc: (a, b) => b.priceMinor - a.priceMinor,
    priceAsc: (a, b) => a.priceMinor - b.priceMinor,
    stockAsc: (a, b) => a.stockQty - b.stockQty,
    stockDesc: (a, b) => b.stockQty - a.stockQty,
    bought: (a, b) => {
      const x = bought(a);
      const y = bought(b);
      return x === y ? 0 : y > x ? 1 : -1; // ล่าสุดก่อน; ไม่เคยซื้อไว้ท้าย (ไม่ใช้ −∞ − −∞ = NaN)
    },
  };
  return [...items].sort((a, b) => cmp[sort](a, b) || byName(a, b));
}
