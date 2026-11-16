import { TopBar } from "@/components/TopBar";
import { loadLocale } from "@/i18n/page";

export default async function HubLayout({ children, params }: LayoutProps<"/[locale]/hub">) {
  const { locale } = await loadLocale(params);
  return (
    <>
      <TopBar locale={locale} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
