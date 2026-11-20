"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import type { Dictionary } from "@/i18n/dictionary";
import { toEnglishLayout } from "@/core/lib/keyboard";
import { fill } from "@/core/lib/format";
import { GenCodeIcon, makeCode } from "./BarcodeField";
import { UnitField } from "./UnitField";

type Labels = {
  enable: string;
  hint: string;
  packUnit: string;
  packSize: string;
  packPrice: string;
  packPriceHint: string;
  packPriceAuto: string;
  addUnit: string;
  newUnitPlaceholder: string;
  genCode: string;
  packBarcode: string;
};

/** ตั้งค่าขายยกแพ็ก/ลัง: 1 ลัง = กี่ชิ้น, ราคาต่อลัง (ว่าง = ราคาชิ้น × จำนวน), บาร์โค้ดลัง */
export function PackFields({
  defaults,
  baseUnit,
  currency,
  labels,
  unitOptions,
  scan,
}: {
  defaults: {
    packUnit: string | null;
    packSize: number | null;
    packPrice: string;
    packBarcode: string | null;
  };
  baseUnit: string;
  currency: string;
  labels: Labels;
  unitOptions: string[];
  scan: Dictionary["scan"];
}) {
  const [on, setOn] = useState(!!defaults.packSize);
  const [unit, setUnit] = useState(defaults.packUnit ?? "ลัง");
  const [code, setCode] = useState(defaults.packBarcode ?? "");
  const [camera, setCamera] = useState(false);
  const cls =
    "w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft";

  return (
    <div className="col-span-2 space-y-3">
      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          name="packEnabled"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="size-4"
        />
        {labels.enable}
      </label>
      {/* สินค้าเดียวกัน ขายได้ทั้งชิ้นและลัง — ไม่ต้องเพิ่มลังเป็นสินค้าแยก */}
      <p className="text-xs text-muted">{labels.hint}</p>
      {on && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-3">
          <UnitField
            name="packUnit"
            label={labels.packUnit}
            value={unit}
            onChange={setUnit}
            options={unitOptions}
            addNew={labels.addUnit}
            newPlaceholder={labels.newUnitPlaceholder}
          />
          <label className="block space-y-1">
            <span className="text-sm text-muted">
              {fill(labels.packSize, { unit: unit || "ลัง", base: baseUnit })}
            </span>
            <input
              name="packSize"
              type="number"
              min={2}
              defaultValue={defaults.packSize ?? 12}
              inputMode="numeric"
              required
              className={cls}
            />
          </label>
          <label className="col-span-2 block space-y-1">
            <span className="text-sm text-muted">
              {fill(labels.packPrice, { unit: unit || "ลัง" })} ({currency})
            </span>
            <input
              name="packPrice"
              defaultValue={defaults.packPrice}
              inputMode="decimal"
              placeholder={labels.packPriceAuto}
              className={cls}
            />
          </label>
          {/* บาร์โค้ดลัง: แบบเดียวกับช่องบาร์โค้ดหลัก — [ช่อง (ปุ่มสร้างรหัสอยู่ขวาในช่อง)] [กล้อง] */}
          <div className="col-span-2 space-y-1">
            <span className="text-sm text-muted">{labels.packBarcode}</span>
            <span className="flex gap-2">
              <span className="relative min-w-0 flex-1">
                <input
                  name="packBarcode"
                  value={code}
                  onChange={(e) => setCode(toEnglishLayout(e.target.value))}
                  maxLength={60}
                  autoComplete="off"
                  lang="en"
                  aria-label={labels.packBarcode}
                  className={`${cls} pr-11 font-mono`}
                />
                <button
                  type="button"
                  onClick={() => setCode(makeCode())}
                  aria-label={labels.genCode}
                  title={labels.genCode}
                  className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-brand-ink active:scale-95"
                >
                  <GenCodeIcon />
                </button>
              </span>
              <button
                type="button"
                onClick={() => setCamera(true)}
                aria-label={scan.button}
                title={scan.button}
                className="grid w-11 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm transition hover:opacity-90 active:scale-95"
              >
                <Camera className="size-5" />
              </button>
            </span>
          </div>
          {camera && (
            <CameraScanner
              onDetected={(c) => {
                setCamera(false);
                setCode(toEnglishLayout(c));
              }}
              onClose={() => setCamera(false)}
              labels={scan}
            />
          )}
        </div>
      )}
    </div>
  );
}
