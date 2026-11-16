"use client";

import { useState } from "react";
import { useBarcodeScanner } from "@/client/devices/scanner";
import { ScannerStatus } from "@/components/devices/ScannerStatus";
import { fill } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";

/** หน้ารับเข้า: ยิงบาร์โค้ด → เลือกสินค้าในช่อง "สินค้า" ให้ แล้วไปที่ช่องจำนวน */
export function ScanSelect({
  products,
  devices,
}: {
  products: Array<{ id: string; name: string; codes: string[] }>;
  devices: Dictionary["devices"];
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useBarcodeScanner((code) => {
    const p = products.find((x) => x.codes.includes(code));
    if (!p) return setMsg({ ok: false, text: fill(devices.scanNotFound, { code }) });
    const select = document.querySelector<HTMLSelectElement>('select[name="productId"]');
    if (select) select.value = p.id;
    document.querySelector<HTMLInputElement>('input[name="qty"]')?.focus();
    setMsg({ ok: true, text: fill(devices.scanSelected, { name: p.name }) });
  });
  return (
    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
      <ScannerStatus t={devices} />
      {msg && (
        <span className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}`} role="status">
          {msg.text}
        </span>
      )}
    </div>
  );
}
