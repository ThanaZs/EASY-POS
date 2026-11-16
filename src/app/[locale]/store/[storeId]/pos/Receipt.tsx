import type { PaymentMethod } from "@/core/domain/types";
import { formatDateTime, formatMoney } from "@/core/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";

export type ReceiptData = {
  id: string;
  receiptNo: string;
  createdAt: string; // ISO
  items: Array<{ name: string; qty: number; unitPriceMinor: number }>;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  changeMinor: number;
  paymentMethod: PaymentMethod;
};

/** ใบเสร็จแบบกระดาษม้วน — ใช้ทั้งหลังขาย (client) และหน้ารายละเอียดบิล (server) */
export function Receipt({
  r,
  t,
  locale,
  currency,
  timeZone,
  storeName,
  cashierName,
  footer,
  voidedLabel,
}: {
  r: ReceiptData;
  t: Dictionary["pos"];
  locale: Locale;
  currency: string;
  timeZone: string;
  storeName: string;
  cashierName?: string | null;
  footer?: string;
  voidedLabel?: string | null;
}) {
  const money = (m: number) => formatMoney(m, currency, locale);
  return (
    <div className="relative font-mono text-sm text-neutral-900">
      {voidedLabel && (
        <p className="mb-2 rounded border-2 border-rose-600 py-1 text-center font-sans font-bold text-rose-600">{voidedLabel}</p>
      )}
      <h2 className="text-center text-base font-bold">{storeName}</h2>
      <p className="text-center text-xs">
        {t.receiptNo} {r.receiptNo}
        <br />
        {formatDateTime(r.createdAt, locale, timeZone)}
        {cashierName && (
          <>
            <br />
            {cashierName}
          </>
        )}
      </p>
      <hr className="my-2 border-dashed border-neutral-400" />
      {r.items.map((i, idx) => (
        <div key={idx}>
          <p>{i.name}</p>
          <p className="flex justify-between">
            <span>
              {i.qty} × {money(i.unitPriceMinor)}
            </span>
            <span>{money(i.qty * i.unitPriceMinor)}</span>
          </p>
        </div>
      ))}
      <hr className="my-2 border-dashed border-neutral-400" />
      <Line label={t.subtotal} value={money(r.subtotalMinor)} />
      {r.discountMinor > 0 && <Line label={t.discount} value={`-${money(r.discountMinor)}`} />}
      {r.taxMinor > 0 && <Line label={t.tax} value={money(r.taxMinor)} />}
      <p className="flex justify-between text-base font-bold">
        <span>{t.total}</span>
        <span>{money(r.totalMinor)}</span>
      </p>
      <Line label={t.methods[r.paymentMethod]} value={money(r.paidMinor)} />
      {r.changeMinor > 0 && <Line label={t.change} value={money(r.changeMinor)} />}
      {footer && <p className="mt-3 whitespace-pre-line text-center text-xs">{footer}</p>}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between">
      <span className="text-neutral-600 print:text-inherit">{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}
