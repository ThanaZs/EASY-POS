"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Camera,
  LoaderCircle,
  PauseCircle,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { calcSaleTotals } from "@/core/domain/sale";
import { PrinterStatus } from "@/components/devices/PrinterStatus";
import { ScannerStatus } from "@/components/devices/ScannerStatus";
import { getAutoPrint, printSlip } from "@/client/devices/printer";
import { toEnglishLayout, useBarcodeScanner } from "@/client/devices/scanner";
import { receiptToSlip } from "@/client/devices/slip";
import type { PaymentMethod } from "@/core/domain/types";
import {
  fill,
  formatDateTime,
  formatMoney,
  parseMoney,
} from "@/core/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { checkoutAction } from "./actions";
import { PosScanView } from "./PosScanView";
import { Receipt, type ReceiptData } from "./Receipt";

export type PosProduct = {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  barcode: string | null;
  sku: string | null;
  priceMinor: number;
  stockQty: number;
  trackStock: boolean;
  unit: string;
  imageUrl: string | null;
  // ขายยกแพ็ก/ลัง (null = ขายปลีกอย่างเดียว)
  packUnit: string | null;
  packSize: number | null;
  packPriceMinor: number | null; // ราคาต่อแพ็ก (คำนวณแล้ว)
  packBarcode: string | null;
  pinned: boolean; // ปักหมุด (มาเรียงก่อนจากฝั่ง server แล้ว)
};

type Unit = "base" | "pack";
/** บิลที่พักไว้ (เก็บในเครื่องนี้ — localStorage แยกตามร้าน) */
type HeldBill = {
  id: string;
  at: number;
  cart: Array<[string, number]>;
  discountText: string;
};
function makeHeld(cart: Map<string, number>, discountText: string): HeldBill {
  const now = Date.now();
  return { id: String(now), at: now, cart: [...cart.entries()], discountText };
}
/** คีย์ในตะกร้า: สินค้าเดียวกันขายปลีกกับยกลังแยกบรรทัด */
const keyOf = (id: string, unit: Unit) => `${id}|${unit}`;
const parseKey = (k: string) => {
  const [id, unit] = k.split("|");
  return { id, unit: (unit === "pack" ? "pack" : "base") as Unit };
};

type Props = {
  locale: Locale;
  storeId: string;
  storeName: string;
  cashierName: string;
  currency: string;
  timeZone: string;
  taxRateBp: number;
  taxIncluded: boolean;
  canDiscount: boolean;
  allowNegativeStock: boolean;
  receiptFooter: string;
  products: PosProduct[];
  t: {
    pos: Dictionary["pos"];
    store: { back: string };
    scan: Dictionary["scan"];
    devices: Dictionary["devices"];
  };
};

const METHODS: PaymentMethod[] = ["cash", "qr", "card", "transfer"];

