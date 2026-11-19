import Link from "next/link";
import {
  FileSpreadsheet,
  ImageOff,
  Pin,
  Plus,
} from "lucide-react";
import { can } from "@/core/domain/permissions";
import { fill, formatMoney } from "@/core/lib/format";
import { toEnglishLayout } from "@/core/lib/keyboard";
import { loadLocale } from "@/i18n/page";
import { getRepositories, getStorage } from "@/server/container";
import { restoreFilters } from "@/server/filters";
import { requireStoreAccess } from "@/server/session";
import { togglePinAction } from "./actions";
import { InventoryFilters, NO_SUB } from "./InventoryFilters";
import { SortMenu } from "./SortMenu";
import { StockText } from "./StockBadge";
import { parseSort, sortProducts } from "./sort";

export default async function InventoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/store/[storeId]/inventory">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store, member } = await requireStoreAccess(
    locale,
    storeId,
    "products.view",
  );
  const sp = await searchParams;
  // กลับมาหน้านี้แบบไม่มีตัวกรอง → ใช้ตัวกรองล่าสุดที่เลือกไว้
  await restoreFilters(
    "inventory",
    storeId,
    `/${locale}/store/${storeId}/inventory`,
    sp,
  );
  const q = typeof sp.q === "string" ? sp.q : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const low = sp.low === "1";
  const pin = sp.pin === "1";
  const subParam = cat && typeof sp.sub === "string" ? sp.sub : "";

  const repos = await getRepositories();
  const filter = {
    category: cat || undefined,
    subcategory: subParam === NO_SUB ? null : subParam || undefined,
    lowStockOnly: low,
    pinnedOnly: pin,
  };
  const [found, tree, storage] = await Promise.all([
    repos.products.list(storeId, { ...filter, search: q }),
    repos.products.categoryTree(storeId),
    getStorage(),
  ]);
  // พิมพ์/ยิงตอนคีย์บอร์ดค้างภาษาไทย ("ๅ/-ภ") แล้วไม่เจอ → ลองแปลงเป็นแป้นอังกฤษ ("1234")
  const en = toEnglishLayout(q);
  const sort = parseSort(sp.sort);
  const items = sortProducts(
    found.length === 0 && en !== q
      ? await repos.products.list(storeId, { ...filter, search: en })
      : found,
    sort,
  );
  const so = t.inventory.sort;
  const base = `/${locale}/store/${storeId}/inventory`;
  const canEdit = can(member, "products.edit");

  return (
    <div className="space-y-4 pb-20 sm:pb-0">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t.store.modules.inventory}</h1>
        {/* มือถือ: ปุ่มไอคอนล้วน (ประหยัดที่) — จอใหญ่: ไอคอน+ข้อความ; เพิ่มสินค้าบนมือถือ = ปุ่ม + ลอยมุมล่างขวา */}
        <div className="flex flex-wrap justify-end gap-2">
          {can(member, "products.create") && (
            <>
              <Link
                prefetch={false}
                href={`${base}/import`}
                aria-label={t.import.button}
                title={t.import.button}
                className="inline-flex size-10 items-center justify-center gap-1 rounded-xl border border-line bg-card text-sm font-medium hover:border-brand sm:size-auto sm:px-3 sm:py-2"
              >
                <FileSpreadsheet className="size-5 sm:size-4" />
                <span className="hidden sm:inline">{t.import.button}</span>
              </Link>
              <Link
                prefetch={false}
                href={`${base}/new`}
                className="hidden items-center gap-1 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 sm:inline-flex"
              >
                <Plus className="size-4" /> {t.inventory.add}
              </Link>
              <Link
                prefetch={false}
                href={`${base}/new`}
                aria-label={t.inventory.add}
                className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-40 grid size-14 place-items-center rounded-full bg-brand text-white shadow-lg shadow-black/25 transition active:scale-95 sm:hidden"
              >
                <Plus className="size-7" />
              </Link>
            </>
          )}
        </div>
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

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {fill(t.inventory.count, { n: items.length })}
        </p>
        <SortMenu
          value={sort}
          label={so.label}
          options={[
            ["", so.name],
            ["new", so.new],
            ["priceDesc", so.priceDesc],
            ["priceAsc", so.priceAsc],
            ["stockAsc", so.stockAsc],
            ["stockDesc", so.stockDesc],
          ]}
        />
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">
          {t.inventory.empty}
        </p>
      ) : (
        // แถวละ 1 สินค้า เลื่อนทั้งหน้า (ไม่มีกล่องเลื่อนแยก) — จอกว้างแยกคอลัมน์ หมวด / คงเหลือ / ราคา
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {items.map((p) => {
            // เน้นตัวสินค้า: รูป + ชื่อ + (คงเหลือ · หมวด) | ราคา — บาร์โค้ดดูได้ในหน้าสินค้า
            const catPath =
              [p.category, p.subcategory].filter(Boolean).join(" › ") || "—";
            const body = (
              <>
                {storage && (
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface">
                    {p.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage
                      <img
                        src={storage.publicUrl(p.imagePath)}
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
                      <StockText p={p} t={t} />
                      {" · "}
                    </span>
                    {catPath}
                  </p>
                </div>
                <span className="hidden w-44 shrink-0 text-right text-sm md:block">
                  <StockText p={p} t={t} />
                </span>
                <span className="shrink-0 text-right text-base font-semibold tabular-nums md:w-28">
                  {formatMoney(p.priceMinor, store.currency, locale)}
                </span>
              </>
            );
            return (
              <li key={p.id} className="flex items-center border-b border-line last:border-b-0">
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
                      aria-label={
                        p.pinned ? t.inventory.unpin : t.inventory.pin
                      }
                      title={p.pinned ? t.inventory.unpin : t.inventory.pin}
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
