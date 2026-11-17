"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Database, ImageOff, LoaderCircle, X } from "lucide-react";
import { setInputValue } from "@/client/devices/scanner";
import type { Dictionary } from "@/i18n/dictionary";
import { lookupBarcodeAction } from "./actions";

type Result = NonNullable<Awaited<ReturnType<typeof lookupBarcodeAction>>>;
type Hit = NonNullable<Extract<Result, { hit: unknown }>["hit"]>;
type Existing = NonNullable<Extract<Result, { existing: unknown }>["existing"]>;

/** แจ้งช่องอื่นในฟอร์ม (หมวด/รูป) ให้ใช้ข้อมูลจากคลัง */
export const CATALOG_FILL = "ep:catalog-fill";
export type CatalogFillDetail = {
  category: string | null;
  subcategory: string | null;
  imageUrl: string | null;
  imageRef: string | null;
};

/**
 * หน้าเพิ่มสินค้า: บาร์โค้ดเปลี่ยน → ค้นคลังข้อมูล → การ์ด "ใช้ข้อมูลนี้"
 * กดใช้ = กรอกชื่อ/หน่วย/หมวด + ใช้รูป (ถ้ายังไม่ได้ถ่ายเอง) — แก้ต่อได้ทุกช่อง
 */
export function CatalogLookup({
  barcode,
  locale,
  storeId,
  anchor,
  t,
}: {
  barcode: string;
  locale: string;
  storeId: string;
  anchor: React.RefObject<HTMLElement | null>; // ช่องบาร์โค้ด (หา <form>)
  t: Dictionary["catalog"];
}) {
  const [hit, setHit] = useState<Hit | null>(null);
  const [existing, setExisting] = useState<Existing | null>(null);
  const [state, setState] = useState<
    "idle" | "found" | "none" | "used" | "exists"
  >("idle");
  const [pending, start] = useTransition();
  const lastLooked = useRef("");

  useEffect(() => {
    const code = barcode.trim();
    if (code.length < 6 || code === lastLooked.current) return;
    const timer = setTimeout(() => {
      lastLooked.current = code;
      start(async () => {
        const res = await lookupBarcodeAction({
          locale,
          storeId,
          barcode: code,
        }).catch(() => null);
        if (code !== lastLooked.current) return;
        setHit(res && "hit" in res && res.hit ? res.hit : null);
        setExisting(
          res && "existing" in res && res.existing ? res.existing : null,
        );
        setState(res && "existing" in res ? "exists" : res ? "found" : "none");
      });
    }, 400); // พิมพ์เองทีละตัว → รอให้หยุดก่อน
    return () => clearTimeout(timer);
  }, [barcode, locale, storeId]);

  function use() {
    if (!hit) return;
    const form = anchor.current?.closest("form");
    const field = (n: string) => form?.elements.namedItem(n);
    const name = field("name");
    if (name instanceof HTMLInputElement) setInputValue(name, hit.name);
    const unit = field("unit");
    if (hit.unit && unit instanceof HTMLInputElement)
      setInputValue(unit, hit.unit);
    window.dispatchEvent(
      new CustomEvent<CatalogFillDetail>(CATALOG_FILL, {
        detail: {
          category: hit.category,
          subcategory: hit.subcategory,
          imageUrl: hit.imageUrl,
          imageRef: hit.imageRef,
        },
      }),
    );
    setState("used");
  }

  if (barcode.trim().length < 6) return null;
  if (pending)
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <LoaderCircle className="size-4 animate-spin" /> {t.searching}
      </p>
    );
  if (state === "exists" && existing)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400 bg-amber-50 p-3 dark:bg-amber-950/40">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            {t.exists}
          </p>
          <p className="truncate font-semibold">{existing.name}</p>
        </div>
        <Link
          prefetch={false}
          href={`/${locale}/store/${storeId}/inventory/${existing.id}`}
          className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white transition active:scale-95"
        >
          {t.editExisting}
        </Link>
      </div>
    );
  if (state === "none")
    return <p className="text-xs text-muted">{t.notFound}</p>;
  if (state === "used")
    return (
      <p
        className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300"
        role="status"
      >
        <Check className="size-4" /> {t.used}
      </p>
    );
  if (state !== "found" || !hit) return null;
  const source =
    hit.source === "store"
      ? t.fromCatalog
      : hit.source === "obf"
        ? t.fromObf
        : t.fromOff;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand bg-brand-soft/50 p-3">
      {hit.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- รูปจากคลังข้อมูล/แหล่งภายนอก
        <img
          src={hit.imageUrl}
          alt=""
          className="size-16 shrink-0 rounded-xl bg-card object-contain"
        />
      ) : (
        <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-card text-muted">
          <ImageOff className="size-6" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-brand-ink">{t.found}</p>
        <p className="truncate font-semibold">{hit.name}</p>
        <p className="truncate text-xs text-muted">
          {[hit.category, hit.subcategory].filter(Boolean).join(" › ")}
          {hit.category ? " · " : ""}
          <Database className="inline size-3" /> {source}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={use}
          className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white transition active:scale-95"
        >
          {t.use}
        </button>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="flex items-center justify-center gap-1 text-xs text-muted hover:text-ink"
        >
          <X className="size-3" /> {t.dismiss}
        </button>
      </div>
    </div>
  );
}
