"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import type { Dictionary } from "@/i18n/dictionary";

/** ช่องบาร์โค้ด + ปุ่มสแกนด้วยกล้อง (เจอแล้วกรอกให้และปิดกล้อง) */
export function BarcodeField({ label, defaultValue, scan }: { label: string; defaultValue: string; scan: Dictionary["scan"] }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  return (
    <label className="block space-y-1">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex gap-2">
        <input
          name="barcode"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={60}
          autoComplete="off"
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid w-12 shrink-0 place-items-center rounded-xl border border-line hover:border-brand"
          aria-label={scan.button}
          title={scan.button}
        >
          <Camera className="size-5" />
        </button>
      </span>
      {open && <CameraScanner onDetected={setValue} onClose={() => setOpen(false)} labels={scan} />}
    </label>
  );
}
