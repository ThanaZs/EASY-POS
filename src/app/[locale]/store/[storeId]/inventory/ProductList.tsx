"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  CheckSquare,
  ImageOff,
  LoaderCircle,
  Pin,
  Tag,
  X,
} from "lucide-react";
import { fill, formatMoney, parseMoney } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";
import { bulkPriceAction, togglePinAction } from "./actions";
import { StockText } from "./StockBadge";

export type Row = {
  id: string;
  name: string;
  img: string | null;
  catPath: string;
  priceMinor: number;
  costMinor: number;
  pinned: boolean;
  stock: {
    trackStock: boolean;
    stockQty: number;
    lowStockThreshold: number;
    unit: string;
  };
};
type Field = "price" | "cost";
type Mode = "set" | "inc" | "dec";
type Unit = "money" | "pct";

/**
 * รายการสินค้าในคลัง + โหมด "เลือก" สำหรับแก้ราคาหลายชิ้นพร้อมกัน:
 * แตะ "เลือก" → แตะแถวเพื่อติ๊ก (หรือ "เลือกทั้งหมด" ตามตัวกรอง/หมวดที่เปิดอยู่ แล้วเอาตัวที่ไม่ใช่ออก)
 * → "แก้ราคา" → ตั้งเป็นราคาเดียว / เพิ่ม / ลด (บาท หรือ %) พร้อมดูตัวอย่างก่อนบันทึก
 */
