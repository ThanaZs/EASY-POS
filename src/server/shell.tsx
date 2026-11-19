import "server-only";
import { Suspense } from "react";
import { InstallPrompt } from "@/components/InstallPrompt";
import { AppShell, type ShellNav } from "@/components/AppShell";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { getRepositories } from "@/server/container";
import { getTheme } from "@/server/theme";

/** ใส่โครงหน้า (เมนูซ้าย/☰) ให้หน้า hub และหน้าในร้าน — ข้อมูลรายชื่อร้านสำหรับปุ่มสลับร้าน */
export async function Shell({
  locale,
  t,
  user,
  store = null,
  nav = [],
  children,
}: {
  locale: Locale;
  t: Dictionary;
  user: { id: string; displayName: string };
  store?: { id: string; name: string } | null;
  nav?: ShellNav[];
  children: React.ReactNode;
}) {
  const [list, theme] = await Promise.all([
    (await getRepositories()).stores.listForUser(user.id),
    getTheme(),
  ]);
  return (
    <AppShell
      locale={locale}
      store={store}
      stores={list.map(({ store: s }) => ({ id: s.id, name: s.name }))}
      userName={user.displayName}
      nav={nav}
      theme={theme}
      t={{
        ...t.shell,
        myStores: t.hub.myStores,
        createStore: t.hub.createStore,
        joinStore: t.hub.joinStore,
        account: t.hub.account,
        logout: t.hub.logout,
        theme: t.theme,
      }}
    >
      {/* แนะนำติดตั้งแอป: ครั้งแรก / หลังสมัคร (?welcome=1) */}
      <Suspense>
        <InstallPrompt t={t.install} />
      </Suspense>
      {children}
    </AppShell>
  );
}
