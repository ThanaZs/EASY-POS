"use client";

import { askText, showAlert } from "@/components/AppDialog";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Camera,
  LoaderCircle,
  Pencil,
  Pin,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import type { Dictionary } from "@/i18n/dictionary";
import { useBarcodeScanner } from "@/client/devices/scanner";
import type { CategoryNode } from "@/core/ports/repositories";
import { fill } from "@/core/lib/format";
import { toEnglishLayout } from "@/core/lib/keyboard";
import { renameCategoryAction } from "./actions";

/** เขียน cookie ตัวกรองล่าสุดของหน้า (อ่านที่ server/filters.ts) — ว่าง = ลบ */
export function rememberFilters(pathname: string, search: string) {
  const [, , , storeId, page] = pathname.split("/");
  if (!storeId || (page !== "inventory" && page !== "history")) return;
  const p = new URLSearchParams(search);
  for (const k of ["product", "reset"]) p.delete(k);
  // บาร์โค้ด (ตัวเลขล้วน ≥6 หลัก) = ค้นครั้งเดียว ไม่จำ → กลับมาหน้านี้ช่องค้นหาว่าง; ค้นด้วยชื่อยังจำไว้
  // (ยิงตอนคีย์บอร์ดค้างภาษาไทย ได้ "ๅ/-ภ…" → แปลงเป็นตัวเลขก่อนเช็ค)
  if (/^\d{6,}$/.test(toEnglishLayout((p.get("q") ?? "").trim())))
    p.delete("q");
  const qs = p.toString();
  document.cookie = `epf_${page}_${storeId}=${encodeURIComponent(qs)}; path=/; max-age=${qs ? 43200 : 0}; samesite=lax`;
}

/** ค่า ?sub= สำหรับ "ไม่มีหมวดย่อย" (สินค้าที่มีแค่หมวดหลัก) */
export const NO_SUB = "-";

type Labels = {
  search: string;
  allCategories: string;
  lowOnly: string;
  pinOnly: string;
  allSub: string;
  noSub: string;
};

/**
 * ค้นหา/กรองคลังสินค้า: พิมพ์ (รอ 0.3 วิ), เลือกหมวด, ติ๊กใกล้หมด → อัปเดตผลทันที ไม่ต้องกดปุ่ม
 * เลือกหมวดหลักแล้ว → ปุ่มหมวดย่อยโผล่ใต้ช่องค้นหา (เฉพาะหมวดที่มีหมวดย่อย)
 * สินค้าที่มีแค่หมวดหลัก → อยู่ในปุ่ม "ไม่มีหมวดย่อย"
 */
