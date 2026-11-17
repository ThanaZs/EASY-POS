"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import type { CategoryNode } from "@/core/ports/repositories";

/** ค่า ?sub= สำหรับ "ไม่มีหมวดย่อย" (สินค้าที่มีแค่หมวดหลัก) */
export const NO_SUB = "-";

type Labels = {
  search: string;
  allCategories: string;
  lowOnly: string;
  allSub: string;
  noSub: string;
};

/**
 * ค้นหา/กรองคลังสินค้า: พิมพ์ (รอ 0.3 วิ), เลือกหมวด, ติ๊กใกล้หมด → อัปเดตผลทันที ไม่ต้องกดปุ่ม
 * เลือกหมวดหลักแล้ว → ปุ่มหมวดย่อยโผล่ใต้ช่องค้นหา (เฉพาะหมวดที่มีหมวดย่อย)
 * สินค้าที่มีแค่หมวดหลัก → อยู่ในปุ่ม "ไม่มีหมวดย่อย"
 */
export function InventoryFilters({
  q,
  cat,
  sub,
  low,
  tree,
  labels,
}: {
  q: string;
  cat: string;
  sub: string;
  low: boolean;
  tree: CategoryNode[];
  labels: Labels;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(q);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const state = useRef({ q, cat, sub, low });
  const [selCat, setSelCat] = useState(cat);
  const [selSub, setSelSub] = useState(sub);
  const node = tree.find((n) => n.category === selCat);
  const showSubs = !!node && node.subcategories.length > 0;

  function apply(
    next: Partial<{ q: string; cat: string; sub: string; low: boolean }>,
  ) {
    state.current = { ...state.current, ...next };
    const p = new URLSearchParams();
    if (state.current.q.trim()) p.set("q", state.current.q.trim());
    if (state.current.cat) p.set("cat", state.current.cat);
    if (state.current.cat && state.current.sub) p.set("sub", state.current.sub);
    if (state.current.low) p.set("low", "1");
    const qs = p.toString();
    startTransition(() =>
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
    );
  }

  // ยิงบาร์โค้ด (ScanToSearch) เปลี่ยน URL → ช่องค้นหาตามให้
  useEffect(() => {
    setText(q); // eslint-disable-line react-hooks/set-state-in-effect -- sync กับ URL
    state.current.q = q;
  }, [q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const chip = (value: string, label: string) => (
    <button
      key={value || "all"}
      type="button"
      onClick={() => {
        setSelSub(value);
        apply({ sub: value });
      }}
      aria-pressed={selSub === value}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm transition active:scale-95 ${
        selSub === value
          ? "border-brand bg-brand-soft font-semibold text-brand-ink"
          : "border-line bg-card hover:border-brand"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2" role="search">
      <div className="flex flex-wrap gap-2">
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
          value={selCat}
          onChange={(e) => {
            setSelCat(e.target.value);
            setSelSub(""); // เปลี่ยนหมวดหลัก → หมวดย่อยกลับเป็น "ทั้งหมด"
            apply({ cat: e.target.value, sub: "" });
          }}
          aria-label={labels.allCategories}
          className="rounded-xl border border-line bg-card px-3 py-2"
        >
          <option value="">{labels.allCategories}</option>
          {tree.map((n) => (
            <option key={n.category} value={n.category}>
              {n.category}
              {n.subcategories.length ? ` (${n.subcategories.length})` : ""}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm">
          <input
            type="checkbox"
            defaultChecked={low}
            onChange={(e) => apply({ low: e.target.checked })}
          />
          {labels.lowOnly}
        </label>
      </div>
      {showSubs && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {chip("", labels.allSub)}
          {node.subcategories.map((s) => chip(s, s))}
          {node.hasNoSub && chip(NO_SUB, labels.noSub)}
        </div>
      )}
    </div>
  );
}
