"use client";

import type { LucideIcon } from "lucide-react";

/** ปุ่มเล็กแสดงสถานะอุปกรณ์: จุดเขียว = เชื่อมแล้ว, เทา = ยังไม่เชื่อม, เหลืองกะพริบ = กำลังทำงาน, แดง = ผิดพลาด */
export function DeviceChip({
  Icon,
  label,
  status,
  tone,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  status: string;
  tone: "on" | "off" | "busy" | "error";
  onClick: () => void;
}) {
  const dot = {
    on: "bg-emerald-500",
    off: "bg-neutral-400",
    busy: "bg-amber-400 animate-pulse",
    error: "bg-rose-500",
  }[tone];
  const text = tone === "on" ? "text-emerald-700 dark:text-emerald-300" : tone === "error" ? "text-rose-600" : "text-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-sm hover:border-brand"
    >
      <Icon className="size-4 text-muted" />
      <span className="font-medium">{label}</span>
      <span className={`inline-flex items-center gap-1.5 ${text}`}>
        <span className={`size-2 rounded-full ${dot}`} aria-hidden />
        {status}
      </span>
    </button>
  );
}
