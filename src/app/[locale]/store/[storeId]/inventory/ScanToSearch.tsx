"use client";

import { ScannerStatus } from "@/components/devices/ScannerStatus";
import type { Dictionary } from "@/i18n/dictionary";

/** หน้าคลังสินค้า: ปุ่มสถานะเครื่องสแกน — การยิงบาร์โค้ดเพื่อค้นหาอยู่ใน InventoryFilters (คุมช่องค้นหาเอง) */
export function ScanToSearch({ devices }: { devices: Dictionary["devices"] }) {
  return <ScannerStatus t={devices} />;
}
