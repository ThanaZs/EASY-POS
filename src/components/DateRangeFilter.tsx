"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarDays, LoaderCircle } from "lucide-react";

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * เลือกช่วงวันที่ (?from=&to=) — เลือกแล้วกรองทันที ไม่ต้องกดปุ่ม
 * ปุ่มลัด: วันนี้ / เมื่อวาน / 7 วัน / เดือนนี้ / ทั้งหมด (ถ้า allowAll)
 * คงพารามิเตอร์อื่นใน URL ไว้ (เช่น ?actor=)
 */
export function DateRangeFilter({
  from,
  to,
  today,
  allowAll = false,
  labels,
}: {
  from: string;
  to: string;
  today: string; // YYYY-MM-DD ตามทามโซนร้าน
  allowAll?: boolean;
  labels: {
    from: string;
    to: string;
    today: string;
    yesterday: string;
    last7: string;
    thisMonth: string;
    all: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [f, setF] = useState(from);
  const [tt, setT] = useState(to);

  function go(nf: string, nt: string) {
    // วันเริ่มเลยวันสิ้นสุด → สลับให้
    if (nf && nt && nf > nt) [nf, nt] = [nt, nf];
    setF(nf);
    setT(nt);
    const p = new URLSearchParams(window.location.search);
    for (const k of ["from", "to", "date"]) p.delete(k);
    if (nf) p.set("from", nf);
    if (nt) p.set("to", nt);
    const qs = p.toString();
    start(() =>
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
    );
  }

  const presets: Array<[string, string, string]> = [
    [labels.today, today, today],
    [labels.yesterday, addDays(today, -1), addDays(today, -1)],
    [labels.last7, addDays(today, -6), today],
    [labels.thisMonth, `${today.slice(0, 8)}01`, today],
  ];
  const isAll = allowAll && !f && !tt;
  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm transition active:scale-95 ${
        active
          ? "border-brand bg-brand text-white"
          : "border-line bg-card hover:border-brand"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-card p-3">
      <div className="flex flex-wrap items-end gap-2">
        <CalendarDays className="mb-2 size-4 text-muted" />
        <label className="text-xs text-muted">
          {labels.from}
          <input
            type="date"
            value={f}
            max={today}
            onChange={(e) => go(e.target.value, tt || e.target.value)}
            className="mt-0.5 block rounded-xl border border-line bg-card px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="text-xs text-muted">
          {labels.to}
          <input
            type="date"
            value={tt}
            max={today}
            onChange={(e) => go(f || e.target.value, e.target.value)}
            className="mt-0.5 block rounded-xl border border-line bg-card px-2 py-1.5 text-sm text-ink"
          />
        </label>
        {pending && (
          <LoaderCircle className="mb-2 size-4 animate-spin text-muted" />
        )}
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {presets.map(([label, pf, pt]) =>
          chip(label, f === pf && tt === pt, () => go(pf, pt)),
        )}
        {allowAll && chip(labels.all, isAll, () => go("", ""))}
      </div>
    </div>
  );
}
