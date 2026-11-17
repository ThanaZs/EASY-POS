import type { StockMovement } from "@/core/domain/types";
import { formatDateTime } from "@/core/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";

/** รายการความเคลื่อนไหวสต็อก (ใช้ในหน้า ประวัติสต็อก และ รับเข้าสินค้า) */
export function MovementList({
  items,
  t,
  locale,
  timeZone,
}: {
  items: StockMovement[];
  t: Dictionary;
  locale: Locale;
  timeZone: string;
}) {
  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">{t.stock.empty}</p>;
  }
  return (
    <ul className="scroll-box divide-y divide-line rounded-2xl border border-line bg-card">
      {items.map((m) => (
        <li key={m.id} className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{m.productName}</p>
            <p className="truncate text-xs text-muted">
              {formatDateTime(m.createdAt, locale, timeZone)} · {t.stock.types[m.type]}
              {m.note && m.note !== "initial" ? ` · ${m.note}` : ""}
            </p>
          </div>
          <div className="text-right tabular-nums">
            <p className={`font-semibold ${m.qty >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {m.qty > 0 ? `+${m.qty}` : m.qty}
            </p>
            <p className="text-xs text-muted">
              {m.qtyBefore} → {m.qtyAfter}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
