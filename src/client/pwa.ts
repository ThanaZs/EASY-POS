"use client";

import { useSyncExternalStore } from "react";

// เก็บ event "beforeinstallprompt" (Chrome/Edge/Samsung บน Android และคอม) ไว้กดติดตั้งทีหลังได้
// ต้องเริ่มฟังตั้งแต่โหลดหน้า เพราะเบราว์เซอร์ส่ง event มาครั้งเดียว

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startPwaListener() {
  if (typeof window === "undefined" || (window as unknown as { __epPwa?: boolean }).__epPwa) return;
  (window as unknown as { __epPwa?: boolean }).__epPwa = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // เก็บไว้ แสดงตอนเราเปิดป๊อปอัพเอง
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

/** เปิดเป็นแอปที่ติดตั้งแล้วอยู่หรือเปล่า */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export type Platform = "ios" | "android" | "samsung" | "desktop";
export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function useInstallPrompt() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (installed ? "installed" : deferred ? "ready" : "none"),
    () => "none",
  );
  return {
    state,
    async install(): Promise<boolean> {
      if (!deferred) return false;
      const e = deferred;
      deferred = null;
      emit();
      await e.prompt();
      return (await e.userChoice).outcome === "accepted";
    },
  };
}
