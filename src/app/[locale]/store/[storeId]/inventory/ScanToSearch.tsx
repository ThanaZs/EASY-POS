"use client";

import { usePathname, useRouter } from "next/navigation";
import { useBarcodeScanner } from "@/client/devices/scanner";
import { ScannerStatus } from "@/components/devices/ScannerStatus";
import type { Dictionary } from "@/i18n/dictionary";

/** หน้าคลังสินค้า: ยิงบาร์โค้ด → ค้นหาสินค้านั้นทันที */
export function ScanToSearch({ devices }: { devices: Dictionary["devices"] }) {
  const router = useRouter();
  const pathname = usePathname();
  useBarcodeScanner((code) => router.push(`${pathname}?q=${encodeURIComponent(code)}`));
  return <ScannerStatus t={devices} />;
}
