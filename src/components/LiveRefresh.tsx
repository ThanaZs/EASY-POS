"use client";

import { useRouter } from "next/navigation";
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
  useEffect(() => {
    let last = Date.now();
    const busy = () => {
      const a = document.activeElement;
      const typing = a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement;
      return typing || !!document.querySelector("dialog[open], [role=dialog]");
    };
    const refresh = (force: boolean) => {
      if (document.visibilityState !== "visible") return;
      if (!force && busy()) return;
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      router.refresh();
    };
    const onBack = () => refresh(true);
    const onVisible = () => document.visibilityState === "visible" && refresh(true);
    const timer = setInterval(() => refresh(false), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onBack);
    window.addEventListener("online", onBack);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onBack);
      window.removeEventListener("online", onBack);
    };
  }, [router]);
  return null;
}
