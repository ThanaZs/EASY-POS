import "server-only";
import { notFound } from "next/navigation";
import { isLocale } from "./config";
import { getDictionary } from "./dictionary";

/** ใช้ในทุก page: ตรวจ locale + โหลดคำแปล */
export async function loadLocale(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { locale, t: await getDictionary(locale) };
}