export function ProductList({
  rows,
  locale,
  storeId,
  currency,
  base,
  canEdit,
  showImages,
  countText,
  sortMenu,
  t,
  stockT,
}: {
  rows: Row[];
  locale: string;
  storeId: string;
  currency: string;
  base: string;
  canEdit: boolean;
  showImages: boolean;
  countText: string;
  sortMenu: React.ReactNode;
  t: Dictionary["inventory"]["bulk"] & {
    empty: string;
    pin: string;
    unpin: string;
    price: string;
    cost: string;
  };
  stockT: { noTrack: string; out: string; low: string };
}) {
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState(false);
  const money = (m: number) => formatMoney(m, currency, locale);
  // รายการเปลี่ยน (เปลี่ยนตัวกรอง) → ตัดตัวที่ไม่อยู่ในรายการแล้วออก
  const visible = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  useEffect(() => {
    setSel((s) => new Set([...s].filter((id) => visible.has(id)))); // eslint-disable-line react-hooks/set-state-in-effect -- sync กับรายการจาก server
  }, [visible]);

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allOn = rows.length > 0 && sel.size === rows.length;
  const stop = () => {
    setSelecting(false);
    setSel(new Set());
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{countText}</p>
        <div className="flex items-center gap-1">
          {canEdit && rows.length > 0 && !selecting && (
            <button
              type="button"
              onClick={() => setSelecting(true)}
              className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm text-muted transition hover:bg-card hover:text-ink"
            >
              <CheckSquare className="size-4" /> {t.select}
            </button>
          )}
          {sortMenu}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">
          {t.empty}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {rows.map((p) => {
            const on = sel.has(p.id);
            const body = (
              <>
                {showImages && (
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface">
                    {p.img ? (
                      // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage
                      <img
                        src={p.img}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageOff className="size-4 text-line" />
                    )}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[15px] font-medium leading-snug">
                    {p.name}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-muted">
                    <span className="md:hidden">
                      <StockText p={p.stock} t={stockT} />
                      {" · "}
                    </span>
                    {p.catPath}
                  </p>
                </div>
                <span className="hidden w-44 shrink-0 text-right text-sm md:block">
                  <StockText p={p.stock} t={stockT} />
                </span>
                <span className="shrink-0 text-right text-base font-semibold tabular-nums md:w-28">
                  {money(p.priceMinor)}
                </span>
              </>
            );
            return (
              <li
                key={p.id}
                className={`flex items-center border-b border-line last:border-b-0 ${on ? "bg-brand-soft/60" : ""}`}
              >
                {selecting ? (
                  // โหมดเลือก: ทั้งแถวเป็นปุ่มติ๊ก
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-4 text-left"
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-md border-2 transition ${
                        on ? "border-brand bg-brand text-white" : "border-line bg-card"
                      }`}
                    >
                      {on && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    {body}
                  </button>
                ) : (
                  <>
                    {canEdit ? (
                      <form action={togglePinAction} className="shrink-0">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="storeId" value={storeId} />
                        <input type="hidden" name="productId" value={p.id} />
                        <input
                          type="hidden"
                          name="pinned"
                          value={p.pinned ? "0" : "1"}
                        />
                        <button
                          type="submit"
                          aria-label={p.pinned ? t.unpin : t.pin}
                          title={p.pinned ? t.unpin : t.pin}
                          className={`grid h-16 w-10 place-items-center transition active:scale-90 ${
                            p.pinned ? "text-brand" : "text-line hover:text-muted"
                          }`}
                        >
                          <Pin
                            className={`size-4 ${p.pinned ? "fill-current" : ""}`}
                          />
                        </button>
                      </form>
                    ) : (
                      p.pinned && (
                        <Pin className="mx-2.5 size-4 shrink-0 fill-current text-brand" />
                      )
                    )}
                    {canEdit ? (
                      <Link
                        prefetch={false}
                        href={`${base}/${p.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 row-hover"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-4">
                        {body}
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* แถบคำสั่งตอนเลือก (ติดล่างจอ ทับปุ่ม + ) */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
            <button
              type="button"
              onClick={stop}
              aria-label={t.cancel}
              className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface"
            >
              <X className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {fill(t.selected, { n: sel.size })}
              </p>
              <button
                type="button"
                onClick={() =>
                  setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)))
                }
                className="text-sm text-brand-ink underline-offset-2 hover:underline"
              >
                {allOn ? t.clearAll : fill(t.selectAll, { n: rows.length })}
              </button>
            </div>
            <button
              type="button"
              disabled={sel.size === 0}
              onClick={() => setDialog(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white transition active:scale-95 disabled:opacity-40"
            >
              <Tag className="size-4" /> {t.editPrice}
            </button>
          </div>
        </div>
      )}
      {selecting && <div className="h-20" />}

      {dialog && (
        <BulkDialog
          rows={rows.filter((r) => sel.has(r.id))}
          locale={locale}
          storeId={storeId}
          currency={currency}
          t={t}
          onClose={() => setDialog(false)}
          onDone={() => {
            setDialog(false);
            stop();
          }}
        />
      )}
    </>
  );
}

function BulkDialog({
  rows,
  locale,
  storeId,
  currency,
  t,
  onClose,
  onDone,
}: {
  rows: Row[];
  locale: string;
  storeId: string;
  currency: string;
  t: Dictionary["inventory"]["bulk"] & { price: string; cost: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [field, setField] = useState<Field>("price");
  const [mode, setMode] = useState<Mode>("set");
  const [unit, setUnit] = useState<Unit>("money");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const money = (m: number) => formatMoney(m, currency, locale);
  const pct = mode !== "set" && unit === "pct";

  // คำนวณตัวอย่าง (เหมือนฝั่ง server)
  const clean = value.replace(/[,\s]/g, "");
  const num = pct
    ? /^\d+(\.\d{1,2})?$/.test(clean)
      ? Number(clean)
      : null
    : clean
      ? parseMoney(clean, currency)
      : null;
  const next = (old: number) => {
    if (num === null) return old;
    const sign = mode === "dec" ? -1 : 1;
    return Math.max(
      0,
      mode === "set"
        ? num
        : pct
          ? Math.round((old * (1 + (sign * num) / 100)) / 100) * 100 // ปัดเป็นบาทเต็ม
          : old + sign * num,
    );
  };
  const key = field === "cost" ? "costMinor" : "priceMinor";

  function save() {
    setError("");
    if (num === null) return setError(t.invalid);
    start(async () => {
      const res = await bulkPriceAction({
        locale,
        storeId,
        ids: rows.map((r) => r.id),
        field,
        mode,
        unit,
        value: clean,
      });
      if (res.ok) onDone();
      else setError(t.invalid);
    });
  }

  const seg = <T extends string>(
    cur: T,
    set: (v: T) => void,
    opts: Array<[T, string]>,
  ) => (
    <div className="flex rounded-xl bg-surface p-1">
      {opts.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => set(v)}
          aria-pressed={cur === v}
          className={`flex-1 rounded-lg px-2 py-2 text-sm transition ${
            cur === v ? "bg-card font-semibold text-brand-ink shadow-sm" : "text-muted"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-end bg-black/40 sm:place-items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-card shadow-2xl sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-bold">
            {fill(t.title, { n: rows.length })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.cancel}
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-5">
          {seg(field, setField, [
            ["price", t.price],
            ["cost", t.cost],
          ])}
          {seg(mode, setMode, [
            ["set", t.modeSet],
            ["inc", t.modeInc],
            ["dec", t.modeDec],
          ])}
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              autoFocus
              placeholder="0"
              aria-label={t.amount}
              className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2.5 text-lg font-semibold tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
            />
            {mode !== "set" && (
              <div className="w-32 shrink-0">
                {seg(unit, setUnit, [
                  ["money", "฿"],
                  ["pct", "%"],
                ])}
              </div>
            )}
          </div>

          {/* ตัวอย่าง: ชื่อ ราคาเดิม → ใหม่ */}
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {rows.slice(0, 6).map((r) => {
              const old = r[key];
              const nv = next(old);
              return (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="shrink-0 tabular-nums text-muted line-through decoration-1">
                    {nv !== old ? money(old) : ""}
                  </span>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${nv !== old ? "text-brand-ink" : ""}`}
                  >
                    {money(nv)}
                  </span>
                </li>
              );
            })}
            {rows.length > 6 && (
              <li className="px-3 py-2 text-center text-xs text-muted">
                {fill(t.more, { n: rows.length - 6 })}
              </li>
            )}
          </ul>
          {error && (
            <p className="text-sm font-medium text-rose-600" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="border-t border-line p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={save}
            disabled={pending || num === null}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            {fill(t.save, { n: rows.length })}
          </button>
        </div>
      </div>
    </div>
  );
}
