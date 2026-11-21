import { can } from "@/core/domain/permissions";
import { packPrice } from "@/core/domain/types";
import { loadLocale } from "@/i18n/page";
import { getRepositories, getStorage } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { PosClient, type PosProduct } from "./PosClient";

export default async function PosPage({
  params,
}: PageProps<"/[locale]/store/[storeId]/pos">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store, member, user } = await requireStoreAccess(
    locale,
    storeId,
    "pos.sell",
  );
  const [products, storage] = await Promise.all([
    (await getRepositories()).products.list(storeId),
    getStorage(),
  ]);
  const items: PosProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    subcategory: p.subcategory,
    barcode: p.barcode,
    sku: p.sku,
    priceMinor: p.priceMinor,
    stockQty: p.stockQty,
    trackStock: p.trackStock,
    unit: p.unit,
    imageUrl: p.imagePath && storage ? storage.publicUrl(p.imagePath) : null,
    packUnit: p.packSize ? p.packUnit : null,
    packSize: p.packSize,
    packPriceMinor: p.packSize ? packPrice(p) : null,
    packBarcode: p.packBarcode,
    pinned: p.pinned,
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
      payQrUrl={
        store.payQrPath && storage ? storage.publicUrl(store.payQrPath) : null
      }
      products={items}
      t={{
        pos: t.pos,
        payQr: { scan: t.settings.payQr.scan, none: t.settings.payQr.none },
        store: { back: t.store.back },
        scan: t.scan,
        devices: t.devices,
      }}
    />
  );
}
