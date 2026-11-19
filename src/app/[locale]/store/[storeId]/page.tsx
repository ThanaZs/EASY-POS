import { redirect } from "next/navigation";
import { can } from "@/core/domain/permissions";
import { loadLocale } from "@/i18n/page";
import { requireStoreAccess } from "@/server/session";
import { MODULES } from "./modules";

// เข้าร้าน = ไปเมนูแรกที่มีสิทธิ์ (ปกติ "ระบบขาย") — ไม่มีหน้าปุ่มซ้ำกับเมนูแล้ว
export default async function StoreHomePage({ params }: PageProps<"/[locale]/store/[storeId]">) {
  const { locale } = await loadLocale(params);
  const { storeId } = await params;
  const { member } = await requireStoreAccess(locale, storeId);
  const base = `/${locale}/store/${storeId}`;
  for (const m of MODULES) {
    const target = m.anyOf.find((a) => can(member, a.permission));
    if (target) redirect(`${base}/${target.path}`);
  }
  redirect(`/${locale}/hub/stores`);
}
