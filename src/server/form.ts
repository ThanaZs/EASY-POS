import "server-only";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

// ตัวช่วยอ่านค่าจาก FormData ใน server action

export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** ข้อความว่าง → null */
export const optStr = (f: FormData, k: string, max = 120) => str(f, k).slice(0, max) || null;

export function int(f: FormData, k: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(str(f, k), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** locale + storeId ที่ฟอร์มส่งมาเป็น hidden input */
export function storeCtx(f: FormData): { locale: Locale; storeId: string } {
  const l = str(f, "locale");
  return { locale: isLocale(l) ? l : defaultLocale, storeId: str(f, "storeId") };
}
