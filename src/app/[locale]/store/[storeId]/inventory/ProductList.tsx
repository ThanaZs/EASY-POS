"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Check,
  ImageOff,
  ListChecks,
  LoaderCircle,
  Pin,
  PinOff,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { fill, formatMoney, parseMoney } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";
import { bulkPinAction, bulkPriceAction, bulkTrashAction } from "./actions";

export type Row = {
  id: string;
  name: string;
  img: string | null;
  /** แตะแถวแล้วไปไหน (null = แตะไม่ได้) */
  href: string | null;
  pinned: boolean;
  /** บรรทัดที่ 2 ใต้ชื่อ */
  sub: React.ReactNode;
  /** ส่วนขวาของแถว (ราคา / คงเหลือ / วันที่ ฯลฯ) */
  aside: React.ReactNode;
  priceMinor: number;
  costMinor: number;
};
type Field = "price" | "cost";
type Mode = "set" | "inc" | "dec";
type Unit = "money" | "pct";
export type ListT = Dictionary["inventory"]["bulk"] & {
  empty: string;
  pin: string;
  unpin: string;
  price: string;
  cost: string;
};

/** ความกว้างปุ่มที่โผล่ตอนปัดแถว (2 ปุ่ม) */
const SWIPE_W = 148;

/** หมุดเอียงมุมซ้ายบนของรูปสินค้า = สินค้าปักหมุด */
function PinBadge({ inline = false }: { inline?: boolean }) {
  return (
    <span
      aria-hidden
      className={`${inline ? "relative mr-1 inline-grid align-[-2px]" : "absolute -left-1.5 -top-1.5 grid"} size-5 place-items-center rounded-full bg-brand text-white shadow ring-2 ring-card`}
    >
      <Pin className="size-3 rotate-45 fill-current" strokeWidth={2.5} />
    </span>
  );
}

/**
 * รายการสินค้า (คลังสินค้า / ประวัติสินค้า):
 * - ปัดแถวไปทางซ้าย → ปุ่ม ปักหมุด / ลบ โผล่ทางขวา (ย้ายไปถังขยะ)
 * - "เลือก" (ซ้ายบน) → ติ๊กหลายรายการ หรือ "ทั้งหมด" ในหมวด/ตัวกรองที่เปิดอยู่
 *   → ปักหมุด / ลบ / แก้ราคา พร้อมกัน
 * - สินค้าปักหมุด = หมุดเอียงที่มุมซ้ายบนของรูป
 */
