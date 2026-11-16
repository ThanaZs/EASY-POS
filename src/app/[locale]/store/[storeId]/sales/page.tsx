import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { fill, formatDateTime, formatMoney, todayIn } from "@/core/lib/format";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../BackLink";

// ประวัติบิลรายวัน (ตาม business_date ของร้าน)
export default async function SalesPage({ params, searchParams }: PageProps<"/[locale]/store/[storeId]/sales">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store } = await requireStoreAccess(locale, storeId, "reports.view");
  const d = (await searchParams).date;
  const day = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayIn(store.timeZone);
  const bills = await (await getRepositories()).sales.list(storeId, { businessDate: day, limit: 500 });
  const done = bills.filter((b) => b.status === "completed");
  const money = (m: number) => formatMoney(m, store.currency, locale);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink href={`/${locale}/store/${storeId}`} label={t.store.back} />
      <h1 className="text-xl font-bold">{t.store.modules.sales}</h1>
      <form className="flex items-end gap-2">
        <label className="space-y-1">
          <span className="block text-sm text-muted">{t.sales.date}</span>
          <input type="date" name="date" defaultValue={day} className="rounded-xl border border-line bg-card px-3 py-2" />
        </label>
        <button className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-surface">OK</button>
      </form>
      <div className="flex items-baseline justify-between rounded-2xl border border-line bg-card p-4">
        <span className="text-muted">
          {t.sales.total} · {fill(t.sales.count, { n: done.length })}
        </span>
        <span className="text-xl font-bold tabular-nums">{money(done.reduce((s, b) => s + b.totalMinor, 0))}</span>
      </div>
      {bills.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">{t.sales.empty}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {bills.map((b) => (
            <li key={b.id}>
              <Link
                href={`/${locale}/store/${storeId}/sales/${b.id}`}
                className={`flex items-center gap-3 p-3 hover:bg-surface ${b.status !== "completed" ? "opacity-60" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm">
                    {b.receiptNo}
                    {b.status !== "completed" && (
                      <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 font-sans text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        {t.sales.voided}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(b.createdAt, locale, store.timeZone)} · {t.pos.methods[b.paymentMethod]}
                  </p>
                </div>
                <span className={`font-semibold tabular-nums ${b.status !== "completed" ? "line-through" : ""}`}>
                  {money(b.totalMinor)}
                </span>
                <ChevronRight className="size-4 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
