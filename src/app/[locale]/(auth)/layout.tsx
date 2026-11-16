import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
        <div className="mx-auto mb-3 grid size-16 place-items-center rounded-2xl bg-brand text-xl font-black text-white">
          EP
        </div>
        <h1 className="text-2xl font-bold">{t.app.name}</h1>
        <p className="text-muted">{t.app.tagline}</p>
      </div>
      {children}
    </main>
  );
}
