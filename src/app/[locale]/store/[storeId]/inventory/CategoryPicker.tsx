"use client";

import { useState } from "react";
import type { CategoryNode } from "@/core/ports/repositories";

const NEW = "__new__";

type Labels = { category: string; subcategory: string; none: string; addNew: string; newPlaceholder: string };

/**
 * เลือกหมวดหลัก/หมวดย่อยจากที่เคยใช้ (dropdown) หรือ "+ เพิ่มหมวดใหม่" แล้วพิมพ์
 * หมวดย่อยแสดงเฉพาะของหมวดหลักที่เลือก
 */
export function CategoryPicker({
  tree,
  defaultCategory,
  defaultSubcategory,
  labels,
}: {
  tree: CategoryNode[];
  defaultCategory: string | null;
  defaultSubcategory: string | null;
  labels: Labels;
}) {
  const known = tree.map((n) => n.category);
  const [cat, setCat] = useState(defaultCategory ?? "");
  const [catNew, setCatNew] = useState(!!defaultCategory && !known.includes(defaultCategory));
  const subsOf = (c: string) => tree.find((n) => n.category === c)?.subcategories ?? [];
  const [sub, setSub] = useState(defaultSubcategory ?? "");
  const [subNew, setSubNew] = useState(!!defaultSubcategory && !subsOf(defaultCategory ?? "").includes(defaultSubcategory));
  const subs = subsOf(cat);

  const selectCls = "w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-brand";
  const inputCls =
    "mt-2 w-full rounded-xl border border-brand bg-card px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-soft";

  return (
    <>
      <label className="block space-y-1">
        <span className="text-sm text-muted">{labels.category}</span>
        <select
          className={selectCls}
          value={catNew ? NEW : cat}
          onChange={(e) => {
            const v = e.target.value;
            setCatNew(v === NEW);
            setCat(v === NEW ? "" : v);
            setSub("");
            setSubNew(false);
          }}
        >
          <option value="">{labels.none}</option>
          {known.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={NEW}>{labels.addNew}</option>
        </select>
        {catNew && (
          <input
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            placeholder={labels.newPlaceholder}
            maxLength={60}
            autoFocus
            className={inputCls}
          />
        )}
        <input type="hidden" name="category" value={cat.trim()} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-muted">{labels.subcategory}</span>
        <select
          className={selectCls}
          value={subNew ? NEW : sub}
          disabled={!cat.trim()}
          onChange={(e) => {
            const v = e.target.value;
            setSubNew(v === NEW);
            setSub(v === NEW ? "" : v);
          }}
        >
          <option value="">{labels.none}</option>
          {!catNew &&
            subs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          <option value={NEW}>{labels.addNew}</option>
        </select>
        {subNew && (
          <input
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            placeholder={labels.newPlaceholder}
            maxLength={60}
            autoFocus
            className={inputCls}
          />
        )}
        <input type="hidden" name="subcategory" value={cat.trim() ? sub.trim() : ""} />
      </label>
    </>
  );
}
