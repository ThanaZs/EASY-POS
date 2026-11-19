"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowUpDown, LoaderCircle } from "lucide-react";
import { rememberFilters } from "./InventoryFilters";

/** ปุ่มเรียงแบบตัวหนังสือสีเทา (มุมขวาบนของรายการ) — ใช้ <select> ของเครื่องซ้อนไว้ (มือถือได้ตัวเลือกแบบระบบ) */
export function SortMenu({
  value,
  options,
  label,
}: {
  value: string;
  options: Array<[string, string]>;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const current = options.find(([v]) => v === value)?.[1] ?? options[0][1];
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-sm text-muted transition hover:bg-card hover:text-ink">
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUpDown className="size-4" />}
      <span>
        {label}: {current}
      </span>
      <select
        value={value}
        aria-label={label}
        onChange={(e) => {
          const p = new URLSearchParams(window.location.search);
          p.delete("product");
          if (e.target.value) p.set("sort", e.target.value);
          else p.delete("sort");
          const qs = p.toString();
          rememberFilters(pathname, qs);
          start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
