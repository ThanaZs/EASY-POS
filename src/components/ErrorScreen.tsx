"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

const TEXT = {
  th: {
    title: "โหลดหน้านี้ไม่สำเร็จ",
    body: "อาจเป็นเพราะเน็ตหลุด หรือระบบเพิ่งอัปเดต ลองใหม่อีกครั้งได้เลย ข้อมูลที่บันทึกแล้วไม่หาย",
    retry: "ลองใหม่",
    reload: "โหลดหน้าใหม่ทั้งหมด",
    code: "รหัสอ้างอิง",
  },
  en: {
    title: "This page couldn't load",
    body: "Your connection may have dropped or the app was just updated. Please try again — saved data is safe.",
    retry: "Try again",
    reload: "Reload page",
    code: "Reference",
  },
};

/** หน้าแสดงเมื่อเกิด error (ใช้ใน error.tsx / global-error.tsx) */
let autoRetries: number[] = []; // ลองใหม่เองไม่เกิน 3 ครั้งต่อนาที (กันวนไม่จบถ้าเซิร์ฟเวอร์มีปัญหาจริง)

export function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  const lang = typeof window !== "undefined" && window.location.pathname.startsWith("/en") ? "en" : "th";
  const t = TEXT[lang];
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  useEffect(() => {
    console.error(error);
    // เน็ตหลุดชั่วคราว (เช่น iPad/มือถือเพิ่งปลุกจากพักหน้าจอ — Safari แจ้ง "Load failed") → รอเน็ตมาแล้วลองใหม่เอง
    // + error ฝั่ง server (มี digest เช่นฐานข้อมูลช้าชั่วคราว) → ลองใหม่เองด้วย (จำกัด 3 ครั้ง/นาที)
    if (digest || /Load failed|Failed to fetch|NetworkError|network connection/i.test(msg)) {
      let done = false;
      const again = () => {
        if (done || !navigator.onLine) return;
        const now = Date.now();
        autoRetries = autoRetries.filter((t) => now - t < 60_000);
        if (autoRetries.length >= 3) return;
        autoRetries.push(now);
        done = true;
        retry();
      };
      const timer = setTimeout(again, 1500);
      window.addEventListener("online", again);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("online", again);
      };
    }
    // ไฟล์ JS ของเวอร์ชันเก่าหาย (เพิ่ง deploy) → reload เต็มหน้าอัตโนมัติ 1 ครั้ง
    if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Server Action/i.test(msg)) {
      try {
        if (!sessionStorage.getItem("ep_reloaded")) {
          sessionStorage.setItem("ep_reloaded", "1");
          window.location.reload();
        }
      } catch {
        // sessionStorage ใช้ไม่ได้ — ให้ผู้ใช้กดเอง
      }
    }
  }, [error, msg, retry, digest]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4 py-10" role="alert">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-card p-6 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-soft text-brand-ink">
          <TriangleAlert className="size-6" />
        </span>
        <h1 className="text-lg font-bold">{t.title}</h1>
        <p className="text-sm text-muted">{t.body}</p>
        <button
          onClick={retry}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white"
        >
          <RotateCw className="size-4" /> {t.retry}
        </button>
        <button
          onClick={() => window.location.reload()}
          className="w-full rounded-xl border border-line px-4 py-2.5 font-medium"
        >
          {t.reload}
        </button>
        <p className="break-all text-xs text-muted">
          {t.code}: <code className="select-all">{digest ?? msg.slice(0, 160)}</code>
        </p>
      </div>
    </div>
  );
}
