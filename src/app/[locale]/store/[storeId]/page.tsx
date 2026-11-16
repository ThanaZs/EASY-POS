import { Home } from "lucide-react";
import { can } from "@/core/domain/permissions";
import { Tile } from "@/components/Tile";
import { loadLocale } from "@/i18n/page";
import { requireStoreAccess } from "@/server/session";
import { MODULES } from "./modules";

// หน้าเมนูของร้าน (ระบบขาย, คลังสินค้า, ภาพรวม ...) — แสดงเฉพาะเมนูที่มีสิทธิ์
export default async function StoreHomePage({ params }: PageProps<"/[locale]/store/[storeId]">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { member } = await requireStoreAccess(locale, storeId);
  const base = `/${locale}/store/${storeId}`;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {MODULES.filter((m) => can(member, m.permission)).map((m) => (
        <Tile key={m.key} href={`${base}/${m.key}`} label={t.store.modules[m.key]} Icon={m.Icon} color={m.color} />
      ))}
      <Tile href={`/${locale}/hub`} label={t.store.back} Icon={Home} color="bg-neutral-900" />
    </div>
  );
}
