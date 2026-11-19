import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogoMark } from "@/components/LogoMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { loadLocale } from "@/i18n/page";
import { getTheme } from "@/server/theme";

export default async function AuthLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale, t } = await loadLocale(params);
  const theme = await getTheme();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-end gap-2">
        <ThemeToggle initial={theme} labels={t.theme} />
        <LanguageSwitcher current={locale} />
      </div>
      <div className="text-center">
        <LogoMark size={72} className="mx-auto mb-3 shadow-lg shadow-orange-500/25" />
        <h1 className="text-2xl font-bold">{t.app.name}</h1>
        <p className="text-muted">{t.app.tagline}</p>
      </div>
      {children}
    </main>
  );
}
