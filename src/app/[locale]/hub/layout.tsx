import { TopBar } from "@/components/TopBar";
import { loadLocale } from "@/i18n/page";
import { requireUser } from "@/server/session";

export default async function HubLayout({ children, params }: LayoutProps<"/[locale]/hub">) {
  const { locale } = await loadLocale(params);
  const user = await requireUser(locale);
  return (
    <>
      <TopBar locale={locale} userName={user.displayName} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
