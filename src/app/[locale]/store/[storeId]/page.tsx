import { can } from "@/core/domain/permissions";
import { BackLink } from "@/components/BackLink";
import { Tile } from "@/components/Tile";
import { loadLocale } from "@/i18n/page";
import { requireStoreAccess } from "@/server/session";
import { MODULES } from "./modules";
import { StoreDangerDialog } from "./StoreDangerDialog";

// หน้าเมนูของร้าน (ระบบขาย, คลังสินค้า, ภาพรวม ...) — แสดงเฉพาะเมนูที่มีสิทธิ์
export default async function StoreHomePage({
  params,
}: PageProps<"/[locale]/store/[storeId]">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store, member } = await requireStoreAccess(locale, storeId);
  const base = `/${locale}/store/${storeId}`;
  return (
    <div className="space-y-4">
      <BackLink href={`/${locale}/hub`} label={t.store.back} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {MODULES.map((m) => {
          const target = m.anyOf.find((a) => can(member, a.permission));
          return target ? (
            <Tile
              key={m.key}
              href={`${base}/${target.path}`}
              label={t.store.modules[m.key]}
              Icon={m.Icon}
              color={m.color}
            />
          ) : null;
        })}
      </div>
      {member.role !== "owner" && (
        <div className="mx-auto max-w-xs pt-6">
          <StoreDangerDialog
            mode="leave"
            locale={locale}
            storeId={storeId}
            storeName={store.name}
            t={t.danger}
          />
        </div>
      )}
    </div>
  );
}
