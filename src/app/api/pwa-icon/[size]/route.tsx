import { ImageResponse } from "next/og";

// ไอคอนแอป (สร้างจากโค้ด ไม่ต้องมีไฟล์รูป) — /api/pwa-icon/192, /512, /180 (iPhone), ?maskable=1 (Android ตัดขอบเป็นวงกลม/มน)
const SIZES = new Set([180, 192, 512]);

export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("not found", { status: 404 });
  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const font = Math.round(size * (maskable ? 0.32 : 0.4));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f97316 0%, #ea580c 55%, #c2410c 100%)",
          borderRadius: radius,
          color: "#fff",
          fontSize: font,
          fontWeight: 800,
          letterSpacing: -font * 0.04,
        }}
      >
        EP
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
