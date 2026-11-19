import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/i18n/config";
import { IdleRefresh } from "@/components/IdleRefresh";
import { PwaListener } from "@/components/InstallPrompt";
import { LiveRefresh } from "@/components/LiveRefresh";
import { VirtualKeyboard } from "@/components/VirtualKeyboard";
import { getDictionary } from "@/i18n/dictionary";
import { getTheme } from "@/server/theme";
import "../globals.css";

export const metadata: Metadata = {
  title: "EASY-POS",
  description: "Point of sale web app",
  applicationName: "EASY-POS",
  appleWebApp: { capable: true, title: "EASY-POS", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-180.png",
  },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await getTheme();
  return {
    width: "device-width",
    initialScale: 1,
    themeColor: theme === "dark" ? "#0f1115" : "#ea580c",
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const theme = await getTheme();
  const t = await getDictionary(locale);
  return (
    <html lang={locale} data-theme={theme} className="h-full antialiased">
      <body className="min-h-full bg-surface text-ink">
        <IdleRefresh />
        <PwaListener />
        <LiveRefresh />
        <VirtualKeyboard labels={t.keyboard} />
        {children}
      </body>
    </html>
  );
}
