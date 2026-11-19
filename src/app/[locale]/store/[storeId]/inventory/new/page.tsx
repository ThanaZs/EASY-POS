import { loadLocale } from "@/i18n/page";
import { PageTitle } from "@/components/PageTitle";
import { getRepositories, getStorage } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../../BackLink";
import { ProductForm } from "../ProductForm";

export default async function NewProductPage({ params, searchParams }: PageProps<"/[locale]/store/[storeId]/inventory/new">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store } = await requireStoreAccess(locale, storeId, "products.create");
  const repos = await getRepositories();
  const [categories, units] = await Promise.all([repos.products.categoryTree(storeId), repos.products.units(storeId)]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink mobileHidden href={`/${locale}/store/${storeId}/inventory`} label={t.store.modules.inventory} />
      <PageTitle title={t.inventory.add} back={`/${locale}/store/${storeId}/inventory`} />
      <ProductForm
        locale={locale}
        t={t}
        store={store}
        categoryTree={categories}
        units={units}
        error={(await searchParams).error}
        photoEnabled={(await getStorage()) !== null}
        photoUrl={null}
      />
    </div>
  );
}
