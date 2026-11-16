"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Camera, LoaderCircle, Minus, Plus, Printer, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { calcSaleTotals } from "@/core/domain/sale";
import { CameraScanner } from "@/components/CameraScanner";
import type { PaymentMethod } from "@/core/domain/types";
import { fill, formatMoney, parseMoney } from "@/core/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { checkoutAction } from "./actions";
import { Receipt, type ReceiptData } from "./Receipt";

export type PosProduct = {
  id: string;
  name: string;
  category: string | null;
  barcode: string | null;
  sku: string | null;
  priceMinor: number;
  stockQty: number;
  trackStock: boolean;
  unit: string;
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
  t: { pos: Dictionary["pos"]; store: { back: string }; scan: Dictionary["scan"] };
};

const METHODS: PaymentMethod[] = ["cash", "qr", "card", "transfer"];

export function PosClient(props: Props) {
  const { locale, currency, products, t } = props;
  const router = useRouter();
  const money = (m: number) => formatMoney(m, currency, locale);

  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
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

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort(),
    [products],
  );
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.barcode === search.trim() || p.sku?.toLowerCase().includes(q)),
    );
  }, [products, search, category]);

  const lines = [...cart.entries()]
    .map(([id, qty]) => ({ p: byId.get(id), qty }))
    .filter((l): l is { p: PosProduct; qty: number } => Boolean(l.p));
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const discountMinor = props.canDiscount ? Math.max(0, parseMoney(discountText, currency) ?? 0) : 0;
  const totals = calcSaleTotals(
    lines.map((l) => ({ productId: l.p.id, name: l.p.name, qty: l.qty, unitPriceMinor: l.p.priceMinor, costMinor: 0, discountMinor: 0 })),
    { billDiscountMinor: discountMinor, taxRateBp: props.taxRateBp, taxIncluded: props.taxIncluded },
  );
  const receivedMinor = parseMoney(receivedText, currency);
  const changeMinor = receivedMinor === null ? -1 : receivedMinor - totals.totalMinor;
  const canConfirm = lines.length > 0 && (method !== "cash" || receivedText === "" || changeMinor >= 0);

  const limited = (p: PosProduct) => p.trackStock && !props.allowNegativeStock;
  const remaining = (p: PosProduct) => (limited(p) ? p.stockQty - (cart.get(p.id) ?? 0) : Infinity);

  function setQty(id: string, qty: number) {
    const p = byId.get(id);
    if (!p) return;
    const max = limited(p) ? p.stockQty : Infinity;
    setCart((prev) => {
      const next = new Map(prev);
      const q = Math.min(max, Math.max(0, qty));
      if (q === 0) next.delete(id);
      else next.set(id, q);
      return next;
    });
    setError(null);
  }
  /** +1 แบบอ่านค่าล่าสุดจาก state (สแกนรัวๆ ไม่ตกหล่น) */
  function add(p: PosProduct) {
    setCart((prev) => {
      const cur = prev.get(p.id) ?? 0;
      if (limited(p) && cur >= p.stockQty) return prev;
      return new Map(prev).set(p.id, cur + 1);
    });
    setError(null);
  }

  /** เครื่องสแกนบาร์โค้ดพิมพ์รหัสแล้วกด Enter — อ่านค่าจาก input ตรงๆ เพราะสแกนเร็วกว่า state อัปเดต */
  function onSearchEnter(raw: string) {
    const code = raw.trim();
    if (!code) return;
    const q = code.toLowerCase();
    const exact = products.find((p) => p.barcode === code || p.sku === code);
    const matches = exact ? [exact] : products.filter((p) => p.name.toLowerCase().includes(q));
    const target = matches.length === 1 ? matches[0] : null;
    if (target) {
      add(target);
      setSearch("");
    }
  }

  /** กล้องเจอบาร์โค้ด → เพิ่มลงตะกร้า (สแกนต่อได้เรื่อยๆ) */
  function onCameraCode(code: string) {
    const p = products.find((x) => x.barcode === code || x.sku === code);
    if (p && remaining(p) > 0) {
      add(p);
      setScanStatus(fill(t.scan.added, { name: p.name }));
    } else if (p) {
      setScanStatus(`${p.name}: ${t.pos.outOfStock}`);
    } else {
      setScanStatus(fill(t.scan.notFound, { code }));
    }
  }

  function quickAmounts(total: number): number[] {
    const unit = currency === "JPY" || currency === "VND" ? 1 : 100; // หน่วยย่อยต่อ 1 หน่วยหลัก
    const steps = [20, 100, 500, 1000].map((v) => v * unit);
    const out = new Set<number>([total]);
    for (const s of steps) out.add(Math.ceil(total / s) * s);
    return [...out].filter((v) => v >= total).sort((a, b) => a - b).slice(0, 4);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await checkoutAction({
        locale,
        storeId: props.storeId,
        lines: lines.map((l) => ({ productId: l.p.id, qty: l.qty })),
        discountMinor,
        method,
        paidMinor: method === "cash" && receivedText !== "" ? receivedMinor : null,
      });
      if (!res.ok) {
        setError(fill(t.pos.errors[res.reason], { name: res.productName ?? "" }));
        return;
      }
      setReceipt(res.receipt);
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
          {t.pos.cart} {itemCount > 0 && <span className="text-muted">({itemCount})</span>}
        </h2>
        <div className="flex items-center gap-2">
          {lines.length > 0 && (
            <button onClick={() => setCart(new Map())} className="text-sm text-rose-600 hover:underline">
              {t.pos.clear}
            </button>
          )}
          <button onClick={() => setCartOpen(false)} className="lg:hidden" aria-label={t.pos.cancel}>
            <X className="size-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{t.pos.emptyCart}</p>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map(({ p, qty }) => (
              <li key={p.id} className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted tabular-nums">{money(p.priceMinor)}</p>
                </div>
                <div className="flex items-center rounded-lg border border-line">
                  <button className="p-1.5" onClick={() => setQty(p.id, qty - 1)} aria-label="-">
                    {qty === 1 ? <Trash2 className="size-4 text-rose-600" /> : <Minus className="size-4" />}
                  </button>
                  <input
                    value={qty}
                    onChange={(e) => setQty(p.id, Number.parseInt(e.target.value || "0", 10) || 0)}
                    inputMode="numeric"
                    className="w-10 bg-transparent text-center text-sm tabular-nums outline-none"
                    aria-label={p.name}
                  />
                  <button className="p-1.5 disabled:opacity-30" onClick={() => setQty(p.id, qty + 1)} disabled={remaining(p) <= 0} aria-label="+">
                    <Plus className="size-4" />
                  </button>
                </div>
                <p className="w-20 text-right text-sm font-semibold tabular-nums">{money(p.priceMinor * qty)}</p>
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
        {totals.discountMinor > 0 && <Row label={t.pos.discount} value={`-${money(totals.discountMinor)}`} />}
        {props.taxRateBp > 0 && <Row label={`${t.pos.tax} ${props.taxRateBp / 100}%`} value={money(totals.taxMinor)} />}
        <div className="flex items-baseline justify-between pt-1">
          <span className="font-semibold">{t.pos.total}</span>
          <span className="text-2xl font-bold tabular-nums text-brand">{money(totals.totalMinor)}</span>
        </div>
        <button
          disabled={lines.length === 0}
          onClick={() => {
            setPayOpen(true);
            setError(null);
          }}
          className="w-full rounded-xl bg-brand px-4 py-3 text-lg font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {t.pos.pay}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="print:hidden">
        <Link
          href={`/${locale}/store/${props.storeId}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" /> {t.store.back}
        </Link>
        <div className="grid gap-4 pb-24 lg:grid-cols-[1fr_380px] lg:pb-0">
          <section className="min-w-0 space-y-3">
            <div className="flex gap-2">
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onSearchEnter(e.currentTarget.value))}
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
            {categories.length > 0 && (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {[null, ...categories].map((c) => (
                  <button
                    key={c ?? "*"}
                    onClick={() => setCategory(c)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
                      category === c ? "border-brand bg-brand text-white" : "border-line bg-card"
                    }`}
                  >
                    {c ?? t.pos.all}
                  </button>
                ))}
              </div>
            )}
            {products.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">{t.pos.noProducts}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {visible.map((p) => {
                  const left = remaining(p);
                  const inCart = cart.get(p.id) ?? 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => add(p)}
                      disabled={left <= 0}
                      className={`relative flex min-h-24 flex-col justify-between rounded-xl border bg-card p-3 text-left shadow-sm transition active:scale-[0.98] disabled:opacity-40 ${
                        inCart ? "border-brand ring-2 ring-brand-soft" : "border-line hover:border-brand"
                      }`}
                    >
                      {inCart > 0 && (
                        <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                          {inCart}
                        </span>
                      )}
                      <span className="line-clamp-2 pr-6 text-sm font-medium">{p.name}</span>
                      <span className="mt-2 flex items-end justify-between gap-1">
                        <span className="font-bold tabular-nums">{money(p.priceMinor)}</span>
                        {p.trackStock && (
                          <span className={`text-xs tabular-nums ${p.stockQty - inCart <= 0 ? "text-rose-600" : "text-muted"}`}>
                            {left <= 0 ? t.pos.outOfStock : p.stockQty - inCart}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="hidden h-[calc(100dvh-8rem)] overflow-hidden rounded-2xl border border-line bg-card lg:sticky lg:top-20 lg:block">
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
          <span className="text-lg font-bold tabular-nums">{money(totals.totalMinor)}</span>
        </button>
        {cartOpen && <div className="fixed inset-0 z-30 bg-card lg:hidden">{cartPanel}</div>}
      </div>

      {scanOpen && (
        <CameraScanner
          continuous
          onDetected={onCameraCode}
          onClose={() => setScanOpen(false)}
          labels={t.scan}
          status={scanStatus ? `${scanStatus} · ${t.pos.cartShort} ${itemCount} · ${money(totals.totalMinor)}` : null}
        />
      )}

      {payOpen && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-black/40 sm:place-items-center print:hidden" role="dialog" aria-modal>
          <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{t.pos.pay}</h2>
              <span className="text-2xl font-bold tabular-nums text-brand">{money(totals.totalMinor)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${
                    method === m ? "border-brand bg-brand-soft text-brand" : "border-line"
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
                      onClick={() => setReceivedText(String(v / (currency === "JPY" || currency === "VND" ? 1 : 100)))}
                      className="rounded-lg border border-line px-3 py-1.5 text-sm tabular-nums hover:border-brand"
                    >
                      {v === totals.totalMinor ? t.pos.exact : money(v)}
                    </button>
                  ))}
                </div>
                {receivedText !== "" && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">{t.pos.change}</span>
                    <span className={`text-xl font-bold tabular-nums ${changeMinor < 0 ? "text-rose-600" : ""}`}>
                      {changeMinor < 0 ? "—" : money(changeMinor)}
                    </span>
                  </div>
                )}
              </div>
            )}
            {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPayOpen(false)} className="rounded-xl border border-line px-4 py-3 font-medium">
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
            <p className="text-center text-xs font-sans font-semibold text-emerald-600 print:hidden">✓ {t.pos.success}</p>
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
                onClick={() => window.print()}
                className="flex items-center justify-center gap-1 rounded-xl border border-neutral-300 px-3 py-2.5 font-medium"
              >
                <Printer className="size-4" /> {t.pos.print}
              </button>
              <button onClick={newSale} autoFocus className="rounded-xl bg-brand px-3 py-2.5 font-semibold text-white">
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
