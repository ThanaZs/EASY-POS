import Link from "next/link";
import { CalendarDays, Store, Tag, Truck } from "lucide-react";
import type { StockMovement } from "@/core/domain/types";
import { formatDateTime, formatMoney } from "@/core/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";

const TYPE_STYLE: Record<StockMovement["type"], string> = {
  in: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  sale: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  out: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  refund:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  adjust: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
};

/**
 * รายการความเคลื่อนไหวสินค้า (หน้า ประวัติสินค้า และ รับเข้าสินค้า)
 * รับเข้าที่มีข้อมูลการซื้อ → แสดง ราคาซื้อ/หน่วย · ซื้อจาก · ลอต · วันที่ซื้อ
 * linkBase → ชื่อสินค้ากดไปดูประวัติของสินค้านั้น
 */
export function MovementList({
  items,
  t,
  locale,
  timeZone,
  currency,
  linkBase,
  showProduct = true,
}: {
  items: StockMovement[];
  t: Dictionary;
  locale: Locale;
  timeZone: string;
  currency?: string;
  linkBase?: string;
  showProduct?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">
        {t.stock.empty}
      </p>
    );
  }
  const money = (m: number) =>
    currency ? formatMoney(m, currency, locale) : String(m / 100);
  const day = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(`${d}T00:00:00Z`));
  return (
    <ul className="scroll-box divide-y divide-line rounded-2xl border border-line bg-card">
      {items.map((m) => {
        const hasPurchase =
          m.type === "in" && (m.unitCostMinor != null || m.supplier || m.lotNo);
        return (
          <li key={m.id} className="flex items-start gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${TYPE_STYLE[m.type]}`}
                >
                  {t.stock.types[m.type]}
                </span>
                {m.purchasedOn && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
                    <CalendarDays className="size-3.5 text-muted" />
                    {day(m.purchasedOn)}
                  </span>
                )}
                {showProduct &&
                  (linkBase && m.productId ? (
                    <Link
                      prefetch={false}
                      href={`${linkBase}?product=${m.productId}`}
                      className="truncate font-medium hover:text-brand-ink hover:underline"
                    >
                      {m.productName}
                    </Link>
                  ) : (
                    <span className="truncate font-medium">
                      {m.productName}
                    </span>
                  ))}
              </div>
              {hasPurchase && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  {m.unitCostMinor != null && (
                    <span className="inline-flex items-center gap-1 font-semibold text-ink">
                      <Tag className="size-3" /> {money(m.unitCostMinor)}/
                      {t.stock.perPiece}
                    </span>
                  )}
                  {m.supplier && (
                    <span className="inline-flex items-center gap-1">
                      <Store className="size-3" /> {m.supplier}
                    </span>
                  )}
                  {m.lotNo && (
                    <span className="inline-flex items-center gap-1">
                      <Truck className="size-3" /> {t.stock.lotNo} {m.lotNo}
                    </span>
                  )}
                </p>
              )}
              <p className="truncate text-xs text-muted">
                {formatDateTime(m.createdAt, locale, timeZone)}
                {m.note && m.note !== "initial" ? ` · ${m.note}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <p
                className={`font-semibold ${m.qty >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                {m.qty > 0 ? `+${m.qty}` : m.qty}
              </p>
              <p className="text-xs text-muted">
                {m.qtyBefore} → {m.qtyAfter}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
