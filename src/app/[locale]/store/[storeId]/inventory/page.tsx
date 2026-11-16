import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { can } from "@/core/domain/permissions";
import { fill, formatMoney } from "@/core/lib/format";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../BackLink";
import { StockBadge } from "./StockBadge";

export default async function InventoryPage({ params, searchParams }: PageProps<"/[locale]/store/[storeId]/inventory">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store, member } = await requireStoreAccess(locale, storeId, "products.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const low = sp.low === "1";

  const repos = await getRepositories();
  const [items, categories] = await Promise.all([
    repos.products.list(storeId, { search: q, category: cat || undefined, lowStockOnly: low }),
    repos.products.categories(storeId),
  ]);
  const base = `/${locale}/store/${storeId}/inventory`;
  const canEdit = can(member, "products.edit");

  return (
    <div className="space-y-4">
      <BackLink href={`/${locale}/store/${storeId}`} label={t.store.back} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t.store.modules.inventory}</h1>
        {can(member, "products.create") && (
          <Link
            href={`${base}/new`}
            className="inline-flex items-center gap-1 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="size-4" /> {t.inventory.add}
          </Link>
        )}
      </div>

      <form className="flex flex-wrap gap-2" role="search">
        <label className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.inventory.search}
            className="w-full rounded-xl border border-line bg-card py-2 pl-9 pr-3 outline-none focus:border-brand"
          />
        </label>
        <select name="cat" defaultValue={cat} className="rounded-xl border border-line bg-card px-3 py-2">
          <option value="">{t.inventory.allCategories}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={low} /> {t.inventory.lowOnly}
        </label>
        <button className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-surface">
          <Search className="size-4" aria-label={t.inventory.search} />
        </button>
      </form>

      <p className="text-sm text-muted">{fill(t.inventory.count, { n: items.length })}</p>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">{t.inventory.empty}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {items.map((p) => {
            const body = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[p.category, p.sku, p.barcode].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatMoney(p.priceMinor, store.currency, locale)}</p>
                  <StockBadge p={p} t={t} />
                </div>
                {canEdit && <ChevronRight className="size-4 shrink-0 text-muted" />}
              </>
            );
            return (
              <li key={p.id}>
                {canEdit ? (
                  <Link href={`${base}/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-surface">
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
