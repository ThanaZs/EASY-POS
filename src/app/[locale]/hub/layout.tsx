import { loadLocale } from "@/i18n/page";
import { requireUser } from "@/server/session";
import { Shell } from "@/server/shell";

export default async function HubLayout({ children, params }: LayoutProps<"/[locale]/hub">) {
  const { locale, t } = await loadLocale(params);
  const user = await requireUser(locale);
  return (
    <Shell locale={locale} t={t} user={user}>
      {children}
    </Shell>
  );
}
