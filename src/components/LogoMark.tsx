// โลโก้ EASY-POS: ถุงช้อปปิ้งสีขาว + บาร์โค้ดในถุง บนพื้นส้มไล่สี = "ร้านค้า + สแกนขาย" เห็นแล้วรู้ว่าเป็นระบบขายหน้าร้าน
// ใช้ทั้งไอคอนแอป (api/pwa-icon — สร้างเป็น PNG ด้วย ImageResponse) และโลโก้ในหน้าเว็บ
// เป็น SVG ล้วน (ไม่มี hook) → ใช้ได้ทั้ง server/client และใน satori

export const LOGO_GRADIENT =
  "linear-gradient(140deg, #fb923c 0%, #f97316 38%, #ea580c 70%, #c2410c 100%)";

// ซี่บาร์โค้ด [x, ความกว้าง] ใน viewBox 100×100
const BARS: Array<[number, number]> = [
  [32, 3],
  [37, 1.6],
  [40.5, 4],
  [46.5, 1.6],
  [50, 3],
  [55, 1.6],
  [58.5, 4],
  [64.5, 1.6],
  [67.5, 1.4],
];

/** รูปถุง+บาร์โค้ด (พื้นโปร่ง) — scale < 1 = ย่อไว้กลางภาพ (ไอคอน maskable ของ Android ตัดขอบเป็นวงกลม) */
export function LogoGlyph({
  size,
  scale = 1,
  barColor = "#ea580c",
}: {
  size: number;
  scale?: number;
  barColor?: string;
}) {
  const t = `translate(50 50) scale(${scale}) translate(-50 -50)`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <g transform={t}>
        {/* หูถุง (เส้นบาง โค้งกว้าง — ไม่ให้ดูเป็นแม่กุญแจ) */}
        <path
          d="M36.5 44 V33 a13.5 11 0 0 1 27 0 V44"
          fill="none"
          stroke="#ffffff"
          strokeWidth={4}
          strokeLinecap="round"
        />
        {/* ตัวถุง (ล่างกว้างกว่าบนนิดๆ) */}
        <path
          d="M26 38 H74 Q77 38 77.4 41 L80.6 77 Q81 84 74 84 H26 Q19 84 19.4 77 L22.6 41 Q23 38 26 38 Z"
          fill="#ffffff"
        />
        {/* รูร้อยหูถุง + รอยพับขอบบน */}
        <circle cx={36.5} cy={45} r={2.4} fill={barColor} />
        <circle cx={63.5} cy={45} r={2.4} fill={barColor} />
        <rect x={23.5} y={40.6} width={53} height={1.2} rx={0.6} fill={barColor} opacity={0.25} />
        {/* บาร์โค้ด */}
        {BARS.map(([x, w]) => (
          <rect key={x} x={x} y={53} width={w} height={22} rx={0.6} fill={barColor} />
        ))}
        {/* เส้นสแกน */}
        <rect x={28} y={63} width={44} height={2.2} rx={1.1} fill="#f43f5e" />
      </g>
    </svg>
  );
}

/** โลโก้ในหน้าเว็บ (สี่เหลี่ยมมน พื้นส้มไล่สี) */
export function LogoMark({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center overflow-hidden shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: LOGO_GRADIENT,
      }}
    >
      <LogoGlyph size={size} />
    </span>
  );
}
