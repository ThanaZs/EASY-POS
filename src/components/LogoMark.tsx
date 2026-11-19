// โลโก้ EASY POS แบบ "กรอบสแกน": พื้นส้ม + มุมกรอบสแกนสีขาว + EASY / POS
// รูปจริงอยู่ที่ public/icons/*.png (สร้างจาก SVG ด้วย sharp — ไอคอนแอป, favicon, เมนู, หน้าเข้าสู่ระบบใช้ไฟล์ชุดเดียวกัน)

/** โลโก้ในหน้าเว็บ (สี่เหลี่ยมมน) */
export function LogoMark({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ไฟล์เล็ก ไม่ต้องผ่าน Image Optimization
    <img
      src="/icons/icon-192.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{ borderRadius: size * 0.22 }}
    />
  );
}
