"use client";

import { useEffect } from "react";

const IDLE_MS = 30 * 60 * 1000; // ไม่ได้ใช้งาน 30 นาที
const KEY = "ep_last_active";

const now = () => Date.now();
function readLast(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}
function markActive() {
  try {
    localStorage.setItem(KEY, String(now()));
  } catch {
    // ใช้ localStorage ไม่ได้ (โหมดส่วนตัว) — ข้าม
  }
}

/**
 * รีเฟรชหน้าอัตโนมัติเพื่อให้ได้ข้อมูล/เวอร์ชันล่าสุด:
 * - ไม่ได้แตะหน้าเว็บเกิน 30 นาที
 * - สลับไปแอปอื่น/ปิดหน้าจอ แล้วกลับมาหลังเกิน 30 นาที
 * - เบราว์เซอร์คืนหน้าเก่าจากแคช (กด back / เปิดแท็บเดิมบนมือถือ)
 * ถ้า session หมดอายุแล้ว การรีเฟรชจะพาไปหน้าเข้าสู่ระบบเอง
 */
export function IdleRefresh() {
  useEffect(() => {
    markActive();
    let lastWrite = now();
    // ใช้ค่าใน localStorage เป็นหลัก (ใช้งานแท็บไหนก็นับ) — ใช้ไม่ได้ค่อยใช้ค่าในหน่วยความจำ
    const idleTooLong = () => now() - (readLast() || lastWrite) > IDLE_MS;
    const refresh = () => window.location.reload();

    const onActivity = () => {
      if (idleTooLong()) return refresh();
      if (now() - lastWrite > 10_000) {
        lastWrite = now();
        markActive();
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && idleTooLong()) refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh(); // หน้ามาจาก bfcache = ข้อมูลเก่า
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && idleTooLong()) refresh();
    }, 60_000);

    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
  return null;
}
