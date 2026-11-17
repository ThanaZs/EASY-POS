import { redirect } from "next/navigation";

// เมนูที่ยังไม่มีหน้าจริง (รายงาน, สมาชิก, ป้ายราคา, ใกล้หมดอายุ, ค่าใช้จ่าย) ถูกซ่อนไว้ —
// ลิงก์/บุ๊กมาร์กเก่าที่เข้ามา → กลับเมนูร้าน (โมดูลที่ทำจริงมีโฟลเดอร์ของตัวเอง ซึ่ง override route นี้)
export default async function ModulePage({ params }: PageProps<"/[locale]/store/[storeId]/[module]">) {
  const { locale, storeId } = await params;
  redirect(`/${locale}/store/${storeId}`);
}
