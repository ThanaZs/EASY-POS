"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { readSheetFile, type Sheet } from "@/client/sheet";
import { fill } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";
import { importProductsAction, type RawImportRow } from "./actions";

type Field = keyof RawImportRow;
const FIELDS: Field[] = ["barcode", "name", "price", "cost", "stock", "category", "subcategory"];

// ชื่อหัวคอลัมน์ที่รู้จัก (ไทย/อังกฤษ) — จับคู่อัตโนมัติ
const SYNONYMS: Record<Field, string[]> = {
  barcode: ["บาร์โค้ด", "บาร์โค๊ด", "barcode", "รหัสบาร์โค้ด", "ean", "upc"],
  name: ["ชื่อสินค้า", "ชื่อ", "สินค้า", "name", "product", "product name", "item"],
  price: ["ราคาขาย", "ราคา", "price", "sell price", "selling price"],
  cost: ["ราคาทุน", "ต้นทุน", "ทุน", "cost", "cost price"],
  stock: ["จำนวนคงเหลือ", "คงเหลือ", "จำนวน", "สต็อก", "stock", "qty", "quantity", "on hand"],
  category: ["หมวดหลัก", "หมวดหมู่", "หมวด", "category", "group"],
  subcategory: ["หมวดย่อย", "หมวดหมู่ย่อย", "subcategory", "sub category", "sub-category"],
};
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function autoMap(header: string[]): Record<Field, number> {
  const m = {} as Record<Field, number>;
  for (const f of FIELDS) m[f] = header.findIndex((h) => SYNONYMS[f].includes(norm(h)));
  return m;
}

const CHUNK = 200;

export function ImportClient({
  locale,
  storeId,
  t,
}: {
  locale: string;
  storeId: string;
  t: Dictionary["import"];
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [map, setMap] = useState<Record<Field, number> | null>(null);
  const [updateStock, setUpdateStock] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const header = sheet?.[0] ?? [];
  const body = (sheet ?? []).slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
  const rows: RawImportRow[] = map
    ? body.map((r) => {
        const o: RawImportRow = {};
        for (const f of FIELDS) if (map[f] >= 0) o[f] = String(r[map[f]] ?? "");
        return o;
      })
    : [];
  const ready = !!map && map.name >= 0 && rows.length > 0;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const s = await readSheetFile(file);
      if (s.length < 2) throw new Error("empty");
      setSheet(s);
      setMap(autoMap(s[0]));
    } catch {
      setSheet(null);
      setMap(null);
      setError(t.readError);
    }
  }

  async function runImport() {
    setError(null);
    const total = { created: 0, updated: 0, skipped: 0 };
    setProgress({ done: 0, total: rows.length });
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const res = await importProductsAction({ locale, storeId, rows: rows.slice(i, i + CHUNK), updateStock });
        total.created += res.created;
        total.updated += res.updated;
        total.skipped += res.skipped;
        setProgress({ done: Math.min(rows.length, i + CHUNK), total: rows.length });
      }
      setResult(total);
      router.refresh();
    } catch {
      setError(t.importError);
    } finally {
      setProgress(null);
    }
  }

  function downloadTemplate() {
    const head = "บาร์โค้ด,ชื่อสินค้า,ราคาขาย,ราคาทุน,จำนวนคงเหลือ,หมวดหลัก,หมวดย่อย\n";
    const ex = "8851234567890,น้ำดื่ม 600ml,10,6,48,เครื่องดื่ม,น้ำเปล่า\n";
    const blob = new Blob(["﻿" + head + ex], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "easy-pos-import-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (result) {
    return (
      <div className="space-y-4 rounded-2xl border border-line bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 className="text-lg font-bold">{t.done}</h2>
        <p className="text-sm">{fill(t.summary, result)}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href={`/${locale}/store/${storeId}/inventory`} className="rounded-xl bg-brand px-4 py-2.5 font-semibold text-white">
            {t.goInventory}
          </Link>
          <button onClick={() => (setResult(null), setSheet(null), setMap(null), setFileName(""))} className="rounded-xl border border-line px-4 py-2.5">
            {t.again}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-card p-8 text-center hover:border-brand">
        <FileSpreadsheet className="size-10 text-brand-ink" />
        <span className="font-semibold">{fileName || t.choose}</span>
        <span className="text-xs text-muted">{t.formats}</span>
        <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      <button onClick={downloadTemplate} className="inline-flex items-center gap-1 text-sm text-brand-ink hover:underline">
        <Download className="size-4" /> {t.template}
      </button>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</p>}

      {map && sheet && (
        <>
          <section className="space-y-2 rounded-2xl border border-line bg-card p-4">
            <h2 className="font-semibold">{t.mapping}</h2>
            <p className="text-xs text-muted">{t.mappingHint}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <label key={f} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {t.fields[f]}
                    {f === "name" && <span className="text-rose-600"> *</span>}
                  </span>
                  <select
                    value={map[f]}
                    onChange={(e) => setMap({ ...map, [f]: Number(e.target.value) })}
                    className="w-44 rounded-lg border border-line bg-card px-2 py-1"
                  >
                    <option value={-1}>{t.notUsed}</option>
                    {header.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `#${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">{fill(t.preview, { n: rows.length })}</h2>
            <div className="overflow-x-auto rounded-2xl border border-line bg-card">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface text-left text-xs text-muted">
                  <tr>
                    {FIELDS.filter((f) => map[f] >= 0).map((f) => (
                      <th key={f} className="px-3 py-2 font-medium">
                        {t.fields[f]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.slice(0, 15).map((r, i) => (
                    <tr key={i}>
                      {FIELDS.filter((f) => map[f] >= 0).map((f) => (
                        <td key={f} className={`px-3 py-1.5 ${f === "barcode" ? "font-mono text-xs" : ""}`}>
                          {r[f]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 15 && <p className="text-xs text-muted">{fill(t.more, { n: rows.length - 15 })}</p>}
          </section>

          <label className="flex items-start gap-2 rounded-2xl border border-line bg-card p-4 text-sm">
            <input type="checkbox" checked={updateStock} onChange={(e) => setUpdateStock(e.target.checked)} className="mt-0.5 size-4" />
            <span>
              <b>{t.updateStock}</b>
              <br />
              <span className="text-muted">{t.updateStockHint}</span>
            </span>
          </label>
          <p className="text-xs text-muted">{t.rules}</p>

          <button
            disabled={!ready || !!progress}
            onClick={() => void runImport()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-lg font-semibold text-white disabled:opacity-50"
          >
            {progress ? <LoaderCircle className="size-5 animate-spin" /> : <Upload className="size-5" />}
            {progress ? fill(t.importing, progress) : fill(t.importBtn, { n: rows.length })}
          </button>
          {map.name < 0 && <p className="text-sm text-rose-600">{t.needName}</p>}
        </>
      )}
    </div>
  );
}
