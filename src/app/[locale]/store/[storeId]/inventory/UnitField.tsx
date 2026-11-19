"use client";

import { useState } from "react";

const NEW = "__new__";

/**
 * เลือกหน่วยแบบเดียวกับหมวดหมู่: รายการให้เลือก (หน่วยมาตรฐาน + ที่ร้านเคยใช้) + "เพิ่มหน่วยใหม่…" → พิมพ์เอง
 * ค่าจริงส่งไปกับฟอร์มผ่าน hidden input ชื่อ name
 */
export function UnitField({
  name,
  label,
  value: controlled,
  onChange,
  defaultValue = "",
  options,
  addNew,
  newPlaceholder,
}: {
  name: string;
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  options: string[];
  addNew: string;
  newPlaceholder: string;
}) {
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const set = (v: string) => (onChange ? onChange(v) : setOwn(v));
  // ค่าเดิมที่ไม่อยู่ในรายการ (ไม่ควรเกิด เพราะรายการรวมหน่วยที่ร้านเคยใช้แล้ว) → ใส่เพิ่มให้เลือกได้
  const list = value && !options.includes(value) ? [...options, value] : options;
  const [typing, setTyping] = useState(false);

  return (
    <label className="block space-y-1">
      <span className="text-sm text-muted">{label}</span>
      <select
        value={typing ? NEW : value}
        onChange={(e) => {
          const v = e.target.value;
          setTyping(v === NEW);
          set(v === NEW ? "" : v);
        }}
        className="w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-brand"
      >
        {list.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={NEW}>{addNew}</option>
      </select>
      {typing && (
        <input
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder={newPlaceholder}
          maxLength={20}
          required
          autoFocus
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-brand bg-card px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-soft"
        />
      )}
      <input type="hidden" name={name} value={value.trim()} />
    </label>
  );
}
