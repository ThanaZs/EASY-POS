import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ImageOff,
  PackagePlus,
  Pencil,
  Pin,
  Store,
} from "lucide-react";
import { can } from "@/core/domain/permissions";
import type { StockMovement } from "@/core/domain/types";
import { fill, formatMoney } from "@/core/lib/format";
import { loadLocale } from "@/i18n/page";
import { getRepositories, getStorage } from "@/server/container";
import { restoreFilters } from "@/server/filters";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../BackLink";
import { togglePinAction } from "../inventory/actions";
import { InventoryFilters, NO_SUB } from "../inventory/InventoryFilters";
import { SortMenu } from "../inventory/SortMenu";
import { StockText } from "../inventory/StockBadge";
import { parseSort, sortProducts } from "../inventory/sort";
import { MovementList } from "./MovementList";

const UUID = /^[0-9a-f-]{36}$/i;

// ประวัติสินค้า
// - หน้ารวม: รายการสินค้าแบบคลังสินค้า (รูป, ปักหมุด — ซิงก์กับคลัง) + ซื้อล่าสุด (ราคา · ร้าน · วันที่)
// - กดสินค้า (?product=): สรุป + ไทม์ไลน์การซื้อ (ที่ไหน ราคาเท่าไร วันไหน ลอตไหน) + ความเคลื่อนไหวอื่น (ขาย/เบิก/ปรับ/คืน)
export default async function HistoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/store/[storeId]/history">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store, member } = await requireStoreAccess(
    locale,
    storeId,
    "stock.history",
  );
  const sp = await searchParams;
  // กลับมาหน้านี้แบบไม่มีตัวกรอง → ใช้ตัวกรองล่าสุดที่เลือกไว้
  await restoreFilters(
    "history",
    storeId,
    `/${locale}/store/${storeId}/history`,
    sp,
  );
  const one = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : "";
  const productId = UUID.test(one("product")) ? one("product") : "";
  const q = one("q").slice(0, 60);
  const cat = one("cat").slice(0, 60);
  const subParam = cat ? one("sub").slice(0, 60) : "";
  const low = one("low") === "1";
  const pin = one("pin") === "1";
  const supplier = one("supplier").slice(0, 80);

  const repos = await getRepositories();
  const storage = await getStorage();
  const base = `/${locale}/store/${storeId}/history`;
  const s = t.stock;
  const money = (m: number) => formatMoney(m, store.currency, locale);
  const day = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(`${d}T00:00:00Z`));
  const dayOf = (m: StockMovement) =>
    m.purchasedOn ??
    new Intl.DateTimeFormat("en-CA", { timeZone: store.timeZone }).format(
      m.createdAt,
    );
  const img = (path: string | null, size: string) =>
    path && storage ? (
      // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage
      <img
        src={storage.publicUrl(path)}
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

  // ยิง/พิมพ์บาร์โค้ดตรงสินค้าเดียว → เปิดหน้าสินค้านั้นเลย
  let focusId = productId;
  if (!focusId && q) {
    const hit = (await repos.products.list(storeId, { search: q })).filter(
      (p) => p.barcode === q || p.packBarcode === q || p.sku === q,
    );
    if (hit.length === 1) focusId = hit[0].id;
  }

  // ===================== มุมมองสินค้าเดียว =====================
  if (focusId) {
    const [product, all] = await Promise.all([
      repos.products.findById(storeId, focusId),
      repos.stock.history(storeId, { productId: focusId, limit: 1000 }),
    ]);
    if (!product) notFound();
    const purchases = all.filter((m) => m.type === "in");
    const others = all.filter((m) => m.type !== "in");
    const priced = purchases.filter((m) => m.unitCostMinor != null);
    const qtyPriced = priced.reduce((n, m) => n + m.qty, 0);
    const avgCost = qtyPriced
      ? Math.round(
          priced.reduce((n, m) => n + m.qty * m.unitCostMinor!, 0) / qtyPriced,
        )
      : null;
    const prices = priced.map((m) => m.unitCostMinor!);
    const lastBuy =
      purchases.find((m) => m.unitCostMinor != null || m.supplier) ?? null;
    const bySupplier = new Map<
      string,
      { times: number; qty: number; lastPrice: number | null; lastDay: string }
    >();
    for (const m of purchases) {
      if (!m.supplier) continue;
      const cur = bySupplier.get(m.supplier) ?? {
        times: 0,
        qty: 0,
        lastPrice: null,
        lastDay: dayOf(m),
      };
      cur.times++;
      cur.qty += m.qty;
      if (cur.lastPrice === null && m.unitCostMinor != null)
        cur.lastPrice = m.unitCostMinor;
      bySupplier.set(m.supplier, cur);
    }
    const cheapest = [...bySupplier]
      .filter(([, v]) => v.lastPrice != null)
      .sort((a, b) => a[1].lastPrice! - b[1].lastPrice!)[0]?.[0];

    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackLink href={base} label={s.allHistory} />

        {/* ----- หัวสินค้า ----- */}
        <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center gap-3">
            {img(product.imagePath, "size-16")}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-lg font-bold">
                {product.pinned && (
                  <Pin className="size-4 shrink-0 fill-current text-brand" />
                )}
                <span className="truncate">{product.name}</span>
              </p>
              <p className="truncate text-xs text-muted">
                {[
                  [product.category, product.subcategory]
                    .filter(Boolean)
                    .join(" › "),
                  product.barcode,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {s.inStockNow}{" "}
                <b className="text-ink">
                  {product.stockQty} {product.unit}
                </b>{" "}
                · {s.costNow}{" "}
                <b className="text-ink">{money(product.costMinor)}</b> ·{" "}
                {s.priceNow}{" "}
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
            {can(member, "products.edit") && (
              <Link
                prefetch={false}
                href={`/${locale}/store/${storeId}/inventory/${product.id}`}
                className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-sm font-medium"
              >
                <Pencil className="size-4" /> {t.inventory.edit}
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label={s.lastBuy}
              value={
                lastBuy?.unitCostMinor != null
                  ? money(lastBuy.unitCostMinor)
                  : "—"
              }
              sub={
                lastBuy
                  ? [lastBuy.supplier, day(dayOf(lastBuy))]
                      .filter(Boolean)
                      .join(" · ")
                  : ""
              }
            />
            <Stat
              label={s.avgCost}
              value={avgCost != null ? money(avgCost) : "—"}
              sub={qtyPriced ? `${qtyPriced} ${product.unit}` : ""}
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
              value={String(purchases.length)}
              sub={`${purchases.reduce((n, m) => n + m.qty, 0)} ${product.unit}`}
            />
          </div>
        </section>

        {/* ----- ซื้อจากร้านไหนบ้าง ----- */}
        {bySupplier.size > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">{s.suppliersOf}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...bySupplier].map(([name, v]) => {
                const best = name === cheapest && bySupplier.size > 1;
                return (
                  <div
                    key={name}
                    className={`rounded-2xl border bg-card p-3 ${best ? "border-emerald-400" : "border-line"}`}
                  >
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Store className="size-4 text-muted" /> {name}
                      {best && (
                        <span className="rounded-md bg-emerald-100 px-1.5 text-[11px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {s.cheapest}
                        </span>
                      )}
                    </p>
                    <p className="text-sm">
                      {v.lastPrice != null ? (
                        <b className="tabular-nums">{money(v.lastPrice)}</b>
                      ) : (
                        "—"
                      )}{" "}
                      <span className="text-muted">/ {product.unit}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {fill(s.supplierStats, {
                        times: v.times,
                        qty: v.qty,
                        unit: product.unit,
                        date: day(v.lastDay),
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ----- ไทม์ไลน์การซื้อ ----- */}
        <section className="space-y-2">
          <h2 className="font-semibold">{s.purchaseTimeline}</h2>
          {purchases.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-card p-6 text-center text-muted">
              {s.noPurchases}
            </p>
          ) : (
            <ol className="scroll-box space-y-2">
              {purchases.map((m, i) => {
                const prev = purchases
                  .slice(i + 1)
                  .find((x) => x.unitCostMinor != null);
                const diff =
                  m.unitCostMinor != null && prev?.unitCostMinor != null
                    ? m.unitCostMinor - prev.unitCostMinor
                    : 0;
                const d = dayOf(m);
                return (
                  <li
                    key={m.id}
                    className="flex gap-3 rounded-2xl border border-line bg-card p-3"
                  >
                    <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-brand-soft py-1.5 text-center leading-tight text-brand-ink">
                      <span className="text-lg font-bold">
                        {Number(d.slice(8))}
                      </span>
                      <span className="text-[11px]">
                        {new Intl.DateTimeFormat(locale, {
                          month: "short",
                          year: "2-digit",
                          timeZone: "UTC",
                        }).format(new Date(`${d}T00:00:00Z`))}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        <Store className="size-4 shrink-0 text-muted" />
                        <span className="truncate">
                          {m.supplier ?? s.unknownSupplier}
                        </span>
                      </p>
                      <p className="text-xs text-muted">
                        {[
                          m.lotNo && `${s.lotNo} ${m.lotNo}`,
                          `+${m.qty} ${product.unit}`,
                          m.note && m.note !== "initial" ? m.note : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {m.unitCostMinor != null ? (
                        <>
                          <p className="font-bold tabular-nums">
                            {money(m.unitCostMinor)}
                            <span className="text-xs font-normal text-muted">
                              /{product.unit}
                            </span>
                          </p>
                          <p className="text-xs tabular-nums text-muted">
                            {s.totalPaid} {money(m.unitCostMinor * m.qty)}
                          </p>
                          {diff !== 0 && (
                            <p
                              className={`inline-flex items-center text-xs font-semibold ${diff > 0 ? "text-rose-600" : "text-emerald-600"}`}
                            >
                              {diff > 0 ? (
                                <ArrowUp className="size-3" />
                              ) : (
                                <ArrowDown className="size-3" />
                              )}
                              {money(Math.abs(diff))}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted">—</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* ----- ความเคลื่อนไหวอื่น ----- */}
        {others.length > 0 && (
          <details className="space-y-2 rounded-2xl border border-line bg-card p-3">
            <summary className="cursor-pointer font-semibold">
              {s.otherMovements}{" "}
              <span className="text-sm font-normal text-muted">
                ({others.length})
              </span>
            </summary>
            <MovementList
              items={others}
              t={t}
              locale={locale}
              timeZone={store.timeZone}
              currency={store.currency}
              showProduct={false}
            />
          </details>
        )}
      </div>
    );
  }

  // ===================== หน้ารวม: รายการสินค้า =====================
  const [products, tree, last, suppliers, bySupplierIds] = await Promise.all([
    repos.products.list(storeId, {
      search: q || undefined,
      category: cat || undefined,
      subcategory: subParam === NO_SUB ? null : subParam || undefined,
      lowStockOnly: low,
      pinnedOnly: pin,
    }),
    repos.products.categoryTree(storeId),
    repos.stock.lastPurchases(storeId),
    repos.stock.suppliers(storeId),
    supplier
      ? repos.stock.productIdsBySupplier(storeId, supplier)
      : Promise.resolve(null),
  ]);
  const sort = parseSort(sp.sort, true);
  const items = sortProducts(
    bySupplierIds
      ? products.filter((p) => bySupplierIds.includes(p.id))
      : products,
    sort,
    (id) => {
      const m = last.get(id);
      return m ? Date.parse(`${dayOf(m)}T00:00:00Z`) : undefined;
    },
  );
  const so = t.inventory.sort;
  const canPin = can(member, "products.edit");

  return (
    <div className="space-y-4">
      <div>
        <PageTitle title={t.store.modules.history} />
        <p className="text-xs text-muted">{s.historyHint}</p>
      </div>

      <InventoryFilters
        q={q}
        cat={cat}
        sub={subParam}
        low={low}
        pin={pin}
        tree={tree}
        scan={t.scan}
        labels={{
          search: t.inventory.search,
          allCategories: t.inventory.allCategories,
          lowOnly: t.inventory.lowOnly,
          pinOnly: t.inventory.pinOnly,
          allSub: t.inventory.allSub,
          noSub: t.inventory.noSub,
        }}
      />
      {/* ร้านที่ซื้อ: แยกเป็นช่องของตัวเอง (แตะชื่อร้าน = กรองทันที) */}
      {suppliers.length > 0 && (
        <section className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
          <Store
            className="size-4 shrink-0 text-muted"
            aria-label={s.supplierFilter}
          />
          <div className="flex gap-1.5">
            {[
              ["", s.allSuppliers] as const,
              ...suppliers.map((x) => [x, x] as const),
            ].map(([value, label]) => {
              const p = new URLSearchParams();
              for (const [k, v] of Object.entries({
                q,
                cat,
                sub: subParam,
                low: low ? "1" : "",
                pin: pin ? "1" : "",
                sort,
                supplier: value,
              }))
                if (v) p.set(k, v);
              const qs = p.toString();
              const active = supplier === value;
              return (
                <Link
                  key={value || "*"}
                  prefetch={false}
                  href={qs ? `${base}?${qs}` : `${base}?reset=1`}
                  aria-current={active ? "true" : undefined}
                  className={`shrink-0 rounded-full border px-3 py-1 text-sm transition active:scale-95 ${
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-card hover:border-brand"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {fill(t.inventory.count, { n: items.length })}
        </p>
        <SortMenu
          value={sort}
          label={so.label}
          options={[
            ["", so.name],
            ["bought", so.bought],
            ["new", so.new],
            ["stockAsc", so.stockAsc],
            ["stockDesc", so.stockDesc],
          ]}
        />
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">
          {s.noMatch}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {items.map((p) => {
            const lb = last.get(p.id);
            return (
              <li key={p.id} className="flex items-center border-b border-line last:border-b-0">
                {canPin ? (
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
                      aria-label={
                        p.pinned ? t.inventory.unpin : t.inventory.pin
                      }
                      title={p.pinned ? t.inventory.unpin : t.inventory.pin}
                      className={`grid h-16 w-10 place-items-center transition active:scale-90 ${p.pinned ? "text-brand" : "text-line hover:text-muted"}`}
                    >
                      <Pin
                        className={`size-4 ${p.pinned ? "fill-current" : ""}`}
                      />
                    </button>
                  </form>
                ) : (
                  <span className="w-3" />
                )}
                <Link
                  prefetch={false}
                  href={`${base}?product=${p.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 row-hover"
                >
                  {storage && img(p.imagePath, "size-12 rounded-xl")}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[15px] font-medium leading-snug">
                      {p.name}
                    </p>
                    {lb ? (
                      <p className="mt-0.5 truncate text-[13px]">
                        {lb.unitCostMinor != null && (
                          <b className="tabular-nums">
                            {money(lb.unitCostMinor)}
                          </b>
                        )}
                        <span className="text-muted">
                          {lb.unitCostMinor != null && lb.supplier ? " · " : ""}
                          {lb.supplier}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-0.5 truncate text-[13px] text-muted">
                        {s.noPurchaseYet}
                      </p>
                    )}
                  </div>
                  {/* ขวาสุด = วันที่ซื้อล่าสุด; มือถือ: วันที่ / คงเหลือ ซ้อนกัน */}
                  <span className="flex shrink-0 flex-col items-end gap-0.5 text-[13px] md:hidden">
                    <span className="tabular-nums text-muted">
                      {lb ? day(dayOf(lb)) : "—"}
                    </span>
                    <StockText p={p} t={t.inventory} />
                  </span>
                  <span className="hidden w-40 shrink-0 truncate text-[13px] text-muted md:block">
                    {[p.category, p.subcategory].filter(Boolean).join(" › ") ||
                      "—"}
                  </span>
                  <span className="hidden w-32 shrink-0 text-right text-[13px] md:block">
                    <StockText p={p} t={t.inventory} />
                  </span>
                  <span className="hidden w-28 shrink-0 text-right text-[13px] tabular-nums text-muted md:block">
                    {lb ? day(dayOf(lb)) : "—"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
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
