"use client";

import { formatDateTime, formatMoney } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";
import type { ReceiptData } from "@/app/[locale]/store/[storeId]/pos/Receipt";
import type { SlipLine } from "./escpos";

/** ใบเสร็จ → บรรทัดสลิปสำหรับเครื่องพิมพ์ความร้อน (หน้าตาเดียวกับใบเสร็จบนจอ) */
export function receiptToSlip(o: {
  r: ReceiptData;
  t: Dictionary["pos"];
  locale: string;
  currency: string;
  timeZone: string;
  storeName: string;
  cashierName?: string | null;
  footer?: string;
  voidedLabel?: string | null;
}): SlipLine[] {
  const m = (v: number) => formatMoney(v, o.currency, o.locale);
  const lines: SlipLine[] = [];
  if (o.voidedLabel) lines.push({ kind: "text", text: `*** ${o.voidedLabel} ***`, align: "center", bold: true, size: 1.2 });
  lines.push(
    { kind: "text", text: o.storeName, align: "center", bold: true, size: 1.3 },
    { kind: "text", text: `${o.t.receiptNo} ${o.r.receiptNo}`, align: "center" },
    { kind: "text", text: formatDateTime(o.r.createdAt, o.locale, o.timeZone), align: "center" },
  );
  if (o.cashierName) lines.push({ kind: "text", text: o.cashierName, align: "center" });
  lines.push({ kind: "rule" });
  for (const i of o.r.items) {
    lines.push({ kind: "text", text: i.name });
    lines.push({ kind: "pair", left: `  ${i.qty} × ${m(i.unitPriceMinor)}`, right: m(i.qty * i.unitPriceMinor) });
  }
  lines.push({ kind: "rule" }, { kind: "pair", left: o.t.subtotal, right: m(o.r.subtotalMinor) });
  if (o.r.discountMinor > 0) lines.push({ kind: "pair", left: o.t.discount, right: `-${m(o.r.discountMinor)}` });
  if (o.r.taxMinor > 0) lines.push({ kind: "pair", left: o.t.tax, right: m(o.r.taxMinor) });
  lines.push(
    { kind: "pair", left: o.t.total, right: m(o.r.totalMinor), bold: true, size: 1.25 },
    { kind: "pair", left: o.t.methods[o.r.paymentMethod], right: m(o.r.paidMinor) },
  );
  if (o.r.changeMinor > 0) lines.push({ kind: "pair", left: o.t.change, right: m(o.r.changeMinor) });
  if (o.footer) {
    lines.push({ kind: "space" });
    for (const f of o.footer.split("\n")) lines.push({ kind: "text", text: f, align: "center" });
  }
  return lines;
}
