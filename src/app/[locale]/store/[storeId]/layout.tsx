import { TopBar } from "@/components/TopBar";
import { loadLocale } from "@/i18n/page";
import { requireStoreAccess } from "@/server/session";

export default async function StoreLayout({ children, params }: LayoutProps<"/[locale]/store/[storeId]">) {
  const { locale } = await loadLocale(params);
  const { storeId } = await params;
  const { store, user } = await requireStoreAccess(locale, storeId);
  return (
    <>
      <TopBar locale={locale} title={store.name} href={`/${locale}/store/${storeId}`} userName={user.displayName} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
