"use client";

import { useState } from "react";

/** ช่องหน่วย + ปุ่มตัวเลือก (หน่วยมาตรฐาน + ที่ร้านเคยใช้) แตะเลือกได้เลย หรือพิมพ์เอง */
export function UnitField({
  name,
  label,
  value: controlled,
  onChange,
  defaultValue = "",
  options,
  required,
}: {
  name: string;
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  options: string[];
  required?: boolean;
}) {
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const set = (v: string) => (onChange ? onChange(v) : setOwn(v));
  return (
    <div className="col-span-2 space-y-1.5">
      <label className="flex items-center gap-2">
        <span className="shrink-0 text-sm text-muted">{label}</span>
        <input
          name={name}
          value={value}
          onChange={(e) => set(e.target.value)}
          maxLength={20}
          required={required}
          autoComplete="off"
          className="w-28 min-w-0 rounded-xl border border-line bg-card px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
        />
      </label>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => set(o)}
            aria-pressed={value === o}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm transition active:scale-95 ${
              value === o
                ? "border-brand bg-brand-soft font-semibold text-brand-ink"
                : "border-line bg-card"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
