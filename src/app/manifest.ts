import type { MetadataRoute } from "next";

// ทำให้ "ติดตั้งแอป" ได้ (PWA) — เปิดแล้วเต็มจอเหมือนแอป มีไอคอนบนหน้าจอหลัก
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EASY-POS",
    short_name: "EASY-POS",
    description: "ระบบขายหน้าร้าน ใช้ง่าย ทุกอุปกรณ์",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fff8f2",
    theme_color: "#ea580c",
    icons: [
      { src: "/api/pwa-icon/192?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/pwa-icon/512?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/pwa-icon/512?maskable=1&v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
