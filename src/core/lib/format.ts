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

/** แปลงข้อความที่ผู้ใช้พิมพ์ ("25", "25.50", "1,250") เป็นหน่วยย่อย — คืน null ถ้าไม่ใช่ตัวเลขที่ถูกต้อง */
export function parseMoney(input: string, currency: string): number | null {
  const clean = input.replace(/[,\s]/g, "");
  if (clean === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return majorToMinor(Number(clean), currency);
}

/** ตัวเลขจำนวนเงินแบบไม่มีสัญลักษณ์สกุลเงิน (ใช้ใส่ค่าเริ่มต้นในช่องกรอก) */
export function minorToInput(amountMinor: number, currency: string): string {
  const v = minorToMajor(amountMinor, currency);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** เติมค่า {name} ในข้อความแปล */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

/** วันนี้ (YYYY-MM-DD) ตามทามโซนร้าน */
export function todayIn(timeZone: string): string {
  return businessDate(new Date(), timeZone);
}

/** บวก/ลบวันของสตริง YYYY-MM-DD (คิดแบบปฏิทิน ไม่ขึ้นกับทามโซน) */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
