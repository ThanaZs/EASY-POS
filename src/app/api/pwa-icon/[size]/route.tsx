import { ImageResponse } from "next/og";
import { LOGO_GRADIENT, LogoGlyph } from "@/components/LogoMark";

// ไอคอนแอป (สร้างจากโค้ด ไม่ต้องมีไฟล์รูป) — /api/pwa-icon/192, /512, /180 (iPhone), ?maskable=1 (Android ตัดขอบเป็นวงกลม/มน)
// รูป = โลโก้ถุงช้อปปิ้ง + บาร์โค้ด (components/LogoMark) บนพื้นส้มไล่สี
const SIZES = new Set([32, 180, 192, 512]);

export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("not found", { status: 404 });
  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  // iPhone (180) / maskable ตัดมุมเอง → ส่งสี่เหลี่ยมเต็ม; ขนาดอื่นทำมุมมนให้
  const radius = maskable || size === 180 ? 0 : Math.round(size * 0.22);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: LOGO_GRADIENT,
          borderRadius: radius,
        }}
      >
        <LogoGlyph size={size} scale={maskable ? 0.78 : 1} />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
