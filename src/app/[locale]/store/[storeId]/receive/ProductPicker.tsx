"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, ImageOff, Pin, Search, X } from "lucide-react";
import { toEnglishLayout, useBarcodeScanner } from "@/client/devices/scanner";
import { CameraScanner } from "@/components/CameraScanner";
import { ScannerStatus } from "@/components/devices/ScannerStatus";
import { fill } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";

export type PickProduct = {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  barcode: string | null;
  sku: string | null;
  packBarcode: string | null;
  packSize: number | null;
  packUnit: string | null;
  unit: string;
  stockQty: number;
  imageUrl: string | null;
  pinned: boolean;
};

const NO_SUB = "\u0000none";

/**
 * หน้ารับเข้า/เบิก/ปรับยอด — เลือกสินค้า:
 * 1) ช่องบาร์โค้ดบนสุด: ยิงเครื่องสแกน / พิมพ์แล้ว Enter / กล้อง → เลือกสินค้าให้ (บาร์โค้ดลัง → หน่วยลัง) แล้วไปช่องจำนวน
 * 2) ไม่มีบาร์โค้ด: ค้นหาชื่อ + แตะหมวด → หมวดย่อย → แตะสินค้า (ปักหมุดขึ้นก่อน)
 */
export function ProductPicker({
  products,
  t,
  devices,
  scan,
}: {
  products: PickProduct[];
  t: Dictionary["stock"];
  devices: Dictionary["devices"];
  scan: Dictionary["scan"];
}) {
  const [selected, setSelected] = useState<PickProduct | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const hiddenRef = useRef<HTMLInputElement>(null);

  function choose(p: PickProduct, pack = false) {
    setSelected(p);
    const unit = document.querySelector<HTMLSelectElement>(
      'select[name="unit"]',
    );
    if (unit) unit.value = pack ? "pack" : "base";
    hiddenRef.current?.setCustomValidity("");
    setTimeout(
      () =>
        document.querySelector<HTMLInputElement>('input[name="qty"]')?.focus(),
      50,
    );
  }

  function byCode(raw: string) {
    const c = raw.trim();
    if (!c) return;
    const en = toEnglishLayout(c);
    const pack = products.find(
      (p) =>
        p.packSize &&
        p.packBarcode &&
        (p.packBarcode === c || p.packBarcode === en),
    );
    const p =
      pack ??
      products.find((x) =>
        [x.barcode, x.sku].some((v) => v && (v === c || v === en)),
      );
    setCode(en);
    if (!p)
      return setMsg({
        ok: false,
        text: fill(devices.scanNotFound, { code: en }),
      });
    setMsg({
      ok: true,
      text: fill(devices.scanSelected, {
        name: pack ? `${p.name} (${p.packUnit} ×${p.packSize})` : p.name,
      }),
    });
    choose(p, !!pack);
  }
  useBarcodeScanner(byCode);

  const categories = useMemo(
    () =>
      [
        ...new Set(
          products.map((p) => p.category).filter((c): c is string => !!c),
        ),
      ].sort(),
    [products],
  );
  const subs = useMemo(() => {
    if (!cat) return { list: [] as string[], none: false };
    const inCat = products.filter((p) => p.category === cat);
    return {
      list: [
        ...new Set(
          inCat.map((p) => p.subcategory).filter((s): s is string => !!s),
        ),
      ].sort(),
      none: inCat.some((p) => !p.subcategory),
    };
  }, [products, cat]);
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const en = toEnglishLayout(search.trim());
    return products.filter(
      (p) =>
        (!cat || p.category === cat) &&
        (!sub || (sub === NO_SUB ? !p.subcategory : p.subcategory === sub)) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.includes(en) ||
          p.packBarcode?.includes(en)),
    );
  }, [products, search, cat, sub]);

  const chip = (
    active: boolean,
    label: string,
    onClick: () => void,
    key: string,
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm transition active:scale-95 ${
        active ? "border-brand bg-brand text-white" : "border-line bg-card"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3 sm:col-span-2">
      {/* 1) บาร์โค้ด */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="pick-barcode" className="text-sm text-muted">
            {t.barcode}
          </label>
          <ScannerStatus t={devices} />
        </div>
        <div className="flex gap-2">
          <input
            id="pick-barcode"
            value={code}
            onChange={(e) => setCode(toEnglishLayout(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // ไม่ส่งฟอร์ม
                byCode(e.currentTarget.value);
              }
            }}
            onBlur={(e) =>
              e.currentTarget.value && byCode(e.currentTarget.value)
            }
            placeholder={t.barcodeHint}
            autoComplete="off"
            lang="en"
            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 font-mono outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={() => setCamera(true)}
            aria-label={scan.button}
            title={scan.button}
            className="grid w-12 shrink-0 place-items-center rounded-xl border border-line hover:border-brand"
          >
            <Camera className="size-5" />
          </button>
        </div>
        {msg && (
          <p
            className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}`}
            role="status"
          >
            {msg.text}
          </p>
        )}
      </div>

      {/* ค่าที่ส่งไปกับฟอร์ม (ต้องเลือกสินค้าก่อนบันทึก) */}
      <input
        ref={hiddenRef}
        name="productId"
        value={selected?.id ?? ""}
        onChange={() => {}}
        required
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute size-px opacity-0"
        onInvalid={(e) => e.currentTarget.setCustomValidity(t.mustPick)}
      />

      {/* 2) สินค้าที่เลือก หรือ ตัวเลือก */}
      <span className="text-sm text-muted">{t.product}</span>
      {selected ? (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-brand bg-brand-soft/40 p-2.5">
          <Thumb url={selected.imageUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{selected.name}</p>
            <p className="truncate text-xs text-muted">
              {fill(t.inStock, { n: selected.stockQty, unit: selected.unit })}
              {selected.packSize
                ? ` · 1 ${selected.packUnit} = ${selected.packSize} ${selected.unit}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setMsg(null);
              setCode("");
            }}
            className="flex items-center gap-1 rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium active:scale-95"
          >
            <X className="size-4" /> {t.change}
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-line p-2.5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder={t.searchProduct}
              autoComplete="off"
              className="w-full rounded-xl border border-line bg-card py-2 pl-9 pr-3 outline-none focus:border-brand"
            />
          </label>
          {categories.length > 0 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {chip(!cat, t.all, () => (setCat(null), setSub(null)), "*")}
              {categories.map((c) =>
                chip(cat === c, c, () => (setCat(c), setSub(null)), c),
              )}
            </div>
          )}
          {cat &&
            (subs.list.length > 0 || subs.none) &&
            subs.list.length + (subs.none ? 1 : 0) > 1 && (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {chip(!sub, t.all, () => setSub(null), "s*")}
                {subs.list.map((s) =>
                  chip(sub === s, s, () => setSub(s), `s-${s}`),
                )}
                {subs.none &&
                  chip(sub === NO_SUB, t.noSub, () => setSub(NO_SUB), "s-none")}
              </div>
            )}
          {results.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">{t.noMatch}</p>
          ) : (
            <ul
              className="scroll-box grid gap-1 sm:grid-cols-2"
              style={{ maxHeight: "min(45vh, 22rem)" }}
            >
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setMsg(null);
                      choose(p);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left row-hover"
                  >
                    <Thumb url={p.imageUrl} small />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate text-sm font-medium">
                        {p.pinned && (
                          <Pin className="size-3 shrink-0 fill-current text-brand" />
                        )}
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {[
                          p.subcategory ?? p.category,
                          `${p.stockQty} ${p.unit}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {camera && (
        <CameraScanner
          onDetected={(c) => {
            setCamera(false);
            byCode(c);
          }}
          onClose={() => setCamera(false)}
          labels={scan}
        />
      )}
    </div>
  );
}

function Thumb({
  url,
  small = false,
}: {
  url: string | null;
  small?: boolean;
}) {
  const size = small ? "size-8" : "size-11";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage
    <img
      src={url}
      alt=""
      loading="lazy"
      className={`${size} shrink-0 rounded-lg object-cover`}
    />
  ) : (
    <span
      className={`grid ${size} shrink-0 place-items-center rounded-lg bg-surface text-muted`}
    >
      <ImageOff className="size-3.5" />
    </span>
  );
}
