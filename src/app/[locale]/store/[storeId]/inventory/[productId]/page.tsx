import { notFound } from "next/navigation";
import { can } from "@/core/domain/permissions";
import { loadLocale } from "@/i18n/page";
import { getRepositories, getStorage } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../../BackLink";
import { deleteProductAction } from "../actions";
import { ProductForm } from "../ProductForm";
import { StockBadge } from "../StockBadge";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditProductPage({
  params,
  searchParams,
}: PageProps<"/[locale]/store/[storeId]/inventory/[productId]">) {
  const { locale, t } = await loadLocale(params);
  const { storeId, productId } = await params;
  const { store, member } = await requireStoreAccess(locale, storeId, "products.edit");
  if (!UUID.test(productId)) notFound();
  const repos = await getRepositories();
  const [product, categories] = await Promise.all([
    repos.products.findById(storeId, productId),
    repos.products.categoryTree(storeId),
  ]);
  if (!product || !product.isActive) notFound();
  const storage = await getStorage();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href={`/${locale}/store/${storeId}/inventory`} label={t.store.modules.inventory} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t.inventory.edit}</h1>
        <StockBadge p={product} t={t} />
      </div>
      <ProductForm
        locale={locale}
        t={t}
        store={store}
        product={product}
        categoryTree={categories}
        error={(await searchParams).error}
        photoEnabled={storage !== null}
        photoUrl={product.imagePath && storage ? storage.publicUrl(product.imagePath) : null}
      />
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
