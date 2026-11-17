import { redirect } from "next/navigation";
import { can } from "@/core/domain/permissions";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { AuditList } from "../AuditList";
import { BackLink } from "../BackLink";
import { SettingsTabs } from "../SettingsTabs";

// ประวัติการแก้ไขทั้งร้าน (เจ้าของ/ผู้จัดการ): ใคร ทำอะไร กับอะไร เปลี่ยนจากอะไรเป็นอะไร เมื่อไร
export default async function ActivityPage({
  params,
}: PageProps<"/[locale]/store/[storeId]/activity">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store, member } = await requireStoreAccess(locale, storeId);
  if (!can(member, "store.settings") && !can(member, "staff.manage"))
    redirect(`/${locale}/store/${storeId}`);
  const entries = await (
    await getRepositories()
  ).audit.list(storeId, { limit: 300 });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink href={`/${locale}/store/${storeId}`} label={t.store.back} />
      <h1 className="text-xl font-bold">{t.store.modules.settings}</h1>
      <SettingsTabs
        locale={locale}
        storeId={storeId}
        member={member}
        t={t.store.tabs}
        active="activity"
      />
      <p className="text-sm text-muted">{t.audit.hint}</p>
      <AuditList
        entries={entries}
        t={t.audit}
        locale={locale}
        timeZone={store.timeZone}
        currency={store.currency}
      />
    </div>
  );
}
