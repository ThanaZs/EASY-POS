import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { ReceiptText } from "lucide-react";
import { SubTabs } from "@/components/SubTabs";
import {
  addDays,
  fill,
  formatDateTime,
  formatMoney,
  todayIn,
} from "@/core/lib/format";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";

const RANGES = ["today", "week", "month", "year", "all"] as const;
type Range = (typeof RANGES)[number];
type Bar = { key: string; label: string; total: number; current: boolean };

// ยอดขาย: เลือกช่วงเวลา (?range=) → สรุปยอด/กำไร/จำนวนบิล + กราฟตามช่วง
// ตัดรอบวันตามทามโซนของร้าน (business_date)
export default async function OverviewPage({
  params,
  searchParams,
}: PageProps<"/[locale]/store/[storeId]/overview">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store } = await requireStoreAccess(locale, storeId, "reports.view");
  const sp = await searchParams;
  const range: Range = RANGES.includes(sp.range as Range)
    ? (sp.range as Range)
    : "today";
  const o = t.overview;

  const today = todayIn(store.timeZone);
  const from = {
    today,
    week: addDays(today, -6),
    month: `${today.slice(0, 8)}01`,
    year: `${today.slice(0, 5)}01-01`,
    all: "2000-01-01",
  }[range];

  const repos = await getRepositories();
  const [daily, recent, low, todayBills] = await Promise.all([
    repos.sales.dailyTotals(storeId, from, today),
    repos.sales.list(storeId, { limit: 30 }),
    repos.products.list(storeId, { lowStockOnly: true }),
    range === "today"
      ? repos.sales.list(storeId, { businessDate: today, limit: 2000 })
      : Promise.resolve([]),
  ]);

  const total = daily.reduce((s, d) => s + d.totalMinor, 0);
  const cost = daily.reduce((s, d) => s + d.costMinor, 0);
  const count = daily.reduce((s, d) => s + d.count, 0);
  const money = (m: number) => formatMoney(m, store.currency, locale);
  const fmt = (opts: Intl.DateTimeFormatOptions, day: string) =>
    new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(
      new Date(`${day}T00:00:00Z`),
    );

  // ---- กราฟ ----
  let bars: Bar[] = [];
  let chartTitle = o.byDay;
  if (range === "today") {
    chartTitle = o.byHour;
    const hourOf = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: store.timeZone,
    });
    const byHour = new Array(24).fill(0);
    for (const b of todayBills)
      if (b.status === "completed")
        byHour[Number(hourOf.format(b.createdAt))] += b.totalMinor;
    const nowHour = Number(hourOf.format(new Date()));
    bars = byHour.map((v, h) => ({
      key: String(h),
      label: h % 3 === 0 ? `${h}` : "",
      total: v,
      current: h === nowHour,
    }));
  } else if (range === "week" || range === "month") {
    const byDay = new Map(daily.map((d) => [d.businessDate, d.totalMinor]));
    const days: string[] = [];
    for (let d = from; d <= today; d = addDays(d, 1)) days.push(d);
    bars = days.map((d, i) => ({
      key: d,
      label:
        range === "week"
          ? fmt({ weekday: "short" }, d)
          : i % 5 === 0 || d === today
            ? String(Number(d.slice(8)))
            : "",
      total: byDay.get(d) ?? 0,
      current: d === today,
    }));
  } else {
    // ปีนี้ / ทั้งหมด: รายเดือน (ทั้งหมด ถ้าเกิน 24 เดือน → รายปี)
    const byMonth = new Map<string, number>();
    for (const d of daily)
      byMonth.set(
        d.businessDate.slice(0, 7),
        (byMonth.get(d.businessDate.slice(0, 7)) ?? 0) + d.totalMinor,
      );
    const firstMonth =
      range === "year"
        ? from.slice(0, 7)
        : (daily[0]?.businessDate.slice(0, 7) ?? today.slice(0, 7));
    const months: string[] = [];
    for (let m = firstMonth; m <= today.slice(0, 7);) {
      months.push(m);
      const [y, mo] = m.split("-").map(Number);
      m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
    }
    if (range === "year")
      while (months.length < 12) {
        const [y, mo] = months[months.length - 1].split("-").map(Number);
        months.push(
          mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`,
        );
      }
    if (months.length > 24) {
      chartTitle = o.byYear;
      const byYear = new Map<string, number>();
      for (const [m, v] of byMonth)
        byYear.set(m.slice(0, 4), (byYear.get(m.slice(0, 4)) ?? 0) + v);
      const years = [...new Set(months.map((m) => m.slice(0, 4)))];
      bars = years.map((y) => ({
        key: y,
        label: fmt({ year: "numeric" }, `${y}-01-01`),
        total: byYear.get(y) ?? 0,
        current: y === today.slice(0, 4),
      }));
    } else {
      chartTitle = o.byMonth;
      bars = months.map((m) => ({
        key: m,
        label: fmt({ month: "short" }, `${m}-01`),
        total: byMonth.get(m) ?? 0,
        current: m === today.slice(0, 7),
      }));
    }
  }
  const maxBar = Math.max(1, ...bars.map((b) => b.total));
  const base = `/${locale}/store/${storeId}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <PageTitle title={t.store.modules.overview} />
        <Link
          prefetch={false}
          href={`${base}/sales`}
          className="inline-flex items-center gap-1 rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium hover:border-brand"
        >
          <ReceiptText className="size-4" /> {t.store.tabs.bills}
        </Link>
      </div>

      <SubTabs
        tabs={RANGES.map((r) => ({
          href: `${base}/overview?range=${r}`,
          label: o.ranges[r],
          active: r === range,
        }))}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label={o.sales}
          value={money(total)}
          sub={fill(t.sales.count, { n: count })}
          highlight
        />
        <Kpi
          label={o.profit}
          value={money(total - cost)}
          sub={
            total ? `${Math.round(((total - cost) / total) * 100)}%` : undefined
          }
        />
        <Kpi
          label={o.avg}
          value={money(count ? Math.round(total / count) : 0)}
        />
      </div>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 font-semibold">{chartTitle}</h2>
        <div className="flex h-44 items-end gap-1 sm:gap-1.5">
          {bars.map((b) => (
            <div
              key={b.key}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <div
                className={`w-full rounded-t-md ${b.current ? "bg-brand" : "bg-brand-soft"} ${b.total ? "" : "opacity-60"}`}
                style={{ height: `${Math.max(2, (b.total / maxBar) * 100)}%` }}
                title={money(b.total)}
              />
              <span className="h-4 truncate text-[10px] text-muted sm:text-xs">
                {b.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{o.recent}</h2>
            <Link
              prefetch={false}
              href={`${base}/sales`}
              className="text-sm font-medium text-brand-ink"
            >
              {t.sales.viewAll}
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-card p-6 text-center text-muted">
              {o.noSales}
            </p>
          ) : (
            <ul className="scroll-box divide-y divide-line rounded-2xl border border-line bg-card">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link
                    prefetch={false}
                    href={`${base}/sales/${s.id}`}
                    className={`flex items-center justify-between gap-3 p-3 row-hover ${s.status !== "completed" ? "opacity-50" : ""}`}
                  >
                    <div>
                      <p className="font-mono text-sm">{s.receiptNo}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(s.createdAt, locale, store.timeZone)} ·{" "}
                        {t.pos.methods[s.paymentMethod]}
                        {s.status !== "completed" ? ` · ${t.sales.voided}` : ""}
                      </p>
                    </div>
                    <span
                      className={`font-semibold tabular-nums ${s.status !== "completed" ? "line-through" : ""}`}
                    >
                      {money(s.totalMinor)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold">
            {o.lowStock}{" "}
            {low.length > 0 && (
              <span className="text-sm font-normal text-muted">
                ({low.length})
              </span>
            )}
          </h2>
          {low.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-card p-6 text-center text-muted">
              {o.none}
            </p>
          ) : (
            <ul className="scroll-box divide-y divide-line rounded-2xl border border-line bg-card">
              {low.map((p) => (
                <li key={p.id}>
                  <Link
                    prefetch={false}
                    href={`${base}/inventory/${p.id}`}
                    className="flex justify-between gap-3 p-3 row-hover"
                  >
                    <span className="truncate">{p.name}</span>
                    <span
                      className={`font-semibold tabular-nums ${p.stockQty <= 0 ? "text-rose-600" : "text-amber-600"}`}
                    >
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

function Kpi({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${highlight ? "border-brand bg-brand text-white" : "border-line bg-card"}`}
    >
      <p className={`text-sm ${highlight ? "text-white/80" : "text-muted"}`}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && (
        <p className={`text-sm ${highlight ? "text-white/80" : "text-muted"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}
