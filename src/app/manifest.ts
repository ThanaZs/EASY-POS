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
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