export function ProductList({
  rows,
  locale,
  storeId,
  currency,
  canPin,
  canDelete,
  canPrice,
  showImages,
  countText,
  scopeLabel,
  sortMenu,
  t,
}: {
  rows: Row[];
  locale: string;
  storeId: string;
  currency: string;
  canPin: boolean;
  canDelete: boolean;
  canPrice: boolean;
  showImages: boolean;
  countText: string;
  /** ชื่อหมวด/หมวดย่อยที่เปิดอยู่ — "เลือกทั้งหมดใน …" */
  scopeLabel?: string;
  sortMenu: React.ReactNode;
  t: ListT;
}) {
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  /** รายการที่รอยืนยันลบ */
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canSelect = canPin || canDelete || canPrice;
  const trashHref = `/${locale}/store/${storeId}/inventory/trash`;
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
  const picked = rows.filter((r) => sel.has(r.id));
  // เลือกแล้วมีตัวที่ยังไม่ปักหมุด → ปุ่ม "ปักหมุด"; ปักหมุดหมดแล้ว → "เลิกปักหมุด"
  const pinAll = picked.some((r) => !r.pinned);

  function pin(ids: string[], pinned: boolean) {
    setOpenId(null);
    start(async () => {
      await bulkPinAction({ locale, storeId, ids, pinned });
      if (selecting) stop();
    });
  }
  function trash(ids: string[]) {
    start(async () => {
      const res = await bulkTrashAction({ locale, storeId, ids });
      setConfirmIds(null);
      setOpenId(null);
      if (selecting) stop();
      if (res.n) setNotice(fill(t.deleted, { n: res.n }));
    });
  }

  const allLabel = scopeLabel
    ? fill(t.allIn, { cat: scopeLabel, n: rows.length })
    : fill(t.selectAll, { n: rows.length });

  return (
    <>
      {notice && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-ink"
        >
          <Trash2 className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {notice}{" "}
            <Link
              prefetch={false}
              href={trashHref}
              className="font-semibold underline"
            >
              {t.openTrash}
            </Link>
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label={t.cancel}
            className="grid size-7 place-items-center rounded-full hover:bg-card"
          >
            <X className="size-4" />
          </button>
        </p>
      )}

      {/* แถวบน: [เลือก] ซ้ายสุด · จำนวน · เรียง (ขวา) — ตอนเลือก: [☐ ทั้งหมด] [ยกเลิก] */}
      <div className="flex min-h-9 items-center gap-2">
        {selecting ? (
          <>
            <button
              type="button"
              onClick={() =>
                setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)))
              }
              aria-pressed={allOn}
              className="flex min-w-0 items-center gap-2 rounded-lg py-1 pr-2 text-sm font-medium"
            >
              <Box on={allOn} part={sel.size > 0 && !allOn} />
              <span className="truncate">{allLabel}</span>
            </button>
            <button
              type="button"
              onClick={stop}
              className="ml-auto shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-brand-ink hover:bg-card"
            >
              {t.cancel}
            </button>
          </>
        ) : (
          <>
            {canSelect && rows.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOpenId(null);
                  setSelecting(true);
                }}
                className="-ml-1.5 inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-brand-ink transition hover:bg-card"
              >
                <ListChecks className="size-4" /> {t.select}
              </button>
            )}
            <p className="min-w-0 truncate text-xs text-muted">{countText}</p>
            <div className="ml-auto shrink-0">{sortMenu}</div>
          </>
        )}
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
                  <span className="relative shrink-0">
                    <span className="grid size-12 place-items-center overflow-hidden rounded-xl bg-surface">
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
                    {p.pinned && <PinBadge />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[15px] font-medium leading-snug">
                    {!showImages && p.pinned && <PinBadge inline />}
                    {p.name}
                  </p>
                  <div className="mt-0.5 truncate text-[13px] text-muted">
                    {p.sub}
                  </div>
                </div>
                {p.aside}
              </>
            );
            const rowCls =
              "flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-4 text-left";
            return (
              <li
                key={p.id}
                className={`relative border-b border-line last:border-b-0 ${on ? "bg-brand-soft/60" : ""}`}
              >
                {selecting ? (
                  // โหมดเลือก: ทั้งแถวเป็นปุ่มติ๊ก
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    className={`${rowCls} w-full pl-3`}
                  >
                    <Box on={on} />
                    {body}
                  </button>
                ) : (
                  <SwipeRow
                    open={openId === p.id}
                    onOpen={(o) =>
                      setOpenId((cur) => (o ? p.id : cur === p.id ? null : cur))
                    }
                    actions={
                      canPin || canDelete ? (
                        <>
                          {canPin && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => pin([p.id], !p.pinned)}
                              className="flex flex-1 flex-col items-center justify-center gap-1 bg-amber-500 text-xs font-semibold text-white active:brightness-90 disabled:opacity-60"
                            >
                              {p.pinned ? (
                                <PinOff className="size-5" />
                              ) : (
                                <Pin className="size-5 rotate-45" />
                              )}
                              {p.pinned ? t.unpinIt : t.pinIt}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => setConfirmIds([p.id])}
                              className="flex flex-1 flex-col items-center justify-center gap-1 bg-rose-600 text-xs font-semibold text-white active:brightness-90 disabled:opacity-60"
                            >
                              <Trash2 className="size-5" />
                              {t.delete}
                            </button>
                          )}
                        </>
                      ) : null
                    }
                  >
                    {p.href ? (
                      <Link
                        prefetch={false}
                        href={p.href}
                        draggable={false}
                        className={`${rowCls} row-hover`}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className={rowCls}>{body}</div>
                    )}
                  </SwipeRow>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* แถบคำสั่งตอนเลือก (ติดล่างจอ ทับปุ่ม + ) */}
      {selecting && (
        <div className="select-bar fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-3 py-2">
            <p className="min-w-0 flex-1 truncate pl-1 font-semibold">
              {fill(t.selected, { n: sel.size })}
            </p>
            {canPin && (
              <BarBtn
                disabled={sel.size === 0 || pending}
                onClick={() => pin([...sel], pinAll)}
                icon={
                  pinAll || sel.size === 0 ? (
                    <Pin className="size-5 rotate-45" />
                  ) : (
                    <PinOff className="size-5" />
                  )
                }
                label={pinAll || sel.size === 0 ? t.pinIt : t.unpinIt}
              />
            )}
            {canDelete && (
              <BarBtn
                danger
                disabled={sel.size === 0 || pending}
                onClick={() => setConfirmIds([...sel])}
                icon={<Trash2 className="size-5" />}
                label={t.delete}
              />
            )}
            {canPrice && (
              <BarBtn
                primary
                disabled={sel.size === 0 || pending}
                onClick={() => setDialog(true)}
                icon={<Tag className="size-5" />}
                label={t.editPrice}
              />
            )}
          </div>
        </div>
      )}
      {selecting && <div className="h-20" />}

      {confirmIds && (
        <div
          className="fixed inset-0 z-[60] grid place-items-end bg-black/40 sm:place-items-center"
          onClick={() => !pending && setConfirmIds(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full space-y-4 rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-sm sm:rounded-3xl"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950">
                <Trash2 className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold">{t.deleteTitle}</h2>
                <p className="text-sm text-muted">
                  {confirmIds.length === 1
                    ? `“${rows.find((r) => r.id === confirmIds[0])?.name ?? ""}” — `
                    : ""}
                  {fill(t.deleteMsg, { n: confirmIds.length })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmIds(null)}
                className="flex-1 rounded-xl border border-line px-4 py-3 font-semibold"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => trash(confirmIds)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white active:scale-[0.98] disabled:opacity-60"
              >
                {pending && <LoaderCircle className="size-4 animate-spin" />}
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <BulkDialog
          rows={picked}
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

/** ช่องติ๊ก (part = เลือกบางส่วน) */
function Box({ on, part = false }: { on: boolean; part?: boolean }) {
  return (
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-md border-2 transition ${
        on || part ? "border-brand bg-brand text-white" : "border-line bg-card"
      }`}
    >
      {on ? (
        <Check className="size-4" strokeWidth={3} />
      ) : part ? (
        <span className="h-0.5 w-3 rounded bg-white" />
      ) : null}
    </span>
  );
}

function BarBtn({
  icon,
  label,
  onClick,
  disabled,
  danger,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-w-16 shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-40 ${
        primary
          ? "bg-brand text-white"
          : danger
            ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
            : "text-ink hover:bg-surface"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * แถวที่ปัดไปทางซ้ายได้ → ปุ่มคำสั่งโผล่ทางขวา (ใช้นิ้วเท่านั้น; คอมใช้โหมด "เลือก")
 * ปัดแนวตั้ง = เลื่อนหน้าตามปกติ; แตะแถวที่เปิดอยู่ = ปิด (ไม่เปิดหน้าสินค้า)
 */
function SwipeRow({
  open,
  onOpen,
  actions,
  children,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const g = useRef({ x0: 0, y0: 0, base: 0, x: 0, axis: "" as "" | "x" | "y" });
  const swallow = useRef(false);
  const place = (x: number, animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animate ? "transform 200ms ease" : "none";
    el.style.transform = x ? `translateX(${x}px)` : "";
    // ซ่อนปุ่มข้างหลังตอนปิด (กันขอบสีโผล่ใต้แถว)
    const pn = panel.current;
    if (!pn) return;
    clearTimeout(Number(pn.dataset.t));
    if (x) pn.style.visibility = "visible";
    else
      pn.dataset.t = String(
        setTimeout(() => (pn.style.visibility = "hidden"), animate ? 220 : 0),
      );
  };
  // เปิด/ปิดจากข้างนอก (เช่น ปัดแถวอื่น → แถวนี้ปิด)
  useEffect(() => place(open ? -SWIPE_W : 0, true), [open]);

  if (!actions) return <div className="flex">{children}</div>;
  return (
    <>
      <div
        ref={panel}
        className="absolute inset-y-0 right-0 flex"
        style={{ width: SWIPE_W, visibility: "hidden" }}
        aria-hidden={!open}
      >
        {actions}
      </div>
      <div
        ref={ref}
        className="relative flex bg-card"
        style={{ touchAction: "pan-y" }}
        onTouchStart={(e) => {
          const p = e.touches[0];
          g.current = {
            x0: p.clientX,
            y0: p.clientY,
            base: open ? -SWIPE_W : 0,
            x: open ? -SWIPE_W : 0,
            axis: "",
          };
        }}
        onTouchMove={(e) => {
          const s = g.current;
          const p = e.touches[0];
          const dx = p.clientX - s.x0;
          const dy = p.clientY - s.y0;
          if (!s.axis) {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) s.axis = "x";
            else if (Math.abs(dy) > 8) s.axis = "y";
          }
          if (s.axis !== "x") return;
          s.x = Math.min(0, Math.max(-SWIPE_W - 24, s.base + dx));
          place(s.x, false);
        }}
        onTouchEnd={() => {
          const s = g.current;
          if (s.axis === "x") {
            swallow.current = true; // ปัดจบ ≠ แตะเปิดหน้าสินค้า
            setTimeout(() => (swallow.current = false), 400);
            const o = s.x < -SWIPE_W / 2;
            place(o ? -SWIPE_W : 0, true);
            onOpen(o);
          } else if (!s.axis && open) {
            swallow.current = true; // แตะแถวที่เปิดอยู่ = ปิด
            setTimeout(() => (swallow.current = false), 400);
            place(0, true);
            onOpen(false);
          }
        }}
        onClickCapture={(e) => {
          if (swallow.current) {
            swallow.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {children}
      </div>
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
