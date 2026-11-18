import {
  BarChart3,
  ClipboardList,
  Boxes,
  Calculator,
  PackagePlus,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/core/domain/types";
import type { Dictionary } from "@/i18n/dictionary";

export type ModuleKey = keyof Dictionary["store"]["modules"];

// เมนูในร้าน (5 ปุ่ม) — หน้าย่อยอื่นอยู่ในแท็บ/ปุ่มของหน้านั้นๆ:
//   คลังสินค้า → ประวัติสต็อก | ยอดขาย → ภาพรวม + บิลทั้งหมด | ตั้งค่าร้าน → ข้อมูลร้าน + พนักงาน
// เพิ่มโมดูลใหม่: เพิ่มที่นี่ + คำแปลใน messages/*.json
// anyOf = เห็นปุ่มถ้ามีสิทธิ์ข้อใดข้อหนึ่ง; path = หน้าที่เปิด (ตัวแรกที่มีสิทธิ์)
export const MODULES: Array<{
  key: ModuleKey;
  Icon: LucideIcon;
  color: string;
  anyOf: Array<{ permission: Permission; path: string }>;
}> = [
  {
    key: "pos",
    Icon: Calculator,
    color: "bg-slate-800",
    anyOf: [{ permission: "pos.sell", path: "pos" }],
  },
  {
    key: "inventory",
    Icon: Boxes,
    color: "bg-teal-600",
    anyOf: [{ permission: "products.view", path: "inventory" }],
  },
  {
    key: "receive",
    Icon: PackagePlus,
    color: "bg-violet-600",
    anyOf: [{ permission: "stock.receive", path: "receive" }],
  },
  {
    key: "overview",
    Icon: BarChart3,
    color: "bg-indigo-600",
    anyOf: [{ permission: "reports.view", path: "overview" }],
  },
  {
    key: "history",
    Icon: ClipboardList,
    color: "bg-sky-600",
    anyOf: [{ permission: "stock.history", path: "history" }],
  },
  {
    key: "settings",
    Icon: Settings,
    color: "bg-zinc-600",
    anyOf: [
      { permission: "store.settings", path: "settings" },
      { permission: "staff.manage", path: "staff" },
    ],
  },
];
