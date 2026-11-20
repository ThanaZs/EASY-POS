"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, ImageOff, Pin, Search, X } from "lucide-react";
import { toEnglishLayout, useBarcodeScanner } from "@/client/devices/scanner";
import { CameraScanner } from "@/components/CameraScanner";
import { compareText } from "@/core/lib/compare";
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

const MAX = 8;

/**
 * หน้ารับเข้า/เบิก/ปรับยอด — เลือกสินค้าด้วยช่องเดียว:
 * ยิงเครื่องสแกน / กล้อง / พิมพ์ (บาร์โค้ด, ชื่อ, SKU, หมวด) → รายการใกล้เคียงพร้อมรูปเด้งใต้ช่อง แตะเลือก
 * Enter = เลือกตัวบนสุด (บาร์โค้ดตรงเป๊ะขึ้นก่อน; บาร์โค้ดลัง → หน่วยลัง)
 * ช่องว่าง = แสดงสินค้าที่ปักหมุดไว้ให้แตะเลือกเร็ว
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
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [camera, setCamera] = useState(false);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function choose(p: PickProduct, pack = false) {
    setSelected(p);
    setText("");
    setOpen(false);
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

  /** บาร์โค้ด/SKU ตรงเป๊ะ (ยิงเครื่องสแกน/กล้อง) */
  function exact(raw: string) {
    const c = raw.trim();
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
    return p ? { p, pack: !!pack } : null;
  }

  function byCode(raw: string) {
    const c = raw.trim();
    if (!c) return;
    const hit = exact(c);
    if (!hit) {
      // ไม่ใช่รหัส → ใช้เป็นคำค้นแทน (เปิดรายการใกล้เคียง)
      setText(c);
      setOpen(true);
      setActive(0);
      return setMsg({
        ok: false,
        text: fill(devices.scanNotFound, { code: toEnglishLayout(c) }),
      });
    }
    setMsg({
      ok: true,
      text: fill(devices.scanSelected, {
        name: hit.pack
          ? `${hit.p.name} (${hit.p.packUnit} ×${hit.p.packSize})`
          : hit.p.name,
      }),
    });
    choose(hit.p, hit.pack);
  }
  useBarcodeScanner(byCode);

  // ค้นหาทุกอย่าง: ชื่อ (ทุกคำ), บาร์โค้ด, บาร์โค้ดลัง, SKU, หมวด/หมวดย่อย
  const results = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return products.filter((p) => p.pinned).slice(0, MAX);
    const en = toEnglishLayout(text.trim()).toLowerCase();
    const words = q.split(/\s+/);
    const score = (p: PickProduct) => {
      const name = p.name.toLowerCase();
      const codes = [p.barcode, p.packBarcode, p.sku]
        .filter(Boolean)
        .map((v) => v!.toLowerCase());
      if (codes.some((c) => c === q || c === en)) return 100;
      if (name.startsWith(q)) return 80;
      if (words.every((w) => name.includes(w))) return 60;
      if (codes.some((c) => c.includes(q) || c.includes(en))) return 40;
      const cats = `${p.category ?? ""} ${p.subcategory ?? ""}`.toLowerCase();
      if (words.every((w) => cats.includes(w) || name.includes(w))) return 20;
      return 0;
    };
    return products
      .map((p) => ({ p, s: score(p) + (p.pinned ? 1 : 0) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || compareText(a.p.name, b.p.name))
      .slice(0, MAX)
      .map((x) => x.p);
  }, [products, text]);

  const pick = (p: PickProduct) => {
    setMsg(null);
    // ค้นด้วยบาร์โค้ดลังแล้วเลือกตัวนั้น → หน่วยลัง
    const en = toEnglishLayout(text.trim());
    choose(
      p,
      !!p.packBarcode &&
        (p.packBarcode === text.trim() || p.packBarcode === en),
    );
  };

  return (
    <div className="min-w-0 space-y-1.5 sm:col-span-2">
      <span className="text-sm text-muted">{t.product}</span>

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
        onInvalid={(e) => {
          e.currentTarget.setCustomValidity(t.mustPick);
          inputRef.current?.focus();
        }}
      />

      {selected ? (
        // สินค้าที่เลือก (การ์ดใหญ่ เห็นรูปชัด)
        <div className="flex items-center gap-3 rounded-2xl border-2 border-brand bg-brand-soft/40 p-2.5">
          <Thumb url={selected.imageUrl} size="size-14" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold leading-snug">
              {selected.name}
            </p>
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
              setTimeout(() => inputRef.current?.focus(), 30);
            }}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium active:scale-95"
          >
            <X className="size-4" /> {t.change}
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
              <input
                ref={inputRef}
                id="pick-barcode"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setOpen(true);
                  setActive(0);
                  setMsg(null);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setOpen(true);
                    setActive((a) =>
                      Math.max(
                        0,
                        Math.min(
                          results.length - 1,
                          a + (e.key === "ArrowDown" ? 1 : -1),
                        ),
                      ),
                    );
                  } else if (e.key === "Enter") {
                    e.preventDefault(); // ไม่ส่งฟอร์ม
                    const v = e.currentTarget.value;
                    if (exact(v)) byCode(v);
                    else if (results[active]) pick(results[active]);
                  } else if (e.key === "Escape") setOpen(false);
                }}
                placeholder={t.searchAll}
                autoComplete="off"
                enterKeyHint="search"
                className="w-full rounded-xl border border-line bg-card py-3 pl-10 pr-9 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
              />
              {text && (
                <button
                  type="button"
                  onClick={() => {
                    setText("");
                    setMsg(null);
                    inputRef.current?.focus();
                  }}
                  aria-label="clear"
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface"
                >
                  <X className="size-4" />
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => setCamera(true)}
              aria-label={scan.button}
              title={scan.button}
              className="grid w-12 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm transition hover:opacity-90 active:scale-95"
            >
              <Camera className="size-5" />
            </button>
          </div>

          {/* รายการใกล้เคียง (เด้งใต้ช่อง) */}
          {open && (results.length > 0 || text.trim()) && (
            <ul
              role="listbox"
              className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-[min(60vh,26rem)] overflow-y-auto rounded-2xl border border-line bg-card p-1 shadow-xl"
            >
              {!text.trim() && (
                <li className="px-2.5 pb-1 pt-1.5 text-xs text-muted">
                  {t.pinnedHint}
                </li>
              )}
              {results.length === 0 ? (
                <li className="p-4 text-center text-sm text-muted">
                  {t.noMatch}
                </li>
              ) : (
                results.map((p, i) => (
                  <li key={p.id} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      // mousedown ก่อน blur ของช่องค้นหา (ไม่งั้นรายการปิดก่อนกด)
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(p)}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${
                        i === active ? "bg-brand-soft" : ""
                      }`}
                    >
                      <Thumb url={p.imageUrl} size="size-11" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1">
                          {p.pinned && (
                            <Pin className="size-3 shrink-0 fill-current text-brand" />
                          )}
                          <span className="line-clamp-1 text-[15px] font-medium">
                            {p.name}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {[
                            [p.category, p.subcategory]
                              .filter(Boolean)
                              .join(" › "),
                            p.barcode,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs tabular-nums text-muted">
                        {p.stockQty} {p.unit}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
      {msg && (
        <p
          className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}`}
          role="status"
        >
          {msg.text}
        </p>
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

function Thumb({ url, size }: { url: string | null; size: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage
    <img
      src={url}
      alt=""
      loading="lazy"
      className={`${size} shrink-0 rounded-xl object-cover`}
    />
  ) : (
    <span
      className={`grid ${size} shrink-0 place-items-center rounded-xl bg-surface text-muted`}
    >
      <ImageOff className="size-4" />
    </span>
  );
}
