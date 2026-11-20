import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { notFound } from "next/navigation";
import { can } from "@/core/domain/permissions";
import { loadLocale } from "@/i18n/page";
import { getRepositories, getStorage } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../../BackLink";
import { deleteProductAction } from "../actions";
import { AuditList } from "../../AuditList";
import { Alert } from "@/components/Alert";
import { MergeAsPack } from "../MergeAsPack";
import { ProductForm } from "../ProductForm";
import { StockBadge } from "../StockBadge";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditProductPage({
  params,
  searchParams,
}: PageProps<"/[locale]/store/[storeId]/inventory/[productId]">) {
  const { locale, t } = await loadLocale(params);
  const { storeId, productId } = await params;
  const { store, member } = await requireStoreAccess(
    locale,
    storeId,
    "products.edit",
  );
  if (!UUID.test(productId)) notFound();
  const repos = await getRepositories();
  const sp = await searchParams;
  const [product, categories, history, units, all] = await Promise.all([
    repos.products.findById(storeId, productId),
    repos.products.categoryTree(storeId),
    repos.audit.list(storeId, { entityId: productId, limit: 30 }),
    repos.products.units(storeId),
    repos.products.list(storeId, {}),
  ]);
  const others = all.filter((o) => o.id !== productId);
  if (!product || !product.isActive) notFound();
  const storage = await getStorage();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink
        mobileHidden
        href={`/${locale}/store/${storeId}/inventory`}
        label={t.store.modules.inventory}
      />
      <div className="flex items-center justify-between gap-3">
        <PageTitle
          title={t.inventory.edit}
          back={`/${locale}/store/${storeId}/inventory`}
        />
        <StockBadge p={product} t={t} />
      </div>
      {sp.merged === "1" && (
        <Alert kind="success">{t.inventory.merge.done}</Alert>
      )}
      <ProductForm
        locale={locale}
        t={t}
        store={store}
        product={product}
        categoryTree={categories}
        units={units}
        error={sp.error}
        photoEnabled={storage !== null}
        photoUrl={
          product.imagePath && storage
            ? storage.publicUrl(product.imagePath)
            : null
        }
      />
      {/* เคยเพิ่มลังแยกเป็นสินค้าอีกตัว → รวมเข้ากับสินค้าปลีก */}
      {!product.packSize && others.length > 0 && (
        <MergeAsPack
          locale={locale}
          storeId={storeId}
          source={{
            id: product.id,
            name: product.name,
            unit: product.unit,
            stockQty: product.stockQty,
          }}
          options={others.map((o) => ({
            id: o.id,
            name: o.name,
            barcode: o.barcode,
            unit: o.unit,
            stockQty: o.stockQty,
            imageUrl:
              o.imagePath && storage ? storage.publicUrl(o.imagePath) : null,
          }))}
          t={t.inventory.merge}
        />
      )}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t.audit.productHistory}</h2>
          <Link
            prefetch={false}
            href={`/${locale}/store/${storeId}/history?product=${product.id}`}
            className="text-sm font-medium text-brand-ink hover:underline"
          >
            {t.stock.viewProductHistory} →
          </Link>
        </div>
        <AuditList
          entries={history}
          t={t.audit}
          locale={locale}
          timeZone={store.timeZone}
          currency={store.currency}
          showEntity={false}
        />
      </section>
      {can(member, "products.delete") && (
        <form action={deleteProductAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="productId" value={product.id} />
          <button
            type="submit"
            className="w-full rounded-xl border border-rose-300 px-4 py-2.5 font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
          >
            {t.inventory.delete}
          </button>
        </form>
      )}
    </div>
  );
}
