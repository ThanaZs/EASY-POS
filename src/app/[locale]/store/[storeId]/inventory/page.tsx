import Link from "next/link";
import {
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  ImageOff,
  Plus,
} from "lucide-react";
import { can } from "@/core/domain/permissions";
import { fill, formatMoney } from "@/core/lib/format";
import { toEnglishLayout } from "@/core/lib/keyboard";
import { loadLocale } from "@/i18n/page";
import { getRepositories, getStorage } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../BackLink";
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
  const q = typeof sp.q === "string" ? sp.q : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const low = sp.low === "1";
  const subParam = cat && typeof sp.sub === "string" ? sp.sub : "";

  const repos = await getRepositories();
  const filter = {
    category: cat || undefined,
    subcategory: subParam === NO_SUB ? null : subParam || undefined,
    lowStockOnly: low,
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
        tree={tree}
        scan={t.scan}
        labels={{
          search: t.inventory.search,
          allCategories: t.inventory.allCategories,
          lowOnly: t.inventory.lowOnly,
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
        <ul className="scroll-box divide-y divide-line rounded-2xl border border-line bg-card">
          {items.map((p) => {
            const body = (
              <>
                {storage && (
                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface">
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
                      <ImageOff className="size-4 text-muted" />
                    )}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[
                      [p.category, p.subcategory].filter(Boolean).join(" › "),
                      p.sku,
                      p.barcode,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {formatMoney(p.priceMinor, store.currency, locale)}
                  </p>
                  <StockBadge p={p} t={t} />
                </div>
                {canEdit && (
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                )}
              </>
            );
            return (
              <li key={p.id}>
                {canEdit ? (
                  <Link
                    prefetch={false}
                    href={`${base}/${p.id}`}
                    className="flex items-center gap-3 p-3 row-hover"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 p-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
