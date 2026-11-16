import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone = build แล้วได้ server ที่รันเองได้ (Docker / VPS / Cloud Run / Railway ...) นอกจาก Vercel
  output: "standalone",
  // กัน "version skew": deploy ใหม่ระหว่างที่ผู้ใช้เปิดแท็บค้างไว้ → แท็บเก่าจะ reload เต็มหน้าเอง แทนที่จะขึ้น "This page couldn't load"
  // Vercel ใส่ค่าให้อัตโนมัติ; ที่อื่นตั้ง NEXT_DEPLOYMENT_ID เอง (เช่น git sha)
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
