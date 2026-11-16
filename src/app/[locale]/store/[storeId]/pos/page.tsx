import { can } from "@/core/domain/permissions";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { PosClient, type PosProduct } from "./PosClient";

export default async function PosPage({ params }: PageProps<"/[locale]/store/[storeId]/pos">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store, member, user } = await requireStoreAccess(locale, storeId, "pos.sell");
  const products = await (await getRepositories()).products.list(storeId);
  const items: PosProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    barcode: p.barcode,
    sku: p.sku,
    priceMinor: p.priceMinor,
    stockQty: p.stockQty,
    trackStock: p.trackStock,
    unit: p.unit,
  }));

  return (
    <PosClient
      locale={locale}
      storeId={storeId}
      storeName={store.name}
      cashierName={user.displayName}
      currency={store.currency}
      timeZone={store.timeZone}
      taxRateBp={store.taxRateBp}
      taxIncluded={store.taxIncluded}
      canDiscount={can(member, "pos.discount")}
      allowNegativeStock={store.allowNegativeStock}
      receiptFooter={store.receiptFooter}
      products={items}
      t={{ pos: t.pos, store: { back: t.store.back }, scan: t.scan, devices: t.devices }}
    />
  );
}
