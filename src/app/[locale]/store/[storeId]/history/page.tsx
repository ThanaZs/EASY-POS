import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff, PackagePlus, Pencil, Search, X } from "lucide-react";
import type { StockMovement } from "@/core/domain/types";
import { formatMoney } from "@/core/lib/format";
import { loadLocale } from "@/i18n/page";
import { getRepositories, getStorage } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../BackLink";
import { MovementList } from "./MovementList";

const TYPES = ["in", "sale", "out", "adjust", "refund"] as const;
const UUID = /^[0-9a-f-]{36}$/i;

// ประวัติสินค้า: ซื้อมาราคาเท่าไร · จากไหน · ลอตไหน · วันไหน + ความเคลื่อนไหวทั้งหมด (ขาย/เบิก/ปรับ/คืน)
// ?product=<id> → สรุปของสินค้านั้น (ซื้อล่าสุด, ต้นทุนเฉลี่ย, แยกตามร้านที่ซื้อ)
export default async function HistoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/store/[storeId]/history">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store } = await requireStoreAccess(locale, storeId, "stock.history");
  const sp = await searchParams;
  const one = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : "";
  const productId = UUID.test(one("product")) ? one("product") : "";
  const type = (TYPES as readonly string[]).includes(one("type"))
    ? (one("type") as StockMovement["type"])
    : null;
  const q = one("q").slice(0, 60);
  const supplier = one("supplier").slice(0, 80);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(one("from")) ? one("from") : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(one("to")) ? one("to") : "";

  const repos = await getRepositories();
  const [items, suppliers, product, productAll, storage] = await Promise.all([
    repos.stock.history(storeId, {
      productId: productId || undefined,
      types: type ? [type] : undefined,
      search: productId ? undefined : q || undefined,
      supplier: supplier || undefined,
      from: from || undefined,
      to: to || undefined,
      timeZone: store.timeZone,
      limit: 300,
    }),
    repos.stock.suppliers(storeId),
    productId
      ? repos.products.findById(storeId, productId)
      : Promise.resolve(null),
    productId
      ? repos.stock.history(storeId, { productId, types: ["in"], limit: 1000 })
      : Promise.resolve([]),
    getStorage(),
  ]);
  if (productId && !product) notFound();

  const base = `/${locale}/store/${storeId}/history`;
  const money = (m: number) => formatMoney(m, store.currency, locale);
  const s = t.stock;
  const link = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = {
      product: productId,
      type: type ?? "",
      q,
      supplier,
      from,
      to,
    };
    for (const [k, v] of Object.entries({ ...cur, ...patch }))
      if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const day = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${d}T00:00:00Z`));

  // ----- สรุปการซื้อของสินค้าที่เลือก -----
  const buys = productAll.filter((m) => m.unitCostMinor != null);
  const last =
    productAll.find((m) => m.unitCostMinor != null || m.supplier || m.lotNo) ??
    null;
  const qtyWithCost = buys.reduce((n, m) => n + m.qty, 0);
  const avgCost = qtyWithCost
    ? Math.round(
        buys.reduce((n, m) => n + m.qty * (m.unitCostMinor ?? 0), 0) /
          qtyWithCost,
      )
    : null;
  const prices = buys.map((m) => m.unitCostMinor!);
  const bySupplier = new Map<
    string,
    {
      times: number;
      qty: number;
      lastPrice: number | null;
      lastDay: string | null;
    }
  >();
  for (const m of productAll) {
    if (!m.supplier) continue;
    const cur = bySupplier.get(m.supplier) ?? {
      times: 0,
      qty: 0,
      lastPrice: null,
      lastDay: null,
    };
    cur.times++;
    cur.qty += m.qty;
    if (cur.lastPrice === null && m.unitCostMinor != null)
      cur.lastPrice = m.unitCostMinor; // รายการเรียงใหม่ → เก่า
    if (!cur.lastDay) cur.lastDay = m.purchasedOn;
    bySupplier.set(m.supplier, cur);
  }

  const chip = (active: boolean, label: string, href: string) => (
    <Link
      key={href + label}
      prefetch={false}
      href={href}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm transition active:scale-95 ${
        active ? "border-brand bg-brand text-white" : "border-line bg-card"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink
        href={productId ? base : `/${locale}/store/${storeId}`}
        label={productId ? s.allHistory : t.store.back}
      />
      <h1 className="text-xl font-bold">{t.store.modules.history}</h1>

      {/* ----- สินค้าที่เลือก: สรุปการซื้อ ----- */}
      {product && (
        <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center gap-3">
            {product.imagePath && storage ? (
              // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage
              <img
                src={storage.publicUrl(product.imagePath)}
                alt=""
                className="size-14 rounded-xl object-cover"
              />
            ) : (
              <span className="grid size-14 place-items-center rounded-xl bg-surface text-muted">
                <ImageOff className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{product.name}</p>
              <p className="text-sm text-muted">
                {s.inStockNow}:{" "}
                <b className="text-ink">
                  {product.stockQty} {product.unit}
                </b>{" "}
                · {s.costNow}:{" "}
                <b className="text-ink">{money(product.costMinor)}</b> ·{" "}
                {s.priceNow}:{" "}
                <b className="text-ink">{money(product.priceMinor)}</b>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              prefetch={false}
              href={`/${locale}/store/${storeId}/receive`}
              className="inline-flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-sm font-semibold text-white"
            >
              <PackagePlus className="size-4" /> {s.receiveMore}
            </Link>
            <Link
              prefetch={false}
              href={`/${locale}/store/${storeId}/inventory/${product.id}`}
              className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-sm font-medium"
            >
              <Pencil className="size-4" /> {t.inventory.edit}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label={s.lastBuy}
              value={
                last?.unitCostMinor != null ? money(last.unitCostMinor) : "—"
              }
              sub={
                last
                  ? [last.supplier, last.purchasedOn && day(last.purchasedOn)]
                      .filter(Boolean)
                      .join(" · ")
                  : ""
              }
            />
            <Stat
              label={s.avgCost}
              value={avgCost != null ? money(avgCost) : "—"}
              sub={qtyWithCost ? `${qtyWithCost} ${product.unit}` : ""}
            />
            <Stat
              label={s.priceRange}
              value={
                prices.length
                  ? `${money(Math.min(...prices))} – ${money(Math.max(...prices))}`
                  : "—"
              }
            />
            <Stat
              label={s.timesBought}
              value={String(productAll.length)}
              sub={`${productAll.reduce((n, m) => n + m.qty, 0)} ${product.unit}`}
            />
          </div>

          {bySupplier.size > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="py-1 font-medium">{s.supplier}</th>
                    <th className="py-1 font-medium">{s.times}</th>
                    <th className="py-1 font-medium">{s.lastPrice}</th>
                    <th className="py-1 font-medium">{s.lastDate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...bySupplier].map(([name, v]) => (
                    <tr key={name}>
                      <td className="py-1.5 font-medium">
                        <Link
                          prefetch={false}
                          href={link({ supplier: name })}
                          className="hover:text-brand-ink hover:underline"
                        >
                          {name}
                        </Link>
                      </td>
                      <td className="py-1.5 tabular-nums">
                        {v.times} ({v.qty} {product.unit})
                      </td>
                      <td className="py-1.5 tabular-nums">
                        {v.lastPrice != null ? money(v.lastPrice) : "—"}
                      </td>
                      <td className="py-1.5">
                        {v.lastDay ? day(v.lastDay) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ----- ตัวกรอง ----- */}
      <form
        method="get"
        className="space-y-2 rounded-2xl border border-line bg-card p-3"
      >
        {productId && <input type="hidden" name="product" value={productId} />}
        {type && <input type="hidden" name="type" value={type} />}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          {!productId && (
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                name="q"
                defaultValue={q}
                placeholder={s.searchProduct}
                autoComplete="off"
                className="w-full rounded-xl border border-line bg-card py-2 pl-9 pr-3 outline-none focus:border-brand"
              />
            </label>
          )}
          <select
            name="supplier"
            defaultValue={supplier}
            className="rounded-xl border border-line bg-card px-3 py-2"
          >
            <option value="">{s.allSuppliers}</option>
            {suppliers.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            {s.from}
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="mt-0.5 block rounded-xl border border-line bg-card px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="text-xs text-muted">
            {s.to}
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="mt-0.5 block rounded-xl border border-line bg-card px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            {s.filter}
          </button>
          {(q || supplier || from || to || type) && (
            <Link
              prefetch={false}
              href={productId ? `${base}?product=${productId}` : base}
              className="inline-flex items-center gap-1 px-2 py-2 text-sm text-muted hover:text-ink"
            >
              <X className="size-4" /> {s.clear}
            </Link>
          )}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {chip(!type, s.all, link({ type: null }))}
          {TYPES.map((x) => chip(type === x, s.types[x], link({ type: x })))}
        </div>
      </form>

      <p className="text-sm text-muted">
        {items.length} {s.entries}
      </p>
      <MovementList
        items={items}
        t={t}
        locale={locale}
        timeZone={store.timeZone}
        currency={store.currency}
        linkBase={base}
        showProduct={!productId}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-surface p-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-bold tabular-nums">{value}</p>
      {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
