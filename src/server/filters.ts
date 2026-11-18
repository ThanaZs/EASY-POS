import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// ===== จำตัวกรองล่าสุดของหน้า (คลังสินค้า / ประวัติสินค้า) แยกตามร้าน =====
// ฝั่ง client (InventoryFilters) เขียน cookie ทุกครั้งที่เปลี่ยนตัวกรอง → กลับมาหน้าเดิมแบบไม่มีพารามิเตอร์
// (เช่น กดกลับจากเพิ่ม/แก้ไขสินค้า, กดเมนู) → server redirect ไปตัวกรองเดิมก่อนแสดงผล ไม่มีกระพริบ

export type FilterPage = "inventory" | "history";
export const filterCookie = (page: FilterPage, storeId: string) =>
  `epf_${page}_${storeId}`;

export async function restoreFilters(
  page: FilterPage,
  storeId: string,
  base: string,
  sp: Record<string, string | string[] | undefined>,
) {
  if (Object.keys(sp).length > 0) return; // มีพารามิเตอร์อยู่แล้ว = ผู้ใช้เลือกเอง
  const raw = (await cookies()).get(filterCookie(page, storeId))?.value;
  if (!raw) return;
  let qs = "";
  try {
    qs = new URLSearchParams(decodeURIComponent(raw)).toString(); // ทำความสะอาดค่า
  } catch {
    return;
  }
  if (qs) redirect(`${base}?${qs}`);
}
