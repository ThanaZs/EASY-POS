"use client";

import { useMemo, useState } from "react";
import { ImageOff, Merge, Search, X } from "lucide-react";
import { fill } from "@/core/lib/format";
import { toEnglishLayout } from "@/core/lib/keyboard";
import type { Dictionary } from "@/i18n/dictionary";
import { mergeAsPackAction } from "./actions";

type Opt = {
  id: string;
  name: string;
  barcode: string | null;
  unit: string;
  stockQty: number;
  imageUrl: string | null;
};

/**
 * "สินค้านี้คือลัง/แพ็กของสินค้าอื่น" — แก้กรณีเพิ่มลังแยกเป็นสินค้าอีกตัว (สต็อกแยกกัน นับไม่รวม)
 * เลือกสินค้าปลีก → ใส่ 1 ลัง = กี่ชิ้น → รวม: เหลือสินค้าเดียว ขายได้ทั้งชิ้นและลัง สต็อกนับเป็นชิ้น
 */
export function MergeAsPack({
  locale,
  storeId,
  source,
  options,
  t,
}: {
  locale: string;
  storeId: string;
  source: { id: string; name: string; unit: string; stockQty: number };
  options: Opt[];
  t: Dictionary["inventory"]["merge"];
}) {
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Opt | null>(null);
  const [size, setSize] = useState("12");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const en = toEnglishLayout(q.trim());
    return options
      .filter(
        (o) =>
          o.name.toLowerCase().includes(s) ||
          (o.barcode && (o.barcode.includes(s) || o.barcode.includes(en))),
      )
      .slice(0, 6);
  }, [q, options]);
  const n = Number.parseInt(size, 10);
  const ok = !!target && Number.isFinite(n) && n >= 2;
  const packUnit = target && source.unit !== target.unit ? source.unit : "ลัง";

  return (
    <details className="group rounded-2xl border border-line bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4">
        <Merge className="size-5 shrink-0 text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t.title}</span>
          <span className="block text-xs text-muted">{t.hint}</span>
        </span>
      </summary>
      <form
        action={mergeAsPackAction}
        onSubmit={(e) => {
          if (
            !target ||
            !window.confirm(fill(t.confirm, { a: source.name, b: target.name }))
          )
            e.preventDefault();
        }}
        className="space-y-3 border-t border-line p-4"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="sourceId" value={source.id} />
        <input type="hidden" name="targetId" value={target?.id ?? ""} />

        {/* 1) เลือกสินค้าปลีก */}
        <span className="text-sm text-muted">{t.pickTarget}</span>
        {target ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-brand bg-brand-soft/40 p-2">
            <Thumb url={target.imageUrl} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{target.name}</span>
              <span className="block text-xs text-muted">
                {target.stockQty} {target.unit}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setTarget(null)}
              aria-label="change"
              className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                placeholder={t.search}
                autoComplete="off"
                className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-3 outline-none focus:border-brand"
              />
            </label>
            {results.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setTarget(o)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left row-hover"
              >
                <Thumb url={o.imageUrl} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {o.name}
                </span>
                <span className="text-xs text-muted">
                  {o.stockQty} {o.unit}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 2) 1 ลัง = กี่ชิ้น */}
        <label className="block space-y-1">
          <span className="text-sm text-muted">
            {fill(t.packSize, { pack: packUnit, unit: target?.unit ?? "ชิ้น" })}
          </span>
          <input
            name="packSize"
            type="number"
            min={2}
            inputMode="numeric"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="w-32 rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-brand"
          />
        </label>

        {/* ผลลัพธ์ที่จะเกิด */}
        {ok && target && (
          <ul className="list-disc space-y-1 rounded-xl bg-surface p-3 pl-7 text-sm">
            <li>{fill(t.result1, {
                b: target.name,
                pack: packUnit,
                n,
                unit: target.unit,
              })}</li>
            {source.stockQty !== 0 && (
              <li>
                {fill(t.result2, {
                  q: source.stockQty,
                  pack: packUnit,
                  total: source.stockQty * n,
                  unit: target.unit,
                })}
              </li>
            )}
            <li>{fill(t.result3, { a: source.name })}</li>
          </ul>
        )}
        <button
          type="submit"
          disabled={!ok}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white disabled:opacity-40"
        >
          <Merge className="size-4" /> {t.submit}
        </button>
      </form>
    </details>
  );
}

function Thumb({ url }: { url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage
    <img src={url} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
  ) : (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-muted">
      <ImageOff className="size-3.5" />
    </span>
  );
}
