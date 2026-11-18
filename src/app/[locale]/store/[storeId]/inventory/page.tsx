import Link from "next/link";
import {
  ChevronRight,
  ClipboardList,
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
import { BackLink } from "../BackLink";
import { togglePinAction } from "./actions";
import { InventoryFilters, NO_SUB } from "./InventoryFilters";
import { ScanToSearch } from "./ScanToSearch";
import { StockBadge } from "./StockBadge";

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
  const items =
    found.length === 0 && en !== q
      ? await repos.products.list(storeId, { ...filter, search: en })
      : found;
  const base = `/${locale}/store/${storeId}/inventory`;
  const canEdit = can(member, "products.edit");

  return (
    <div className="space-y-4">
      <BackLink href={`/${locale}/store/${storeId}`} label={t.store.back} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t.store.modules.inventory}</h1>
        <div className="flex flex-wrap justify-end gap-2">
          {can(member, "stock.history") && (
            <Link
              prefetch={false}
              href={`/${locale}/store/${storeId}/history`}
              className="inline-flex items-center gap-1 rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium hover:border-brand"
            >
              <ClipboardList className="size-4" /> {t.store.modules.history}
            </Link>
          )}
          {can(member, "products.create") && (
            <>
              <Link
                prefetch={false}
                href={`${base}/import`}
                className="inline-flex items-center gap-1 rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium hover:border-brand"
              >
                <FileSpreadsheet className="size-4" /> {t.import.button}
              </Link>
              <Link
                prefetch={false}
                href={`${base}/new`}
                className="inline-flex items-center gap-1 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                <Plus className="size-4" /> {t.inventory.add}
              </Link>
            </>
          )}
        </div>
      </div>

      <ScanToSearch devices={t.devices} />
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

      <p className="text-sm text-muted">
        {fill(t.inventory.count, { n: items.length })}
      </p>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">
          {t.inventory.empty}
        </p>
      ) : (
        // แบบกะทัดรัด: แถวเตี้ย รูปเล็ก ราคา+สต็อกบรรทัดเดียว; จอกว้างแสดง 2 คอลัมน์ → เห็นสินค้ามากขึ้นต่อหน้าจอ
        <ul className="scroll-box grid rounded-2xl border border-line bg-card lg:grid-cols-2 lg:divide-x lg:divide-line">
          {items.map((p) => {
            const body = (
              <>
                {storage && (
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-surface">
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
                      <ImageOff className="size-3.5 text-muted" />
                    )}
                  </span>
                )}
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-[11px] text-muted">
                    {[
                      [p.category, p.subcategory].filter(Boolean).join(" › "),
                      p.barcode ?? p.sku,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatMoney(p.priceMinor, store.currency, locale)}
                  </span>
                  <StockBadge p={p} t={t} />
                </div>
              </>
            );
            return (
              <li key={p.id} className="flex items-center border-b border-line">
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
                      className={`grid h-12 w-9 place-items-center transition active:scale-90 ${
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
                    className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pr-2 row-hover"
                  >
                    {body}
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-3 pr-3">
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
