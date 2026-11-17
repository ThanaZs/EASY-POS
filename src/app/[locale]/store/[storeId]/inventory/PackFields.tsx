"use client";

import { useState } from "react";
import { toEnglishLayout } from "@/core/lib/keyboard";
import { fill } from "@/core/lib/format";

type Labels = {
  enable: string;
  hint: string;
  packUnit: string;
  packSize: string;
  packPrice: string;
  packPriceHint: string;
  packBarcode: string;
};

/** ตั้งค่าขายยกแพ็ก/ลัง: 1 ลัง = กี่ชิ้น, ราคาต่อลัง (ว่าง = ราคาชิ้น × จำนวน), บาร์โค้ดลัง */
export function PackFields({
  defaults,
  baseUnit,
  currency,
  labels,
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
}) {
  const [on, setOn] = useState(!!defaults.packSize);
  const [unit, setUnit] = useState(defaults.packUnit ?? "ลัง");
  const [code, setCode] = useState(defaults.packBarcode ?? "");
  const cls =
    "w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft";

  return (
    <fieldset className="space-y-3 rounded-2xl border border-line p-4 sm:col-span-2">
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
      <p className="text-xs text-muted">{labels.hint}</p>
      {on && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm text-muted">{labels.packUnit}</span>
            <input
              name="packUnit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={20}
              required
              className={cls}
            />
          </label>
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
          <label className="block space-y-1">
            <span className="text-sm text-muted">
              {fill(labels.packPrice, { unit: unit || "ลัง" })} ({currency})
            </span>
            <input
              name="packPrice"
              defaultValue={defaults.packPrice}
              inputMode="decimal"
              placeholder="—"
              className={cls}
            />
            <span className="block text-xs text-muted">
              {labels.packPriceHint}
            </span>
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">{labels.packBarcode}</span>
            <input
              name="packBarcode"
              value={code}
              onChange={(e) => setCode(toEnglishLayout(e.target.value))}
              maxLength={60}
              autoComplete="off"
              className={`${cls} font-mono`}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
