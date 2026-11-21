import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/Alert";
import { PageTitle } from "@/components/PageTitle";
import { FileSpreadsheet, Plus } from "lucide-react";
import { can } from "@/core/domain/permissions";
import { fill, formatMoney } from "@/core/lib/format";
import { toEnglishLayout } from "@/core/lib/keyboard";
import { loadLocale } from "@/i18n/page";
import { getRepositories, getStorage } from "@/server/container";
import { restoreFilters } from "@/server/filters";
import { requireStoreAccess } from "@/server/session";
import { InventoryFilters, NO_SUB } from "./InventoryFilters";
import { SortMenu } from "./SortMenu";
import { ProductList } from "./ProductList";
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
  // หมวดที่เลือกไว้ไม่มีแล้ว (เช่น ลบสินค้าในหมวดหมด / เปลี่ยนชื่อ) → กลับไปทุกหมวด
  if (cat && !tree.some((n) => n.category === cat))
    redirect(`/${locale}/store/${storeId}/inventory?reset=1`);
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
  const stockT = {
    noTrack: t.inventory.noTrack,
    out: t.inventory.out,
    low: t.inventory.low,
  };

  return (
    <div className="space-y-4 pb-20 sm:pb-0">
      {/* มือถือ: ซ่อนแถวหัวข้อทั้งแถว (หัวข้ออยู่แถบบน, นำเข้า Excel ใช้บนคอม, เพิ่มสินค้า = ปุ่ม + ลอย) */}
      {can(member, "products.create") && (
        <Link
          prefetch={false}
          href={`${base}/new`}
          aria-label={t.inventory.add}
          className="fab-add fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-40 grid size-14 place-items-center rounded-full bg-brand text-white shadow-lg shadow-black/25 transition active:scale-95 sm:hidden"
        >
          <Plus className="size-7" />
        </Link>
      )}
      <div className="hidden items-center justify-between gap-3 sm:flex">
        <PageTitle title={t.store.modules.inventory} />
        <div className="flex flex-wrap justify-end gap-2">
          {can(member, "products.create") && (
            <>
              <Link
                prefetch={false}
                href={`${base}/import`}
                aria-label={t.import.button}
                title={t.import.button}
                className="inline-flex items-center gap-1 rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium hover:border-brand"
              >
                <FileSpreadsheet className="size-4" /> {t.import.button}
              </Link>
              <Link
                prefetch={false}
                href={`${base}/new`}
                className="hidden items-center gap-1 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 sm:inline-flex"
              >
                <Plus className="size-4" /> {t.inventory.add}
              </Link>
            </>
          )}
        </div>
      </div>

      {sp.trashed === "1" && (
        <Alert kind="success">
          {t.inventory.trash.moved}{" "}
          <Link
            prefetch={false}
            href={`${base}/trash`}
            className="font-semibold underline"
          >
            {t.inventory.trash.open}
          </Link>
        </Alert>
      )}
      <InventoryFilters
        q={q}
        cat={cat}
        sub={subParam}
        low={low}
        pin={pin}
        tree={tree}
        scan={t.scan}
        rename={
          can(member, "products.edit")
            ? {
                locale,
                storeId,
                t: {
                  renameCat: t.inventory.renameCat,
                  renameSub: t.inventory.renameSub,
                  renamePrompt: t.inventory.renamePrompt,
                  renamed: t.inventory.renamed,
                  renameFailed: t.inventory.renameFailed,
                },
              }
            : undefined
        }
        labels={{
          search: t.inventory.search,
          allCategories: t.inventory.allCategories,
          lowOnly: t.inventory.lowOnly,
          pinOnly: t.inventory.pinOnly,
          allSub: t.inventory.allSub,
          noSub: t.inventory.noSub,
        }}
      />

      <ProductList
        rows={items.map((p) => {
          const catPath =
            [p.category, p.subcategory].filter(Boolean).join(" › ") || "—";
          return {
            id: p.id,
            name: p.name,
            img: p.imagePath && storage ? storage.publicUrl(p.imagePath) : null,
            href: canEdit ? `${base}/${p.id}` : null,
            pinned: p.pinned,
            priceMinor: p.priceMinor,
            costMinor: p.costMinor,
            sub: (
              <>
                <span className="md:hidden">
                  <StockText p={p} t={stockT} />
                  {" · "}
                </span>
                {catPath}
              </>
            ),
            aside: (
              <>
                <span className="hidden w-44 shrink-0 text-right text-sm md:block">
                  <StockText p={p} t={stockT} />
                </span>
                <span className="shrink-0 text-right text-base font-semibold tabular-nums md:w-28">
                  {formatMoney(p.priceMinor, store.currency, locale)}
                </span>
              </>
            ),
          };
        })}
        locale={locale}
        storeId={storeId}
        currency={store.currency}
        canPin={canEdit}
        canDelete={can(member, "products.delete")}
        canPrice={canEdit}
        showImages={!!storage}
        countText={fill(t.inventory.count, { n: items.length })}
        scopeLabel={(subParam && subParam !== NO_SUB ? subParam : cat) || undefined}
        sortMenu={
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
        }
        t={{
          ...t.inventory.bulk,
          empty: t.inventory.empty,
          pin: t.inventory.pin,
          unpin: t.inventory.unpin,
          price: t.inventory.price,
          cost: t.inventory.cost,
        }}
      />
    </div>
  );
}
