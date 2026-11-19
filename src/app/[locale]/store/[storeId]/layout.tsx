import { can } from "@/core/domain/permissions";
import { loadLocale } from "@/i18n/page";
import { requireStoreAccess } from "@/server/session";
import { getTheme } from "@/server/theme";
import { MODULES, type ModuleKey } from "./modules";
import { StoreShell } from "./StoreShell";

// หน้าย่อยที่อยู่ใต้เมนูเดียวกัน (ไฮไลต์เมนูให้ถูกตอนเปิดหน้าย่อย)
const ALSO: Partial<Record<ModuleKey, string[]>> = {
  overview: ["sales"],
  settings: ["staff", "activity"],
};

export default async function StoreLayout({ children, params }: LayoutProps<"/[locale]/store/[storeId]">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const [{ store, user, member }, theme] = await Promise.all([requireStoreAccess(locale, storeId), getTheme()]);
  const base = `/${locale}/store/${storeId}`;
  const nav = MODULES.flatMap((m) => {
    const target = m.anyOf.find((a) => can(member, a.permission));
    if (!target) return [];
    const paths = [...m.anyOf.map((a) => a.path), ...(ALSO[m.key] ?? [])];
    return [{ key: m.key, href: `${base}/${target.path}`, label: t.store.modules[m.key], match: paths.map((p) => `${base}/${p}`) }];
  });
  return (
    <StoreShell
      locale={locale}
      storeId={storeId}
      storeName={store.name}
      userName={user.displayName}
      nav={nav}
      theme={theme}
      t={{ ...t.shell, account: t.hub.account, theme: t.theme }}
    >
      {children}
    </StoreShell>
  );
}
