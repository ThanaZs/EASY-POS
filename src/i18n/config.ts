// ภาษาที่รองรับ — เพิ่มภาษาใหม่: ใส่โค้ดที่นี่ + สร้างไฟล์ messages/<code>.json
export const locales = ["th", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "th";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export const localeLabels: Record<Locale, string> = {
  th: "ไทย",
  en: "English",
};

// ทามโซนเริ่มต้น (เก็บเวลาใน DB เป็น UTC เสมอ แล้วแปลงตอนแสดงผล)
export const defaultTimeZone = "Asia/Bangkok";
