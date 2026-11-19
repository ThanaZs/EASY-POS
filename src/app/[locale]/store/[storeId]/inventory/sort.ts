import type { Product } from "@/core/domain/types";

/** ตัวเลือกเรียงรายการสินค้า (?sort=) — "" = ค่าเริ่มต้น: ปักหมุดก่อน แล้วตามชื่อ */
export const SORTS = ["", "new", "priceDesc", "priceAsc", "stockAsc", "stockDesc", "bought"] as const;
export type Sort = (typeof SORTS)[number];
export const parseSort = (v: unknown, allowBought = false): Sort =>
  typeof v === "string" && (SORTS as readonly string[]).includes(v) && (allowBought || v !== "bought") ? (v as Sort) : "";

/** เรียงในหน่วยความจำ (รายการของร้านเดียว ไม่กี่พันชิ้น) — bought = วันที่ซื้อล่าสุด (ไม่เคยซื้อไว้ท้าย) */
export function sortProducts(items: Product[], sort: Sort, lastBought?: (id: string) => number | undefined): Product[] {
  if (!sort) return items;
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, "th");
  const cmp: Record<Exclude<Sort, "">, (a: Product, b: Product) => number> = {
    new: (a, b) => +b.createdAt - +a.createdAt,
    priceDesc: (a, b) => b.priceMinor - a.priceMinor,
    priceAsc: (a, b) => a.priceMinor - b.priceMinor,
    stockAsc: (a, b) => a.stockQty - b.stockQty,
    stockDesc: (a, b) => b.stockQty - a.stockQty,
    bought: (a, b) => (lastBought?.(b.id) ?? -Infinity) - (lastBought?.(a.id) ?? -Infinity),
  };
  return [...items].sort((a, b) => cmp[sort](a, b) || byName(a, b));
}
