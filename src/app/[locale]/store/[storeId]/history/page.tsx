import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../BackLink";
import { MovementList } from "./MovementList";

export default async function HistoryPage({ params }: PageProps<"/[locale]/store/[storeId]/history">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store } = await requireStoreAccess(locale, storeId, "stock.history");
  const items = await (await getRepositories()).stock.history(storeId, { limit: 300 });
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink href={`/${locale}/store/${storeId}`} label={t.store.back} />
      <h1 className="text-xl font-bold">{t.store.modules.history}</h1>
      <MovementList items={items} t={t} locale={locale} timeZone={store.timeZone} />
    </div>
  );
}
