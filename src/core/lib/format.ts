// การแสดงผลตามภาษา/ทามโซน — ใช้ Intl ของ JS (ไม่ต้องลง lib เพิ่ม)

const MINOR_DIGITS: Record<string, number> = { JPY: 0, KRW: 0, VND: 0 };

export function minorToMajor(amountMinor: number, currency: string) {
  return amountMinor / 10 ** (MINOR_DIGITS[currency] ?? 2);
}

export function majorToMinor(amount: number, currency: string) {
  return Math.round(amount * 10 ** (MINOR_DIGITS[currency] ?? 2));
}

export function formatMoney(amountMinor: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    minorToMajor(amountMinor, currency),
  );
}

/** เวลาใน DB เป็น UTC เสมอ -> แปลงเป็นทามโซนของร้าน/ผู้ใช้ตอนแสดงผล */
export function formatDateTime(date: Date | string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(date));
}

/** วันที่ตามทามโซนร้าน (YYYY-MM-DD) ใช้ตัดรอบยอดขายรายวัน */
export function businessDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}
