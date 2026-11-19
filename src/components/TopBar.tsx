import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionary";
import { getTheme } from "@/server/theme";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

export async function TopBar({
  locale,
  title,
  href,
  userName,
}: {
  locale: Locale;
  title?: string;
  href?: string;
  userName?: string;
}) {
  const [theme, t] = await Promise.all([getTheme(), getDictionary(locale)]);
  return (
    <header className="border-b border-line bg-card print:hidden">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
        <Link
          prefetch={false}
          href={href ?? `/${locale}/hub`}
          className="flex min-w-0 items-center gap-2 font-bold"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm text-white">
            EP
          </span>
          <span className="truncate">{title ?? "EASY-POS"}</span>
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          {userName && (
            <span className="hidden max-w-40 truncate text-sm text-muted sm:block">
              {userName}
            </span>
          )}
          <ThemeToggle initial={theme} labels={t.theme} />
          <LanguageSwitcher current={locale} />
        </div>
      </div>
    </header>
  );
}
