import type { SaleItem } from "./types";

/** คำนวณยอดบิล — ทุกค่าเป็นจำนวนเต็มหน่วยย่อย (สตางค์) */
export function calcSaleTotals(
  items: SaleItem[],
  opts: { billDiscountMinor?: number; taxRateBp?: number; taxIncluded?: boolean } = {},
) {
  const { billDiscountMinor = 0, taxRateBp = 0, taxIncluded = true } = opts; // bp = basis point, 700 = 7%
  const subtotalMinor = items.reduce(
    (sum, i) => sum + i.qty * i.unitPriceMinor - i.discountMinor,
    0,
  );
  const afterDiscount = Math.max(0, subtotalMinor - billDiscountMinor);
  const taxMinor = taxIncluded
    ? Math.round((afterDiscount * taxRateBp) / (10000 + taxRateBp))
    : Math.round((afterDiscount * taxRateBp) / 10000);
  const totalMinor = taxIncluded ? afterDiscount : afterDiscount + taxMinor;
  return { subtotalMinor, discountMinor: billDiscountMinor, taxMinor, totalMinor };
}

export function calcChange(totalMinor: number, paidMinor: number) {
  if (paidMinor < totalMinor) throw new Error("INSUFFICIENT_PAYMENT");
  return paidMinor - totalMinor;
}
