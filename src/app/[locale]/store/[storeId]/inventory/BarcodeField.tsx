"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toEnglishLayout, useBarcodeScanner } from "@/client/devices/scanner";
import { CameraScanner } from "@/components/CameraScanner";
import { fill } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";
import { CatalogLookup } from "./CatalogLookup";

/** รหัสภายในร้าน (EAN-13 ขึ้นต้น 2 = ใช้ในร้าน ไม่ชนบาร์โค้ดสินค้าจริง) — สแกน/พิมพ์เป็นบาร์โค้ด/QR ได้ */
export function makeCode(): string {
  const d = [2, ...crypto.getRandomValues(new Uint8Array(11)).map((x) => x % 10)];
  const sum = d.reduce((a, n, i) => a + n * (i % 2 ? 3 : 1), 0);
  return d.join("") + ((10 - (sum % 10)) % 10);
}

/**
 * ช่องบาร์โค้ด / รหัสสินค้า (รวม SKU):
 * - ยิงเครื่องสแกนตอนไหนก็ได้ (ไม่ต้องคลิกช่องก่อน, คีย์บอร์ดภาษาไทยก็ได้) → กรอกให้อัตโนมัติ
 * - หรือกดปุ่มกล้อง
 * - สินค้าไม่มีบาร์โค้ด → กด "สร้างรหัส" ได้รหัสของร้านเอง
 */
export function BarcodeField({
  label,
  genLabel,
  defaultValue,
  scan,
  devices,
  lookup,
}: {
  label: string;
  genLabel: string;
  defaultValue: string;
  scan: Dictionary["scan"];
  devices: Dictionary["devices"];
  /** หน้าเพิ่มสินค้าใหม่: ค้นคลังข้อมูลเมื่อได้บาร์โค้ด */
  lookup?: { locale: string; storeId: string; t: Dictionary["catalog"] };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState("");

  function fillCode(code: string) {
    setValue(code);
    setFlash(fill(devices.scanFilled, { code }));
  }
  useBarcodeScanner(fillCode);

  return (
    <div className="col-span-2 space-y-1">
      <label htmlFor="barcode" className="text-sm text-muted">
        {label}
      </label>
      {/* [ช่องรหัส (ปุ่มสร้างรหัสอยู่ในช่อง ขวาสุด)] [กล้อง] */}
      <span className="flex gap-2">
        <span className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            id="barcode"
            name="barcode"
            value={value}
            onChange={(e) => {
              // คีย์บอร์ดค้างภาษาไทยตอนยิง/พิมพ์ → แปลง "ๅ/-ภ" กลับเป็น "1234" ทันที
              setValue(toEnglishLayout(e.target.value));
              setFlash("");
            }}
            maxLength={60}
            autoComplete="off"
            inputMode="text"
            lang="en"
            className={`w-full min-w-0 rounded-xl border bg-card py-2.5 pl-3 pr-11 font-mono outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-soft ${
              flash
                ? "border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900"
                : "border-line"
            }`}
          />
          <button
            type="button"
            onClick={() => {
              setValue(makeCode());
              setFlash("");
            }}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-brand-ink active:scale-95"
            aria-label={genLabel}
            title={genLabel}
          >
            <GenCodeIcon />
          </button>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid w-11 shrink-0 place-items-center rounded-xl border border-line hover:border-brand"
          aria-label={scan.button}
          title={scan.button}
        >
          <Camera className="size-5" />
        </button>
      </span>
      {flash && (
        <p
          className="text-xs text-emerald-700 dark:text-emerald-300"
          role="status"
        >
          {flash}
        </p>
      )}
      {lookup && (
        <CatalogLookup barcode={value} anchor={inputRef} {...lookup} />
      )}
      {open && (
        <CameraScanner
          onDetected={fillCode}
          onClose={() => setOpen(false)}
          labels={scan}
        />
      )}
    </div>
  );
}

/** ประกาย 4 แฉก (ขอบโค้งเว้า) กลางที่ (cx, cy) รัศมี r */
const sparkle = (cx: number, cy: number, r: number) => {
  const k = r * 0.18;
  return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
};

/** ไอคอน "สร้างบาร์โค้ด" (แบบ 3 ที่ผู้ใช้เลือก): บาร์โค้ด + ประกายส้ม 3 ดวงมุมขวาบน */
export function GenCodeIcon() {
  return (
    <svg viewBox="0 0 25 24" className="size-6" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M2.5 8v13M6.5 8v13M10 8v13M14 8v13M17.5 12v9" />
      </g>
      <g className="fill-brand">
        <path d={sparkle(18.3, 6, 4.3)} />
        <path d={sparkle(22.8, 1.9, 1.8)} />
        <path d={sparkle(23.2, 9.6, 1.4)} />
      </g>
    </svg>
  );
}
