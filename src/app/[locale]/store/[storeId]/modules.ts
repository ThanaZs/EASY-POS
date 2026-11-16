import {
  BarChart3,
  Boxes,
  CalendarClock,
  Calculator,
  ClipboardList,
  LayoutDashboard,
  PackagePlus,
  Settings,
  Tag,
  Users,
  UserSquare2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/core/domain/types";
import type { Dictionary } from "@/i18n/dictionary";

export type ModuleKey = keyof Dictionary["store"]["modules"];

// เมนูในร้าน — เพิ่มโมดูลใหม่: เพิ่มที่นี่ + คำแปลใน messages/*.json
export const MODULES: Array<{ key: ModuleKey; Icon: LucideIcon; color: string; permission: Permission }> = [
  { key: "pos", Icon: Calculator, color: "bg-slate-800", permission: "pos.sell" },
  { key: "inventory", Icon: Boxes, color: "bg-teal-600", permission: "products.view" },
  { key: "overview", Icon: LayoutDashboard, color: "bg-indigo-600", permission: "reports.view" },
  { key: "receive", Icon: PackagePlus, color: "bg-violet-600", permission: "stock.receive" },
  { key: "reports", Icon: BarChart3, color: "bg-emerald-600", permission: "reports.view" },
  { key: "history", Icon: ClipboardList, color: "bg-sky-600", permission: "stock.history" },
  { key: "members", Icon: UserSquare2, color: "bg-amber-500", permission: "customers.manage" },
  { key: "staff", Icon: Users, color: "bg-cyan-700", permission: "staff.manage" },
  { key: "labels", Icon: Tag, color: "bg-rose-500", permission: "products.view" },
  { key: "expiry", Icon: CalendarClock, color: "bg-orange-500", permission: "products.view" },
  { key: "expenses", Icon: Wallet, color: "bg-yellow-700", permission: "expenses.manage" },
  { key: "settings", Icon: Settings, color: "bg-zinc-600", permission: "store.settings" },
];
