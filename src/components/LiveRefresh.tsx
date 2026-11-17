"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 30_000; // ระหว่างเปิดหน้าอยู่: ดึงข้อมูลใหม่ทุก 30 วินาที
const MIN_GAP_MS = 5_000; // กันดึงถี่เกิน (focus + visibility มาพร้อมกัน)

/**
 * ข้อมูลตรงกันทุกเครื่อง: เครื่องหนึ่งแก้ (เช่นคอมเพิ่มสินค้า) → อีกเครื่อง (มือถือ) เห็นเองโดยไม่ต้องกดรีเฟรช
 * - กลับมาที่แอป/แท็บ, ต่อเน็ตได้อีกครั้ง → ดึงทันที
 * - เปิดหน้าค้างไว้ → ดึงทุก 30 วินาที (ข้ามตอนกำลังพิมพ์ในช่องกรอก หรือมีหน้าต่างป๊อปอัพเปิดอยู่)
 * ใช้ router.refresh(): โหลดข้อมูลจาก server ใหม่ แต่สิ่งที่อยู่ในหน้า (ตะกร้า, ข้อความที่พิมพ์) ไม่หาย
 */
export function LiveRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  // หน้าล็อกอิน/สมัคร/ลืมรหัส: ไม่มีข้อมูลให้รีเฟรช — และการรีเฟรชระหว่างกดเข้าสู่ระบบทำให้ช้า/สะดุด
  const off = /\/(login|register|signup|forgot|reset|verify)/.test(pathname);
  useEffect(() => {
    if (off) return;
    let last = Date.now();
    let submittedAt = 0;
    const onSubmit = () => {
      submittedAt = Date.now();
    };
    const busy = () => {
      const a = document.activeElement;
      const typing = a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement;
      return typing || !!document.querySelector("dialog[open], [role=dialog]");
    };
    const refresh = (force: boolean) => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      if (!force && busy()) return;
      if (Date.now() - submittedAt < 8_000) return; // เพิ่งกดบันทึก/ส่งฟอร์ม → อย่าแทรก (ให้คำสั่งนั้นเสร็จก่อน)
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      router.refresh();
    };
    // เพิ่งกลับมา/ปลุกเครื่อง: เน็ตมักยังต่อไม่เสร็จ → รอ 1.5 วิก่อนดึง (กันโหลดพังขึ้นหน้า error)
    let wake: ReturnType<typeof setTimeout> | undefined;
    const onBack = () => {
      clearTimeout(wake);
      wake = setTimeout(() => refresh(true), 1500);
    };
    const onVisible = () => document.visibilityState === "visible" && onBack();
    const timer = setInterval(() => refresh(false), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onBack);
    window.addEventListener("online", onBack);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      clearInterval(timer);
      clearTimeout(wake);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onBack);
      window.removeEventListener("online", onBack);
    };
  }, [router, off]);
  return null;
}
