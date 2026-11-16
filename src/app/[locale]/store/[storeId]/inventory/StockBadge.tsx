import type { Product } from "@/core/domain/types";
import type { Dictionary } from "@/i18n/dictionary";

/** จำนวนคงเหลือ + สีเตือน (หมด = แดง, ใกล้หมด = ส้ม) */
export function StockBadge({ p, t }: { p: Product; t: Dictionary }) {
  if (!p.trackStock) return <span className="text-xs text-muted">{t.inventory.noTrack}</span>;
  const tone =
    p.stockQty <= 0
      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
      : p.stockQty <= p.lowStockThreshold
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-brand-soft text-brand";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>
      {p.stockQty} {p.unit}
      {p.stockQty <= 0 ? ` · ${t.inventory.out}` : p.stockQty <= p.lowStockThreshold ? ` · ${t.inventory.low}` : ""}
    </span>
  );
}
