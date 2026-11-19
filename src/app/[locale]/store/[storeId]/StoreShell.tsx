"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftRight, LayoutGrid, Menu, UserCog, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Locale } from "@/i18n/config";
import { MODULES, type ModuleKey } from "./modules";

type Nav = { key: ModuleKey; href: string; label: string; match: string[] };

/**
 * โครงหน้าในร้าน (แทนแถบบนเดิม):
 * - คอม/จอกว้าง (lg+): เมนูด้านซ้ายตลอด (แบบ Loyverse) — ชื่อร้าน, เมนูร้าน, ล่างสุด = เปลี่ยนร้าน/บัญชี/ธีม/ภาษา
 * - มือถือ/แท็บเล็ต: แถบบางๆ ด้านบน (☰ + ชื่อร้าน) → แตะ ☰ เปิดเมนูเดียวกันจากด้านซ้าย
 * หน้าก่อนเข้าร้าน (hub) ยังใช้ TopBar แบบเรียบ
 */
export function StoreShell({
  locale,
  storeId,
  storeName,
  userName,
  nav,
  theme,
  t,
  children,
}: {
  locale: Locale;
  storeId: string;
  storeName: string;
  userName: string;
  nav: Nav[];
  theme: "light" | "dark";
  t: {
    home: string;
    switchStore: string;
    menu: string;
    close: string;
    account: string;
    theme: { light: string; dark: string };
  };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const home = `/${locale}/store/${storeId}`;
  // เปลี่ยนหน้า → ปิดเมนู (มือถือ)
  useEffect(() => setOpen(false), [pathname]); // eslint-disable-line react-hooks/set-state-in-effect -- sync กับ URL

  const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  const item = (
    href: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    match: string[] = [href],
  ) => {
    const on = href === home ? pathname === home : match.some(under);
    return (
      <Link
        key={href}
        prefetch={false}
        href={href}
        onClick={() => setOpen(false)}
        aria-current={on ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition active:scale-[0.98] ${
          on
            ? "bg-brand-soft font-semibold text-brand-ink"
            : "text-ink hover:bg-surface"
        }`}
      >
        <Icon className={`size-5 shrink-0 ${on ? "" : "text-muted"}`} />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  const panel = (
    <div className="flex h-full flex-col">
      <Link
        prefetch={false}
        href={home}
        onClick={() => setOpen(false)}
        className="flex items-center gap-2.5 py-4 pl-4 pr-12 font-bold lg:pr-4"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-sm text-white">
          EP
        </span>
        <span className="truncate text-lg">{storeName}</span>
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {item(home, t.home, LayoutGrid, [])}
        {nav.map((n) => {
          const Icon = MODULES.find((m) => m.key === n.key)?.Icon ?? LayoutGrid;
          return item(n.href, n.label, Icon, n.match);
        })}
      </nav>
      <div className="space-y-0.5 border-t border-line p-2">
        {item(`/${locale}/hub/stores`, t.switchStore, ArrowLeftRight)}
        {item(`/${locale}/hub/account`, userName || t.account, UserCog)}
        <div className="flex items-center gap-2 px-3 pb-1 pt-2">
          <ThemeToggle initial={theme} labels={t.theme} />
          <LanguageSwitcher current={locale} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="lg:pl-60 print:pl-0">
      {/* คอม: เมนูซ้าย */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-card lg:block print:hidden">
        {panel}
      </aside>

      {/* มือถือ: แถบบาง + ปุ่มเมนู */}
      <header className="sticky top-0 z-20 flex h-12 items-center gap-1 border-b border-line bg-card/90 px-1.5 backdrop-blur lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.menu}
          className="grid size-10 place-items-center rounded-xl text-ink active:bg-surface"
        >
          <Menu className="size-6" />
        </button>
        <Link
          prefetch={false}
          href={home}
          className="min-w-0 truncate font-bold"
        >
          {storeName}
        </Link>
      </header>
      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative h-full w-72 max-w-[85vw] bg-card pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.close}
              className="absolute right-2 top-[calc(0.75rem+env(safe-area-inset-top))] grid size-9 place-items-center rounded-full text-muted hover:bg-surface"
            >
              <X className="size-5" />
            </button>
            {panel}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-4 lg:py-6">{children}</main>
    </div>
  );
}
