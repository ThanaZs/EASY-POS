"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu,
  PlusSquare,
  Store,
  UserCog,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/[locale]/(auth)/actions";
import {
  MODULES,
  type ModuleKey,
} from "@/app/[locale]/store/[storeId]/modules";
import { LAST_STORE_COOKIE } from "@/core/lib/last-store";
import type { Locale } from "@/i18n/config";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LogoMark } from "./LogoMark";
import { PageTitleContext } from "./PageTitle";
import { ThemeToggle } from "./ThemeToggle";

export type ShellNav = {
  key: ModuleKey;
  href: string;
  label: string;
  match: string[];
};
type Icon = React.ComponentType<{ className?: string }>;


/**
 * โครงหน้าหลังล็อกอิน (ทั้งก่อนและหลังเข้าร้าน) — ทุกอย่างอยู่ในเมนูเดียว ไม่ซ้ำกัน:
 * - บนสุด: ปุ่มร้านปัจจุบัน ▾ → รายชื่อร้านทั้งหมด (สลับร้าน) + สร้างร้านใหม่ + เข้าร่วมร้าน
 * - กลาง: เมนูของร้าน (ตามสิทธิ์)
 * - ล่าง: บัญชีของฉัน, ออกจากระบบ (+ ธีม/ภาษาบนคอม)
 * คอม (lg+) = เมนูซ้ายตลอด; มือถือ = แถบบน (☰ ชื่อร้าน | ธีม ภาษา) แตะ ☰ เปิดเมนูเดียวกันจากซ้าย
 */
export function AppShell({
  locale,
  store,
  stores,
  userName,
  nav,
  theme,
  t,
  children,
}: {
  locale: Locale;
  store: { id: string; name: string } | null;
  stores: Array<{ id: string; name: string }>;
  userName: string;
  nav: ShellNav[];
  theme: "light" | "dark";
  t: {
    menu: string;
    close: string;
    chooseStore: string;
    myStores: string;
    createStore: string;
    joinStore: string;
    account: string;
    logout: string;
    theme: { light: string; dark: string };
  };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(!store); // ยังไม่ได้เลือกร้าน → เปิดรายชื่อร้านไว้เลย
  const [page, setPage] = useState<{ text: string; back?: string } | null>(
    null,
  ); // หัวข้อหน้าจาก <PageTitle> (มือถือแสดงบนแถบบน)
  const hub = `/${locale}/hub`;
  // เปลี่ยนหน้า → ปิดเมนู (มือถือ) + พับรายชื่อร้าน
  const storeId = store?.id;
  useEffect(() => {
    setOpen(false); // eslint-disable-line react-hooks/set-state-in-effect -- sync กับ URL
    setPicker(!storeId);
  }, [pathname, storeId]);
  // จำร้านล่าสุด (1 ปี)
  useEffect(() => {
    if (storeId)
      document.cookie = `${LAST_STORE_COOKIE}=${storeId}; path=/; max-age=31536000; samesite=lax`;
  }, [storeId]);

  const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  const link = (
    href: string,
    label: string,
    Icon: Icon,
    match: string[] = [href],
    extra?: React.ReactNode,
  ) => {
    const on = match.some(under);
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
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {extra}
      </Link>
    );
  };

  const storeList = (
    <div className="space-y-0.5 px-2 pb-2">
      {/* ร้านอื่น (ร้านปัจจุบันอยู่บนหัวเมนูแล้ว) */}
      {stores
        .filter((s) => s.id !== store?.id)
        .map((s) => link(`/${locale}/store/${s.id}`, s.name, Store, []))}
      {link(`${hub}/create-store`, t.createStore, PlusSquare)}
      {link(`${hub}/join`, t.joinStore, KeyRound)}
      {stores.length > 0 && link(`${hub}/stores`, t.myStores, LayoutGrid)}
    </div>
  );

  const panel = (
    <div className="flex h-full flex-col">
      {/* ร้านปัจจุบัน ▾ (แตะ = สลับร้าน / สร้าง / เข้าร่วม) */}
      <button
        type="button"
        onClick={() => setPicker((v) => !v)}
        aria-expanded={picker}
        className="m-2 mr-12 flex items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-surface lg:mr-2"
      >
        <LogoMark size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-bold leading-tight">
            {store?.name ?? "EASY-POS"}
          </span>
          <span className="block text-xs text-muted">
            {store ? t.chooseStore : t.myStores}
          </span>
        </span>
        <ChevronDown
          className={`size-5 shrink-0 text-muted transition ${picker ? "rotate-180" : ""}`}
        />
      </button>
      <div className="flex-1 overflow-y-auto">
        {picker && (
          <div className={store ? "border-b border-line pb-1" : ""}>
            {storeList}
          </div>
        )}
        {store && (
          <nav className="space-y-0.5 px-2 pt-2">
            {nav.map((n) =>
              link(
                n.href,
                n.label,
                MODULES.find((m) => m.key === n.key)?.Icon ?? LayoutGrid,
                n.match,
              ),
            )}
          </nav>
        )}
      </div>
      <div className="space-y-0.5 border-t border-line p-2">
        {link(`${hub}/account`, userName || t.account, UserCog)}
        <form action={logoutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-ink transition hover:bg-surface active:scale-[0.98]"
          >
            <LogOut className="size-5 shrink-0 text-muted" />
            {t.logout}
          </button>
        </form>
        {/* มือถือ: ธีม/ภาษาอยู่บนแถบบนแล้ว */}
        <div className="hidden items-center gap-2 px-3 pb-1 pt-2 lg:flex">
          <ThemeToggle initial={theme} labels={t.theme} />
          <LanguageSwitcher current={locale} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="lg:pl-64 print:pl-0">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-card lg:block print:hidden">
        {panel}
      </aside>

      <header className="sticky top-0 z-20 flex h-12 items-center gap-1 border-b border-line bg-card/90 px-1.5 backdrop-blur lg:hidden print:hidden">
        {page?.back ? (
          <Link
            prefetch={false}
            href={page.back}
            aria-label="back"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-ink active:bg-surface"
          >
            <ArrowLeft className="size-6" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t.menu}
            className="grid size-10 shrink-0 place-items-center rounded-xl text-ink active:bg-surface"
          >
            <Menu className="size-6" />
          </button>
        )}
        {/* หัวข้อหน้า (แทนชื่อร้าน) — หน้าไม่มีหัวข้อ = ชื่อเมนูที่เปิดอยู่ / ชื่อร้าน */}
        <span className="min-w-0 flex-1 truncate text-[17px] font-bold">
          {page?.text ??
            nav.find((n) => n.match.some(under))?.label ??
            store?.name ??
            "EASY-POS"}
        </span>
        <div className="flex shrink-0 items-center gap-1.5 pr-1">
          <ThemeToggle initial={theme} labels={t.theme} />
          <LanguageSwitcher current={locale} />
        </div>
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

      <main className="mx-auto max-w-6xl overflow-x-clip px-4 py-4 lg:py-6">
        <PageTitleContext.Provider value={setPage}>
          {children}
        </PageTitleContext.Provider>
      </main>
    </div>
  );
}
