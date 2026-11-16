import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function TopBar({
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
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-card/90 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href={href ?? `/${locale}/hub`} className="flex min-w-0 items-center gap-2 font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm text-white">EP</span>
          <span className="truncate">{title ?? "EASY-POS"}</span>
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          {userName && <span className="hidden max-w-40 truncate text-sm text-muted sm:block">{userName}</span>}
          <LanguageSwitcher current={locale} />
        </div>
      </div>
    </header>
  );
}
