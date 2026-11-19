import { loadLocale } from "@/i18n/page";
import { PageTitle } from "@/components/PageTitle";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../../BackLink";
import { ImportClient } from "./ImportClient";

// นำเข้าสินค้าจาก Excel / CSV (เช่นไฟล์ export จากระบบเดิม)
export default async function ImportPage({ params }: PageProps<"/[locale]/store/[storeId]/inventory/import">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  await requireStoreAccess(locale, storeId, "products.create");
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink mobileHidden href={`/${locale}/store/${storeId}/inventory`} label={t.store.modules.inventory} />
      <PageTitle title={t.import.title} back={`/${locale}/store/${storeId}/inventory`} />
      <p className="text-sm text-muted">{t.import.intro}</p>
      <ImportClient locale={locale} storeId={storeId} t={t.import} />
    </div>
  );
}
