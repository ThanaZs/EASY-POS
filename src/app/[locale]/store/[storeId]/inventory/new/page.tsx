import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../../BackLink";
import { ProductForm } from "../ProductForm";

export default async function NewProductPage({ params, searchParams }: PageProps<"/[locale]/store/[storeId]/inventory/new">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store } = await requireStoreAccess(locale, storeId, "products.create");
  const categories = await (await getRepositories()).products.categories(storeId);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href={`/${locale}/store/${storeId}/inventory`} label={t.store.modules.inventory} />
      <h1 className="text-xl font-bold">{t.inventory.add}</h1>
      <ProductForm locale={locale} t={t} store={store} categories={categories} error={(await searchParams).error} />
    </div>
  );
}
