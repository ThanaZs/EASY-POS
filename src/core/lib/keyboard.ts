// แปลงข้อความที่พิมพ์ด้วยแป้นไทย (เกษมณี) โดยไม่ตั้งใจ → ปุ่มเดียวกันบนแป้นอังกฤษ
// ใช้กับบาร์โค้ด/รหัสสินค้า ที่เครื่องสแกนหรือคนพิมพ์ตอนคีย์บอร์ดค้างภาษาไทย ("ๅ/-ภ" → "1234")

const TH = "ๅ/-ภถุึคตจขชๆไำพะัีรนยบลฟหกดเ้่าสวงผปแอิืทมใฝ+๑๒๓๔ู฿๕๖๗๘๙๐\"ฎฑธํ๊ณฯญฐ,ฤฆฏโฌ็๋ษศซ.()ฉฮฺ์?ฒฬฦ";
const EN = "1234567890-=qwertyuiop[]asdfghjkl;'zxcvbnm,./!@#$%^&*()_+QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?";
export const TH_TO_EN: ReadonlyMap<string, string> = new Map(Array.from(TH).map((c, i) => [c, EN[i]]));

export const isThai = (c: string) => /[฀-๿]/.test(c);

/** ไม่มีอักษรไทยเลย = คืนค่าเดิม (ไม่แตะ "/" "-" ที่ตั้งใจพิมพ์) */
export function toEnglishLayout(text: string): string {
  if (!Array.from(text).some(isThai)) return text;
  return Array.from(text, (c) => TH_TO_EN.get(c) ?? c).join("");
}
