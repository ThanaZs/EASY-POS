// เรียงข้อความแบบ "ธรรมชาติ" สำหรับชื่อสินค้า/หมวด/หน่วย:
// ตัวเลขในข้อความเทียบเป็นค่าตัวเลข (9 w < 12 watt < 100 w) ไม่ใช่ทีละตัวอักษร (แบบเดิม "12" มาก่อน "9")
// ไทยเรียงตามพจนานุกรม (ไม่สนสระหน้า เ แ โ), ไม่แยกตัวพิมพ์ใหญ่-เล็ก
const collator = new Intl.Collator("th", { numeric: true, sensitivity: "base" });

export const compareText = (a: string, b: string) => collator.compare(a, b);
