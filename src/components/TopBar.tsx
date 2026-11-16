import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function TopBar({ locale, title, href }: { locale: Locale; title?: string; href?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href={href ?? `/${locale}/hub`} className="flex items-center gap-2 font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm text-white">EP</span>
          <span className="truncate">{title ?? "EASY-POS"}</span>
        </Link>
        <LanguageSwitcher current={locale} />
      </div>
    </header>
  );
}
