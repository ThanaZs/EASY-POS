import Link from "next/link";
import { addDays, formatDateTime, formatMoney, todayIn } from "@/core/lib/format";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../BackLink";

// ภาพรวม: ตัดรอบวันตามทามโซนของร้าน (business_date)
export default async function OverviewPage({ params }: PageProps<"/[locale]/store/[storeId]/overview">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store } = await requireStoreAccess(locale, storeId, "reports.view");
  const today = todayIn(store.timeZone);
  const monthStart = `${today.slice(0, 8)}01`;
  const weekStart = addDays(today, -6);
  const from = monthStart < weekStart ? monthStart : weekStart;

  const repos = await getRepositories();
  const [daily, recent, low] = await Promise.all([
    repos.sales.dailyTotals(storeId, from, today),
    repos.sales.list(storeId, { limit: 10 }),
    repos.products.list(storeId, { lowStockOnly: true }),
  ]);
  const byDay = new Map(daily.map((d) => [d.businessDate, d]));
  const todayRow = byDay.get(today);
  const month = daily.filter((d) => d.businessDate >= monthStart);
  const monthTotal = month.reduce((s, d) => s + d.totalMinor, 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    return { day, total: byDay.get(day)?.totalMinor ?? 0 };
  });
  const maxWeek = Math.max(1, ...week.map((w) => w.total));
  const money = (m: number) => formatMoney(m, store.currency, locale);
  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

  return (
    <div className="space-y-5">
      <BackLink href={`/${locale}/store/${storeId}`} label={t.store.back} />
      <h1 className="text-xl font-bold">{t.store.modules.overview}</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label={t.overview.today} value={money(todayRow?.totalMinor ?? 0)} sub={`${todayRow?.count ?? 0} ${t.overview.bills}`} highlight />
        <Kpi label={`${t.overview.profit} · ${t.overview.today}`} value={money((todayRow?.totalMinor ?? 0) - (todayRow?.costMinor ?? 0))} />
        <Kpi label={t.overview.month} value={money(monthTotal)} sub={`${month.reduce((s, d) => s + d.count, 0)} ${t.overview.bills}`} />
      </div>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 font-semibold">{t.overview.last7}</h2>
        <div className="flex h-40 items-end gap-2">
          {week.map((w) => (
            <div key={w.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div
                className={`w-full rounded-t-md ${w.day === today ? "bg-brand" : "bg-brand-soft"}`}
                style={{ height: `${Math.max(2, (w.total / maxWeek) * 100)}%` }}
                title={money(w.total)}
              />
              <span className="text-xs text-muted">{dayLabel(w.day)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{t.overview.recent}</h2>
            <Link href={`/${locale}/store/${storeId}/sales`} className="text-sm font-medium text-brand">
              {t.sales.viewAll}
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-card p-6 text-center text-muted">{t.overview.noSales}</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/${locale}/store/${storeId}/sales/${s.id}`}
                    className={`flex items-center justify-between gap-3 p-3 row-hover ${s.status !== "completed" ? "opacity-50" : ""}`}
                  >
                    <div>
                      <p className="font-mono text-sm">{s.receiptNo}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(s.createdAt, locale, store.timeZone)} · {t.pos.methods[s.paymentMethod]}
                        {s.status !== "completed" ? ` · ${t.sales.voided}` : ""}
                      </p>
                    </div>
                    <span className={`font-semibold tabular-nums ${s.status !== "completed" ? "line-through" : ""}`}>
                      {money(s.totalMinor)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold">{t.overview.lowStock}</h2>
          {low.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-card p-6 text-center text-muted">{t.overview.none}</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {low.slice(0, 20).map((p) => (
                <li key={p.id}>
                  <Link href={`/${locale}/store/${storeId}/inventory/${p.id}`} className="flex justify-between gap-3 p-3 row-hover">
                    <span className="truncate">{p.name}</span>
                    <span className={`font-semibold tabular-nums ${p.stockQty <= 0 ? "text-rose-600" : "text-amber-600"}`}>
                      {p.stockQty} {p.unit}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-brand bg-brand text-white" : "border-line bg-card"}`}>
      <p className={`text-sm ${highlight ? "text-white/80" : "text-muted"}`}>{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className={`text-sm ${highlight ? "text-white/80" : "text-muted"}`}>{sub}</p>}
    </div>
  );
}
