"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { useBarcodeScanner } from "@/client/devices/scanner";
import { CameraScanner } from "@/components/CameraScanner";
import { ScannerStatus } from "@/components/devices/ScannerStatus";
import { fill } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";

/**
 * ช่องบาร์โค้ด:
 * - ยิงเครื่องสแกนตอนไหนก็ได้ (ไม่ต้องคลิกช่องก่อน, คีย์บอร์ดภาษาไทยก็ได้) → กรอกให้อัตโนมัติ
 * - หรือกดปุ่มกล้อง
 */
export function BarcodeField({
  label,
  defaultValue,
  scan,
  devices,
}: {
  label: string;
  defaultValue: string;
  scan: Dictionary["scan"];
  devices: Dictionary["devices"];
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState("");

  function fillCode(code: string) {
    setValue(code);
    setFlash(fill(devices.scanFilled, { code }));
  }
  useBarcodeScanner(fillCode);

  return (
    <div className="space-y-1 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="barcode" className="text-sm text-muted">
          {label}
        </label>
        <ScannerStatus t={devices} />
      </div>
      <span className="flex gap-2">
        <input
          id="barcode"
          name="barcode"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setFlash("");
          }}
          maxLength={60}
          autoComplete="off"
          className={`w-full rounded-xl border bg-card px-3 py-2.5 font-mono outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-soft ${
            flash ? "border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900" : "border-line"
          }`}
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
      {flash && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300" role="status">
          {flash}
        </p>
      )}
      {open && <CameraScanner onDetected={fillCode} onClose={() => setOpen(false)} labels={scan} />}
    </div>
  );
}
