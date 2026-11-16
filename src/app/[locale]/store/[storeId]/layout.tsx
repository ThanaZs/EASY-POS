import { TopBar } from "@/components/TopBar";
import { loadLocale } from "@/i18n/page";

export default async function StoreLayout({ children, params }: LayoutProps<"/[locale]/store/[storeId]">) {
  const { locale } = await loadLocale(params);
  const { storeId } = await params;
  // TODO(phase 1): โหลดร้าน + ตรวจว่า user เป็นสมาชิก (can()) ไม่งั้น redirect ไป hub
  return (
    <>
      <TopBar locale={locale} title={storeId === "demo" ? "Demo Store" : storeId} href={`/${locale}/store/${storeId}`} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
