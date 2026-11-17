"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, Search, X } from "lucide-react";

/** ค้นหา/กรองคลังสินค้า: พิมพ์ (รอ 0.3 วิ), เลือกหมวด, ติ๊กใกล้หมด → อัปเดตผลทันที ไม่ต้องกดปุ่ม */
export function InventoryFilters({
  q,
  cat,
  low,
  categories,
  labels,
}: {
  q: string;
  cat: string;
  low: boolean;
  categories: string[];
  labels: { search: string; allCategories: string; lowOnly: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(q);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const state = useRef({ q, cat, low });

  function apply(next: Partial<{ q: string; cat: string; low: boolean }>) {
    state.current = { ...state.current, ...next };
    const p = new URLSearchParams();
    if (state.current.q.trim()) p.set("q", state.current.q.trim());
    if (state.current.cat) p.set("cat", state.current.cat);
    if (state.current.low) p.set("low", "1");
    const qs = p.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // ยิงบาร์โค้ด (ScanToSearch) เปลี่ยน URL → ช่องค้นหาตามให้
  useEffect(() => {
    setText(q); // eslint-disable-line react-hooks/set-state-in-effect -- sync กับ URL
    state.current.q = q;
  }, [q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="flex flex-wrap gap-2" role="search">
      <label className="relative min-w-48 flex-1">
        {pending ? (
          <LoaderCircle className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />
        ) : (
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        )}
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            clearTimeout(timer.current);
            const v = e.target.value;
            timer.current = setTimeout(() => apply({ q: v }), 300);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              clearTimeout(timer.current);
              apply({ q: e.currentTarget.value });
            }
          }}
          placeholder={labels.search}
          aria-label={labels.search}
          className="w-full rounded-xl border border-line bg-card py-2 pl-9 pr-9 outline-none focus:border-brand"
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText("");
              clearTimeout(timer.current);
              apply({ q: "" });
            }}
            aria-label="clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-surface"
          >
            <X className="size-4" />
          </button>
        )}
      </label>
      <select
        defaultValue={cat}
        onChange={(e) => apply({ cat: e.target.value })}
        aria-label={labels.allCategories}
        className="rounded-xl border border-line bg-card px-3 py-2"
      >
        <option value="">{labels.allCategories}</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm">
        <input type="checkbox" defaultChecked={low} onChange={(e) => apply({ low: e.target.checked })} />
        {labels.lowOnly}
      </label>
    </div>
  );
}
