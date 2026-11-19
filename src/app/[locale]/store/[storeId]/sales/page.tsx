import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { ChevronRight } from "lucide-react";
import { fill, formatDateTime, formatMoney, todayIn } from "@/core/lib/format";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { BackLink } from "../BackLink";

// ประวัติบิลรายวัน (ตาม business_date ของร้าน)
export default async function SalesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/store/[storeId]/sales">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store } = await requireStoreAccess(locale, storeId, "reports.view");
  const sp = await searchParams;
  const one = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : "";
  const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const today = todayIn(store.timeZone);
  // ค่าเริ่มต้น = วันนี้; ลิงก์เก่า ?date= ยังใช้ได้
  const legacy = isDay(one("date")) ? one("date") : "";
  const from = isDay(one("from")) ? one("from") : legacy || today;
  const to = isDay(one("to"))
    ? one("to")
    : legacy || (isDay(one("from")) ? one("from") : today);
  const bills = await (
    await getRepositories()
  ).sales.list(storeId, { fromDate: from, toDate: to, limit: 1000 });
  const done = bills.filter((b) => b.status === "completed");
  const money = (m: number) => formatMoney(m, store.currency, locale);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink mobileHidden
        href={`/${locale}/store/${storeId}/overview`}
        label={t.store.backSales}
      />
      <PageTitle title={t.store.tabs.bills} back={`/${locale}/store/${storeId}/overview`} />
      <DateRangeFilter from={from} to={to} today={today} labels={t.range} />
      <div className="flex items-baseline justify-between rounded-2xl border border-line bg-card p-4">
        <span className="text-muted">
          {from === today && to === today ? t.sales.total : t.sales.totalRange}{" "}
          · {fill(t.sales.count, { n: done.length })}
        </span>
        <span className="text-xl font-bold tabular-nums">
          {money(done.reduce((s, b) => s + b.totalMinor, 0))}
        </span>
      </div>
      {bills.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">
          {t.sales.empty}
        </p>
      ) : (
        <ul className="scroll-box divide-y divide-line rounded-2xl border border-line bg-card">
          {bills.map((b) => (
            <li key={b.id}>
              <Link
                prefetch={false}
                href={`/${locale}/store/${storeId}/sales/${b.id}`}
                className={`flex items-center gap-3 p-3 row-hover ${b.status !== "completed" ? "opacity-60" : ""}`}
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
                    {formatDateTime(b.createdAt, locale, store.timeZone)} ·{" "}
                    {t.pos.methods[b.paymentMethod]}
                  </p>
                </div>
                <span
                  className={`font-semibold tabular-nums ${b.status !== "completed" ? "line-through" : ""}`}
                >
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