export function InventoryFilters({
  q,
  cat,
  sub,
  low,
  pin,
  tree,
  labels,
  scan,
  rename,
}: {
  q: string;
  cat: string;
  sub: string;
  low: boolean;
  pin: boolean;
  tree: CategoryNode[];
  labels: Labels;
  scan: Dictionary["scan"];
  /** มีสิทธิ์แก้สินค้า → ปุ่มดินสอแก้ชื่อหมวด/หมวดย่อย */
  rename?: {
    locale: string;
    storeId: string;
    t: Pick<
      Dictionary["inventory"],
      "renameCat" | "renameSub" | "renamePrompt" | "renamed" | "renameFailed"
    >;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(q);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const state = useRef({ q, cat, sub, low, pin });
  const [selCat, setSelCat] = useState(cat);
  const [selSub, setSelSub] = useState(sub);
  const [selLow, setSelLow] = useState(low);
  const [selPin, setSelPin] = useState(pin);
  const [camera, setCamera] = useState(false);

  // ยิงบาร์โค้ด (จะโฟกัสช่องค้นหาอยู่หรือไม่ก็ได้) → แทนที่คำค้นด้วยรหัสใหม่ + ล้างตัวกรองอื่นให้เจอสินค้าแน่ๆ
  // ต้องยกเลิกตัวหน่วงเวลาของช่องพิมพ์ด้วย ไม่งั้นค่าที่เครื่องสแกนพิมพ์ทับ/คืนค่าเดิม จะมาทับผลการยิงทีหลัง (เคยเด้งกลับโล่ง/เป็นรหัสเก่า)
  const onScanned = (code: string) => {
    clearTimeout(timer.current);
    setText(code);
    setSelCat("");
    setSelSub("");
    setSelLow(false);
    setSelPin(false);
    apply({ q: code, cat: "", sub: "", low: false, pin: false });
  };
  useBarcodeScanner(onScanned);
  const node = tree.find((n) => n.category === selCat);
  const [renaming, setRenaming] = useState(false);
  // เลื่อนแถวหมวดย่อยให้เห็นตัวที่เลือก (+ปุ่มดินสอ) เสมอ — เช่น กลับมาหน้านี้ด้วยตัวกรองเดิม
  const subRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = subRow.current;
    const on = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !on) return;
    const end = on.offsetLeft + on.offsetWidth + 44; // + ปุ่มดินสอ
    if (
      on.offsetLeft < row.scrollLeft ||
      end > row.scrollLeft + row.clientWidth
    )
      row.scrollTo({
        left: Math.max(0, on.offsetLeft - 16),
        behavior: "smooth",
      });
  }, [selSub, selCat]);
  /** แก้ชื่อหมวด (kind=cat) หรือหมวดย่อยที่เลือกอยู่ (kind=sub) — ใช้ช่องถามของเครื่อง (ง่าย ไม่ต้องมีหน้าใหม่) */
  async function renameIt(kind: "cat" | "sub") {
    if (!rename || renaming) return;
    const from = kind === "cat" ? selCat : selSub;
    if (!from || from === NO_SUB) return;
    const to = await askText(fill(rename.t.renamePrompt, { name: from }), from);
    if (!to || to === from) return;
    setRenaming(true);
    const res = await renameCategoryAction({
      locale: rename.locale,
      storeId: rename.storeId,
      kind,
      category: selCat,
      from,
      to,
    }).catch(() => ({ ok: false as const }));
    setRenaming(false);
    if (!res.ok) return void showAlert(rename.t.renameFailed);
    if (kind === "cat") {
      setSelCat(res.to);
      apply({ cat: res.to, sub: selSub });
    } else {
      setSelSub(res.to);
      apply({ sub: res.to });
    }
  }
  const showSubs = !!node && node.subcategories.length > 0;

  function apply(
    next: Partial<{
      q: string;
      cat: string;
      sub: string;
      low: boolean;
      pin: boolean;
    }>,
  ) {
    // คำค้นเป็นบาร์โค้ด (ตัวเลขล้วน ≥6 หลัก) แล้วไปเลือกหมวด/ปักหมุด/ใกล้หมด → ล้างบาร์โค้ดทิ้ง
    // ไม่งั้นหมวดอื่นจะว่างเปล่าเพราะยังค้นรหัสสินค้าชิ้นเดียวอยู่ (ผู้ใช้งง)
    if (!("q" in next) && /^\d{6,}$/.test(state.current.q.trim())) {
      next = { ...next, q: "" };
      clearTimeout(timer.current);
      setText("");
    }
    state.current = { ...state.current, ...next };
    // คงพารามิเตอร์อื่นของหน้า (เช่น หน้าประวัติ: ร้านที่ซื้อ/วันที่/ประเภท) — เปลี่ยนตัวกรองสินค้า = ออกจากมุมมองสินค้าเดียว
    const p = new URLSearchParams(window.location.search);
    for (const k of ["q", "cat", "sub", "low", "pin", "product"]) p.delete(k);
    if (state.current.q.trim()) p.set("q", state.current.q.trim());
    if (state.current.cat) p.set("cat", state.current.cat);
    if (state.current.cat && state.current.sub) p.set("sub", state.current.sub);
    if (state.current.low) p.set("low", "1");
    if (state.current.pin) p.set("pin", "1");
    const qs = p.toString();
    rememberFilters(pathname, qs); // ก่อนเปลี่ยนหน้า — ไม่งั้นล้างตัวกรองจนว่างแล้ว server พากลับไปตัวกรองเก่า
    startTransition(() =>
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
    );
  }

  // ยิงบาร์โค้ด (ScanToSearch) เปลี่ยน URL → ช่องค้นหาตามให้
  useEffect(() => {
    setText(q); // eslint-disable-line react-hooks/set-state-in-effect -- sync กับ URL
    state.current.q = q;
  }, [q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // จำตัวกรองที่กำลังดูอยู่ (8 ชม.) → ออกไปเพิ่ม/แก้ไขสินค้า/หน้าอื่น แล้วกลับมาแบบไม่มีพารามิเตอร์
  // = server/filters.ts พากลับมาตัวกรองเดิม; ล้างตัวกรองจนว่าง = ลบที่จำไว้
  const search = useSearchParams().toString();
  useEffect(() => rememberFilters(pathname, search), [pathname, search]);

  const chip = (value: string, label: string) => (
    <button
      key={value || "all"}
      type="button"
      onClick={() => {
        setSelSub(value);
        apply({ sub: value });
      }}
      aria-pressed={selSub === value}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm transition active:scale-95 ${
        selSub === value
          ? "border-brand bg-brand-soft font-semibold text-brand-ink"
          : "border-line bg-card hover:border-brand"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2" role="search">
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-48 basis-full sm:basis-0 sm:flex-1">
          {pending ? (
            <LoaderCircle className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />
          ) : (
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          )}
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              clearTimeout(timer.current);
              const v = e.target.value;
              timer.current = setTimeout(() => apply({ q: v }), 300);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                clearTimeout(timer.current);
                apply({ q: e.currentTarget.value });
              }
            }}
            placeholder={labels.search}
            aria-label={labels.search}
            className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-20 outline-none focus:border-brand sm:py-2"
          />
          {text && (
            <button
              type="button"
              onClick={() => {
                setText("");
                clearTimeout(timer.current);
                apply({ q: "" });
              }}
              aria-label="clear"
              className="absolute right-11 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-surface"
            >
              <X className="size-4" />
            </button>
          )}
          {/* สแกนด้วยกล้อง (มือถือ/แท็บเล็ต/เว็บแคม) */}
          <button
            type="button"
            onClick={() => setCamera(true)}
            aria-label={scan.button}
            title={scan.button}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg bg-brand text-white shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <Camera className="size-5" />
          </button>
        </label>
        <select
          value={selCat}
          onChange={(e) => {
            setSelCat(e.target.value);
            setSelSub(""); // เปลี่ยนหมวดหลัก → หมวดย่อยกลับเป็น "ทั้งหมด"
            apply({ cat: e.target.value, sub: "" });
          }}
          aria-label={labels.allCategories}
          className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 font-medium sm:flex-none sm:font-normal"
        >
          <option value="">{labels.allCategories}</option>
          {tree.map((n) => (
            <option key={n.category} value={n.category}>
              {n.category}
              {n.subcategories.length ? ` (${n.subcategories.length})` : ""}
            </option>
          ))}
        </select>
        {rename && selCat && (
          <button
            type="button"
            onClick={() => renameIt("cat")}
            disabled={renaming}
            aria-label={rename.t.renameCat}
            title={rename.t.renameCat}
            className="grid w-10 shrink-0 place-items-center rounded-xl border border-line bg-card text-muted transition hover:border-brand hover:text-brand-ink active:scale-95 disabled:opacity-50"
          >
            <Pencil className="size-4" />
          </button>
        )}
        {/* มือถือ: หมวดหมู่ได้ที่กว้างสุด (สำคัญกว่า) — ปักหมุด/ใกล้หมด เหลือแค่ไอคอน */}
        <button
          type="button"
          aria-pressed={selPin}
          aria-label={labels.pinOnly}
          title={labels.pinOnly}
          onClick={() => {
            setSelPin(!selPin);
            apply({ pin: !selPin });
          }}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition active:scale-95 ${
            selPin
              ? "border-brand bg-brand-soft font-semibold text-brand-ink"
              : "border-line bg-card"
          }`}
        >
          <Pin className={`size-4 ${selPin ? "fill-current" : ""}`} />
          <span className="hidden sm:inline">{labels.pinOnly}</span>
        </button>
        <button
          type="button"
          aria-pressed={selLow}
          aria-label={labels.lowOnly}
          title={labels.lowOnly}
          onClick={() => {
            setSelLow(!selLow);
            apply({ low: !selLow });
          }}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition active:scale-95 ${
            selLow
              ? "border-amber-500 bg-amber-50 font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              : "border-line bg-card"
          }`}
        >
          <TriangleAlert className="size-4" />
          <span className="hidden sm:inline">{labels.lowOnly}</span>
        </button>
      </div>
      {camera && (
        <CameraScanner
          onDetected={(code) => {
            setCamera(false);
            onScanned(code);
          }}
          onClose={() => setCamera(false)}
          labels={scan}
        />
      )}
      {showSubs && (
        <div
          ref={subRow}
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {chip("", labels.allSub)}
          {/* ปุ่มดินสออยู่ติดหมวดย่อยที่เลือก (เดิมอยู่ท้ายแถว เลื่อนจนมองไม่เห็นบนมือถือ) */}
          {node.subcategories.map((s) => [
            chip(s, s),
            rename && selSub === s && (
              <button
                key={`${s}-rename`}
                type="button"
                onClick={() => renameIt("sub")}
                disabled={renaming}
                aria-label={rename.t.renameSub}
                title={rename.t.renameSub}
                className="-ml-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-brand/60 bg-card text-brand-ink transition active:scale-95 disabled:opacity-50"
              >
                <Pencil className="size-3.5" />
              </button>
            ),
          ])}
          {node.hasNoSub && chip(NO_SUB, labels.noSub)}
        </div>
      )}
    </div>
  );
}
