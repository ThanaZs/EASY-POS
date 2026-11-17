"use server";

import { can } from "@/core/domain/permissions";
import type { CreateSaleResult, PaymentMethod, SaleLineInput } from "@/core/domain/types";
import { isLocale } from "@/i18n/config";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import type { ReceiptData } from "./Receipt";

const METHODS: PaymentMethod[] = ["cash", "qr", "card", "transfer", "other"];

export type CheckoutResult =
  | { ok: true; receipt: ReceiptData }
  | { ok: false; reason: Exclude<CreateSaleResult, { ok: true }>["reason"] | "failed"; productName?: string };

/** ปิดบิล — ราคา/ยอดคำนวณใหม่ฝั่ง server จากข้อมูลใน DB เสมอ */
export async function checkoutAction(input: {
  locale: string;
  storeId: string;
  lines: SaleLineInput[];
  discountMinor: number;
  method: PaymentMethod;
  paidMinor: number | null;
}): Promise<CheckoutResult> {
  const locale = isLocale(input.locale) ? input.locale : "th";
  const { store, user, member } = await requireStoreAccess(locale, input.storeId, "pos.sell");
  const method = METHODS.includes(input.method) ? input.method : "cash";
  const lines = (Array.isArray(input.lines) ? input.lines : [])
    .slice(0, 300)
    .map((l) => ({ productId: String(l.productId), qty: Number(l.qty), unit: l.unit === "pack" ? ("pack" as const) : ("base" as const) }))
    .filter((l) => Number.isFinite(l.qty));
  const discount = can(member, "pos.discount") ? Math.max(0, Math.floor(Number(input.discountMinor) || 0)) : 0;
  const paid = method === "cash" && input.paidMinor !== null ? Math.floor(Number(input.paidMinor) || 0) : null;

  try {
    const res = await (await getRepositories()).sales.create({
      storeId: store.id,
      lines,
      billDiscountMinor: discount,
      paymentMethod: method,
      paidMinor: paid,
      cashierId: user.id,
      timeZone: store.timeZone,
      taxRateBp: store.taxRateBp,
      taxIncluded: store.taxIncluded,
      allowNegativeStock: store.allowNegativeStock,
    });
    if (!res.ok) return res;
    const s = res.sale;
    return {
      ok: true,
      receipt: {
        id: s.id,
        receiptNo: s.receiptNo,
        createdAt: s.createdAt.toISOString(),
        items: s.items.map((i) => ({ name: i.name, qty: i.qty, unitPriceMinor: i.unitPriceMinor })),
        subtotalMinor: s.subtotalMinor,
        discountMinor: s.discountMinor,
        taxMinor: s.taxMinor,
        totalMinor: s.totalMinor,
        paidMinor: s.paidMinor,
        changeMinor: s.changeMinor,
        paymentMethod: s.paymentMethod,
      },
    };
  } catch (e) {
    console.error("checkout failed", e);
    return { ok: false, reason: "failed" };
  }
}
