import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone = build แล้วได้ server ที่รันเองได้ (Docker / VPS / Cloud Run / Railway ...) นอกจาก Vercel
  output: "standalone",
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
