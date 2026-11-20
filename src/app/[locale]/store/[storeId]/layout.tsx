import { can } from "@/core/domain/permissions";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import type { ShellNav } from "@/components/AppShell";
import { Shell } from "@/server/shell";
import { MODULES, type ModuleKey } from "./modules";

// หน้าย่อยที่อยู่ใต้เมนูเดียวกัน (ไฮไลต์เมนูให้ถูกตอนเปิดหน้าย่อย)
const ALSO: Partial<Record<ModuleKey, string[]>> = {
  settings: ["staff", "activity"],
};

export default async function StoreLayout({ children, params }: LayoutProps<"/[locale]/store/[storeId]">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store, user, member } = await requireStoreAccess(locale, storeId);
  const base = `/${locale}/store/${storeId}`;
  const nav: ShellNav[] = MODULES.flatMap((m) => {
    const target = m.anyOf.find((a) => can(member, a.permission));
    if (!target) return [];
    const paths = [...m.anyOf.map((a) => a.path), ...(ALSO[m.key] ?? [])];
    return [{ key: m.key, href: `${base}/${target.path}`, label: t.store.modules[m.key], match: paths.map((p) => `${base}/${p}`) }];
  });
  // ถังขยะสินค้า: อยู่ถัดจาก "ประวัติสินค้า" (กลุ่มเรื่องสินค้า ก่อนตั้งค่าร้าน) — แสดงจำนวนในถัง
  if (can(member, "products.delete")) {
    const trashCount = await (await getRepositories()).products.countTrash(storeId);
    const href = `${base}/inventory/trash`;
    const at = nav.findIndex((n) => n.key === "settings");
    const item = { key: "trash" as const, href, label: t.inventory.trash.title, match: [href], badge: trashCount };
    nav.splice(at < 0 ? nav.length : at, 0, item);
  }
  return (
    <Shell locale={locale} t={t} user={user} store={{ id: store.id, name: store.name }} nav={nav}>
      {children}
    </Shell>
  );
}