export function PosClient(props: Props) {
  const { locale, currency, products, t } = props;
  const router = useRouter();
  const money = (m: number) => formatMoney(m, currency, locale);

  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [discountText, setDiscountText] = useState("");
  const [cartOpen, setCartOpen] = useState(false); // มือถือ
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [receivedText, setReceivedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const [held, setHeld] = useState<HeldBill[]>([]);
  const [heldOpen, setHeldOpen] = useState(false);
  const heldKey = `ep_held_${props.storeId}`;
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(heldKey) ?? "[]");
      if (Array.isArray(raw)) setHeld(raw as HeldBill[]); // eslint-disable-line react-hooks/set-state-in-effect -- อ่านได้เฉพาะใน browser
    } catch {
      // ignore
    }
  }, [heldKey]);
  function saveHeld(next: HeldBill[]) {
    setHeld(next);
    try {
      localStorage.setItem(heldKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  /** พักบิลปัจจุบัน → ตะกร้าว่าง เริ่มบิลใหม่ได้ */
  function holdBill() {
    if (cart.size === 0) return;
    const bill: HeldBill = makeHeld(cart, discountText);
    saveHeld([bill, ...held]);
    setCart(new Map());
    setDiscountText("");
    setCartOpen(false);
    setScanStatus(t.pos.heldDone);
  }
  /** เรียกบิลที่พักกลับมา — ถ้าตะกร้าตอนนี้มีของ พักบิลปัจจุบันไว้แทน (สลับกัน) */
  function resumeBill(id: string) {
    const bill = held.find((b) => b.id === id);
    if (!bill) return;
    let rest = held.filter((b) => b.id !== id);
    if (cart.size > 0) rest = [makeHeld(cart, discountText), ...rest];
    saveHeld(rest);
    setCart(new Map(bill.cart.filter(([k]) => byId.has(parseKey(k).id))));
    setDiscountText(bill.discountText);
    setHeldOpen(false);
    setScanStatus(null);
  }
  const billTotal = (b: HeldBill) =>
    b.cart.reduce((sum, [k, q]) => {
      const { id, unit } = parseKey(k);
      const p = byId.get(id);
      if (!p) return sum;
      const price =
        unit === "pack"
          ? (p.packPriceMinor ?? p.priceMinor * (p.packSize ?? 1))
          : p.priceMinor;
      return sum + price * q;
    }, 0);

  const categories = useMemo(
    () =>
      [
        ...new Set(
          products
            .map((p) => p.category)
            .filter((c): c is string => Boolean(c)),
        ),
      ].sort(),
    [products],
  );
  const subcategories = useMemo(
    () =>
      category
        ? [
            ...new Set(
              products
                .filter((p) => p.category === category)
                .map((p) => p.subcategory)
                .filter((c): c is string => Boolean(c)),
            ),
          ].sort()
        : [],
    [products, category],
  );
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const en = toEnglishLayout(search.trim());
    return products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!subcategory || p.subcategory === subcategory) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.barcode === search.trim() ||
          p.barcode === en ||
          p.packBarcode === en ||
          p.sku?.toLowerCase().includes(q)),
    );
  }, [products, search, category, subcategory]);

  const mult = (p: PosProduct, unit: Unit) =>
    unit === "pack" ? (p.packSize ?? 1) : 1;
  const lines = [...cart.entries()]
    .map(([key, qty]) => {
      const { id, unit } = parseKey(key);
      const p = byId.get(id);
      if (!p) return null;
      const unitPriceMinor =
        unit === "pack"
          ? (p.packPriceMinor ?? p.priceMinor * (p.packSize ?? 1))
          : p.priceMinor;
      const label =
        unit === "pack" ? `${p.name} (${p.packUnit} ×${p.packSize})` : p.name;
      return { key, p, unit, qty, unitPriceMinor, label };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const discountMinor = props.canDiscount
    ? Math.max(0, parseMoney(discountText, currency) ?? 0)
    : 0;
  const totals = calcSaleTotals(
    lines.map((l) => ({
      productId: l.p.id,
      name: l.label,
      qty: l.qty,
      unitPriceMinor: l.unitPriceMinor,
      costMinor: 0,
      discountMinor: 0,
    })),
    {
      billDiscountMinor: discountMinor,
      taxRateBp: props.taxRateBp,
      taxIncluded: props.taxIncluded,
    },
  );
  const receivedMinor = parseMoney(receivedText, currency);
  const changeMinor =
    receivedMinor === null ? -1 : receivedMinor - totals.totalMinor;
  const canConfirm =
    lines.length > 0 &&
    (method !== "cash" || receivedText === "" || changeMinor >= 0);

  const limited = (p: PosProduct) => p.trackStock && !props.allowNegativeStock;
  /** จำนวนชิ้นของสินค้านี้ในตะกร้า (รวมที่ขายยกลัง) */
  const baseInCart = (c: Map<string, number>, p: PosProduct, except?: Unit) =>
    (except === "base" ? 0 : (c.get(keyOf(p.id, "base")) ?? 0)) +
    (except === "pack"
      ? 0
      : (c.get(keyOf(p.id, "pack")) ?? 0) * (p.packSize ?? 1));
  const remaining = (p: PosProduct) =>
    limited(p) ? p.stockQty - baseInCart(cart, p) : Infinity;

  function setQty(key: string, qty: number) {
    const { id, unit } = parseKey(key);
    const p = byId.get(id);
    if (!p) return;
    setCart((prev) => {
      const next = new Map(prev);
      const max = limited(p)
        ? Math.floor((p.stockQty - baseInCart(prev, p, unit)) / mult(p, unit))
        : Infinity;
      const q = Math.min(max, Math.max(0, qty));
      if (q <= 0) next.delete(key);
      else next.set(key, q);
      return next;
    });
    setError(null);
  }
  /** +1 (ชิ้น หรือ ลัง) แบบอ่านค่าล่าสุดจาก state (สแกนรัวๆ ไม่ตกหล่น) */
  function add(p: PosProduct, unit: Unit = "base") {
    if (unit === "pack" && !p.packSize) return;
    setCart((prev) => {
      if (limited(p) && p.stockQty - baseInCart(prev, p) < mult(p, unit))
        return prev;
      const key = keyOf(p.id, unit);
      return new Map(prev).set(key, (prev.get(key) ?? 0) + 1);
    });
    setError(null);
  }

  /** เครื่องสแกนบาร์โค้ดพิมพ์รหัสแล้วกด Enter — อ่านค่าจาก input ตรงๆ เพราะสแกนเร็วกว่า state อัปเดต */
  function onSearchEnter(raw: string) {
    const code = raw.trim();
    if (!code) return;
    const q = code.toLowerCase();
    const en = toEnglishLayout(code); // ยิงตอนคีย์บอร์ดเป็นภาษาไทย
    const packHit = products.find(
      (p) => p.packBarcode && (p.packBarcode === code || p.packBarcode === en),
    );
    if (packHit) {
      add(packHit, "pack");
      setSearch("");
      return;
    }
    const exact = products.find(
      (p) =>
        p.barcode === code ||
        p.sku === code ||
        p.barcode === en ||
        p.sku === en,
    );
    const matches = exact
      ? [exact]
      : products.filter((p) => p.name.toLowerCase().includes(q));
    const target = matches.length === 1 ? matches[0] : null;
    if (target) {
      add(target);
      setSearch("");
    }
  }

  /** กล้อง/เครื่องสแกนเจอบาร์โค้ด → เพิ่มลงตะกร้า (สแกนต่อได้เรื่อยๆ) */
  function onCameraCode(code: string): {
    ok: boolean;
    message: string;
    key?: string;
  } {
    const result = (() => {
      // บาร์โค้ดลัง → ขายยกลัง
      const pack = products.find((x) => x.packBarcode === code);
      if (pack) {
        if (remaining(pack) >= (pack.packSize ?? 1)) {
          add(pack, "pack");
          return {
            ok: true,
            message: fill(t.scan.added, {
              name: `${pack.name} (${pack.packUnit} ×${pack.packSize})`,
            }),
            key: keyOf(pack.id, "pack"),
          };
        }
        return { ok: false, message: `${pack.name}: ${t.pos.outOfStock}` };
      }
      const p = products.find((x) => x.barcode === code || x.sku === code);
      if (p && remaining(p) > 0) {
        add(p);
        return {
          ok: true,
          message: fill(t.scan.added, { name: p.name }),
          key: keyOf(p.id, "base"),
        };
      }
      if (p) return { ok: false, message: `${p.name}: ${t.pos.outOfStock}` };
      return { ok: false, message: fill(t.scan.notFound, { code }) };
    })();
    setScanStatus(result.message);
    return result;
  }

  // เครื่องสแกน (USB/Bluetooth แบบคีย์บอร์ด): ยิงได้เลยไม่ต้องคลิกช่องค้นหา, ภาษาคีย์บอร์ดไม่มีผล
  useBarcodeScanner((code) => {
    if (payOpen || receipt) return; // กำลังชำระเงิน/ดูใบเสร็จ — ไม่หยิบของเพิ่ม
    onCameraCode(code);
  });

  /** พิมพ์ใบเสร็จ: มีเครื่องพิมพ์สลิปที่เชื่อมไว้ → พิมพ์ตรง, ไม่มี → พิมพ์ผ่านเบราว์เซอร์ */
  async function printReceipt(r: ReceiptData) {
    const slip = receiptToSlip({
      r,
      t: t.pos,
      locale,
      currency,
      timeZone: props.timeZone,
      storeName: props.storeName,
      cashierName: props.cashierName,
      footer: props.receiptFooter,
    });
    try {
      if (!(await printSlip(slip))) window.print();
    } catch {
      // สถานะ error แสดงที่ปุ่มเครื่องพิมพ์แล้ว
    }
  }

  function quickAmounts(total: number): number[] {
    const unit = currency === "JPY" || currency === "VND" ? 1 : 100; // หน่วยย่อยต่อ 1 หน่วยหลัก
    const steps = [20, 100, 500, 1000].map((v) => v * unit);
    const out = new Set<number>([total]);
    for (const s of steps) out.add(Math.ceil(total / s) * s);
    return [...out]
      .filter((v) => v >= total)
      .sort((a, b) => a - b)
      .slice(0, 4);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await checkoutAction({
        locale,
        storeId: props.storeId,
        lines: lines.map((l) => ({
          productId: l.p.id,
          qty: l.qty,
          unit: l.unit,
        })),
        discountMinor,
        method,
        paidMinor:
          method === "cash" && receivedText !== "" ? receivedMinor : null,
      });
      if (!res.ok) {
        setError(
          fill(t.pos.errors[res.reason], { name: res.productName ?? "" }),
        );
        return;
      }
      setReceipt(res.receipt);
      if (getAutoPrint()) void printReceipt(res.receipt);
      setCart(new Map());
      setDiscountText("");
      setReceivedText("");
      setPayOpen(false);
      setCartOpen(false);
      router.refresh(); // ดึงสต็อกล่าสุด
    });
  }

  function newSale() {
    setReceipt(null);
    setMethod("cash");
    searchRef.current?.focus();
  }

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line p-3">
        <h2 className="font-semibold">
          {t.pos.cart}{" "}
          {itemCount > 0 && <span className="text-muted">({itemCount})</span>}
        </h2>
        <div className="flex items-center gap-2">
          {lines.length > 0 && (
            <button
              onClick={() => setCart(new Map())}
              className="text-sm text-rose-600 hover:underline"
            >
              {t.pos.clear}
            </button>
          )}
          <button
            onClick={() => setCartOpen(false)}
            className="lg:hidden"
            aria-label={t.pos.cancel}
          >
            <X className="size-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            {t.pos.emptyCart}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map(({ key, p, unit, qty, unitPriceMinor, label }) => (
              <li key={key} className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted tabular-nums">
                    {money(unitPriceMinor)}
                    {unit === "pack" && (
                      <span className="ml-1 rounded bg-brand-soft px-1 text-brand-ink">
                        {p.packUnit}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center rounded-lg border border-line">
                  <button
                    className="p-1.5"
                    onClick={() => setQty(key, qty - 1)}
                    aria-label="-"
                  >
                    {qty === 1 ? (
                      <Trash2 className="size-4 text-rose-600" />
                    ) : (
                      <Minus className="size-4" />
                    )}
                  </button>
                  <input
                    value={qty}
                    onChange={(e) =>
                      setQty(
                        key,
                        Number.parseInt(e.target.value || "0", 10) || 0,
                      )
                    }
                    inputMode="numeric"
                    className="w-10 bg-transparent text-center text-sm tabular-nums outline-none"
                    aria-label={p.name}
                  />
                  <button
                    className="p-1.5 disabled:opacity-30"
                    onClick={() => setQty(key, qty + 1)}
                    disabled={remaining(p) < mult(p, unit)}
                    aria-label="+"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <p className="w-20 text-right text-sm font-semibold tabular-nums">
                  {money(unitPriceMinor * qty)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2 border-t border-line p-3 text-sm">
        {props.canDiscount && (
          <label className="flex items-center justify-between gap-3">
            <span className="text-muted">{t.pos.discount}</span>
            <input
              value={discountText}
              onChange={(e) => setDiscountText(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="w-28 rounded-lg border border-line bg-card px-2 py-1 text-right tabular-nums outline-none focus:border-brand"
            />
          </label>
        )}
        <Row label={t.pos.subtotal} value={money(totals.subtotalMinor)} />
        {totals.discountMinor > 0 && (
          <Row
            label={t.pos.discount}
            value={`-${money(totals.discountMinor)}`}
          />
        )}
        {props.taxRateBp > 0 && (
          <Row
            label={`${t.pos.tax} ${props.taxRateBp / 100}%`}
            value={money(totals.taxMinor)}
          />
        )}
        <div className="flex items-baseline justify-between pt-1">
          <span className="font-semibold">{t.pos.total}</span>
          <span className="text-2xl font-bold tabular-nums text-brand-ink">
            {money(totals.totalMinor)}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            disabled={lines.length === 0}
            onClick={holdBill}
            className="flex items-center justify-center gap-1 rounded-xl border border-line px-4 py-3 font-semibold transition hover:border-brand active:scale-95 disabled:opacity-40"
          >
            <PauseCircle className="size-5" /> {t.pos.hold}
          </button>
          <button
            disabled={lines.length === 0}
            onClick={() => {
              setPayOpen(true);
              setError(null);
            }}
            className="flex-1 rounded-xl bg-brand px-4 py-3 text-lg font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {t.pos.summary}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="print:hidden">
        <div className="grid gap-4 pb-24 lg:grid-cols-[1fr_380px] lg:pb-0">
          <section className="min-w-0 space-y-3">
            <div className="flex flex-wrap gap-2">
              <ScannerStatus t={t.devices} />
              <PrinterStatus t={t.devices} storeName={props.storeName} />
              {held.length > 0 && (
                <button
                  onClick={() => setHeldOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand-ink transition active:scale-95"
                >
                  <PauseCircle className="size-4" />{" "}
                  {fill(t.pos.heldCount, { n: held.length })}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <label className="relative block flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    (e.preventDefault(), onSearchEnter(e.currentTarget.value))
                  }
                  placeholder={t.pos.search}
                  autoComplete="off"
                  className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-3 outline-none focus:border-brand"
                />
              </label>
              <button
                onClick={() => {
                  setScanStatus(null);
                  setScanOpen(true);
                }}
                className="grid w-12 shrink-0 place-items-center rounded-xl bg-brand text-white"
                aria-label={t.scan.button}
                title={t.scan.button}
              >
                <Camera className="size-5" />
              </button>
            </div>
            {scanStatus && !scanOpen && (
              <p
                className="rounded-lg bg-brand-soft px-3 py-1.5 text-sm text-brand-ink"
                role="status"
              >
                {scanStatus}
              </p>
            )}
            {categories.length > 0 && (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {[null, ...categories].map((c) => (
                  <button
                    key={c ?? "*"}
                    onClick={() => {
                      setCategory(c);
                      setSubcategory(null);
                    }}
                    className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
                      category === c
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-card"
                    }`}
                  >
                    {c ?? t.pos.all}
                  </button>
                ))}
              </div>
            )}
            {subcategories.length > 0 && (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {[null, ...subcategories].map((c) => (
                  <button
                    key={c ?? "*"}
                    onClick={() => setSubcategory(c)}
                    className={`shrink-0 rounded-full border px-3 py-0.5 text-xs ${
                      subcategory === c
                        ? "border-brand bg-brand-soft font-semibold text-brand-ink"
                        : "border-line bg-card text-muted"
                    }`}
                  >
                    {c ?? t.pos.all}
                  </button>
                ))}
              </div>
            )}
            {products.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">
                {t.pos.noProducts}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {visible.map((p) => {
                  const left = remaining(p);
                  const inCart = baseInCart(cart, p);
                  const packLeft = !!p.packSize && left >= p.packSize;
                  return (
                    <div key={p.id} className="flex flex-col">
                      <button
                        onClick={() => add(p)}
                        disabled={left <= 0}
                        className={`relative flex min-h-24 flex-1 flex-col justify-between border bg-card p-3 text-left shadow-sm pressable disabled:opacity-40 ${
                          p.packSize ? "rounded-t-xl" : "rounded-xl"
                        } ${inCart ? "border-brand ring-2 ring-brand-soft" : "border-line"}`}
                      >
                        {inCart > 0 && (
                          <span
                            key={inCart}
                            className="animate-pop absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-white"
                          >
                            {inCart}
                          </span>
                        )}
                        {p.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage (ไม่ใช้ Image Optimization เพื่อไม่กินโควตา)
                          <img
                            src={p.imageUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="-mx-3 -mt-3 mb-2 aspect-square w-[calc(100%+1.5rem)] max-w-none rounded-t-xl object-cover"
                          />
                        )}
                        <span className="line-clamp-2 pr-6 text-sm font-medium">
                          {p.name}
                        </span>
                        <span className="mt-2 flex items-end justify-between gap-1">
                          <span className="font-bold tabular-nums">
                            {money(p.priceMinor)}
                          </span>
                          {p.trackStock && (
                            <span
                              className={`text-xs tabular-nums ${p.stockQty - inCart <= 0 ? "text-rose-600" : "text-muted"}`}
                            >
                              {left <= 0
                                ? t.pos.outOfStock
                                : p.stockQty - inCart}
                            </span>
                          )}
                        </span>
                      </button>
                      {p.packSize && (
                        <button
                          onClick={() => add(p, "pack")}
                          disabled={!packLeft}
                          className="flex items-center justify-between gap-1 rounded-b-xl border border-t-0 border-line bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-ink hover:brightness-95 disabled:opacity-40"
                        >
                          <span>
                            +1 {p.packUnit} ×{p.packSize}
                          </span>
                          <span className="tabular-nums">
                            {money(
                              p.packPriceMinor ?? p.priceMinor * p.packSize,
                            )}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="hidden h-[calc(100dvh-3rem)] overflow-hidden rounded-2xl border border-line bg-card lg:sticky lg:top-6 lg:block">
            {cartPanel}
          </aside>
        </div>

        {/* มือถือ: แถบล่าง + ตะกร้าแบบเต็มจอ */}
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-3 bottom-3 z-20 flex items-center justify-between rounded-2xl bg-brand px-4 py-3 text-white shadow-lg lg:hidden"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="size-5" /> {t.pos.cartShort} ({itemCount})
          </span>
          <span className="text-lg font-bold tabular-nums">
            {money(totals.totalMinor)}
          </span>
        </button>
        {cartOpen && (
          <div className="fixed inset-0 z-30 bg-card lg:hidden">
            {cartPanel}
          </div>
        )}
      </div>

      {scanOpen && (
        <PosScanView
          lines={lines.map((l) => ({
            key: l.key,
            label: l.label,
            imageUrl: l.p.imageUrl,
            unitPriceMinor: l.unitPriceMinor,
            qty: l.qty,
            canAdd: remaining(l.p) >= mult(l.p, l.unit),
          }))}
          totalText={money(totals.totalMinor)}
          itemCount={itemCount}
          money={money}
          onCode={onCameraCode}
          setQty={setQty}
          onClear={() => setCart(new Map())}
          onHold={holdBill}
          onClose={() => setScanOpen(false)}
          onSummary={() => {
            setScanOpen(false);
            setPayOpen(true);
            setError(null);
          }}
          t={{ pos: t.pos, scan: t.scan }}
        />
      )}

      {heldOpen && (
        <div
          className="fixed inset-0 z-40 grid place-items-end bg-black/40 sm:place-items-center print:hidden"
          role="dialog"
          aria-modal
          onClick={(e) => e.target === e.currentTarget && setHeldOpen(false)}
        >
          <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-card p-4 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <PauseCircle className="size-5" /> {t.pos.held}
              </h2>
              <button
                onClick={() => setHeldOpen(false)}
                aria-label={t.pos.cancel}
              >
                <X className="size-5" />
              </button>
            </div>
            {cart.size > 0 && (
              <p className="text-sm text-muted">{t.pos.resumeSwap}</p>
            )}
            <ul className="scroll-box divide-y divide-line rounded-xl border border-line">
              {held.map((b) => (
                <li key={b.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold tabular-nums">
                      {money(billTotal(b))}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(new Date(b.at), locale, props.timeZone)} ·{" "}
                      {fill(t.pos.itemsCount, {
                        n: b.cart.reduce((n, [, q]) => n + q, 0),
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => saveHeld(held.filter((x) => x.id !== b.id))}
                    className="rounded-lg p-2 text-muted hover:bg-rose-50 hover:text-rose-600"
                    aria-label={t.pos.deleteHeld}
                    title={t.pos.deleteHeld}
                  >
                    <Trash2 className="size-4" />
                  </button>
                  <button
                    onClick={() => resumeBill(b.id)}
                    className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white active:scale-95"
                  >
                    {t.pos.resume}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {payOpen && (
        <div
          className="fixed inset-0 z-40 grid place-items-end bg-black/40 sm:place-items-center print:hidden"
          role="dialog"
          aria-modal
        >
          <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{t.pos.pay}</h2>
              <span className="text-2xl font-bold tabular-nums text-brand-ink">
                {money(totals.totalMinor)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${
                    method === m
                      ? "border-brand bg-brand-soft text-brand-ink"
                      : "border-line"
                  }`}
                >
                  {t.pos.methods[m]}
                </button>
              ))}
            </div>
            {method === "cash" && (
              <div className="space-y-2">
                <label className="block space-y-1">
                  <span className="text-sm text-muted">{t.pos.received}</span>
                  <input
                    value={receivedText}
                    onChange={(e) => setReceivedText(e.target.value)}
                    inputMode="decimal"
                    placeholder={t.pos.exact}
                    autoFocus
                    className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-right text-xl tabular-nums outline-none focus:border-brand"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {quickAmounts(totals.totalMinor).map((v) => (
                    <button
                      key={v}
                      onClick={() =>
                        setReceivedText(
                          String(
                            v /
                              (currency === "JPY" || currency === "VND"
                                ? 1
                                : 100),
                          ),
                        )
                      }
                      className="rounded-lg border border-line px-3 py-1.5 text-sm tabular-nums hover:border-brand"
                    >
                      {v === totals.totalMinor ? t.pos.exact : money(v)}
                    </button>
                  ))}
                </div>
                {receivedText !== "" && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">{t.pos.change}</span>
                    <span
                      className={`text-xl font-bold tabular-nums ${changeMinor < 0 ? "text-rose-600" : ""}`}
                    >
                      {changeMinor < 0 ? "—" : money(changeMinor)}
                    </span>
                  </div>
                )}
              </div>
            )}
            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPayOpen(false)}
                className="rounded-xl border border-line px-4 py-3 font-medium"
              >
                {t.pos.cancel}
              </button>
              <button
                onClick={confirm}
                disabled={!canConfirm || pending}
                className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {pending && <LoaderCircle className="size-4 animate-spin" />}
                {t.pos.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4 print:static print:block print:bg-transparent print:p-0">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 font-mono text-sm text-neutral-900 shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
            <p className="text-center text-xs font-sans font-semibold text-emerald-600 print:hidden">
              ✓ {t.pos.success}
            </p>
            <Receipt
              r={receipt}
              t={t.pos}
              locale={locale}
              currency={currency}
              timeZone={props.timeZone}
              storeName={props.storeName}
              cashierName={props.cashierName}
              footer={props.receiptFooter}
            />
            <div className="mt-4 grid grid-cols-2 gap-2 font-sans print:hidden">
              <button
                onClick={() => void printReceipt(receipt)}
                className="flex items-center justify-center gap-1 rounded-xl border border-neutral-300 px-3 py-2.5 font-medium"
              >
                <Printer className="size-4" /> {t.pos.print}
              </button>
              <button
                onClick={newSale}
                autoFocus
                className="rounded-xl bg-brand px-3 py-2.5 font-semibold text-white"
              >
                {t.pos.newSale}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between">
      <span className="text-muted print:text-inherit">{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}
