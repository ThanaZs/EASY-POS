import "server-only";
import { cookies } from "next/headers";

export type Theme = "light" | "dark";

/** ธีมที่ผู้ใช้เลือก (cookie "theme") — ค่าเริ่มต้นสว่าง */
export async function getTheme(): Promise<Theme> {
  return (await cookies()).get("theme")?.value === "dark" ? "dark" : "light";
}
