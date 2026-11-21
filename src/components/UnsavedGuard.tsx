"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Save } from "lucide-react";

export type UnsavedT = {
  title: string;
  message: string;
  save: string;
  leave: string;
  stay: string;
};

/** ค่าในฟอร์มทั้งหมดเป็นข้อความเดียว — ไว้เทียบว่าแก้อะไรไปหรือยัง */
function snapshot(form: HTMLFormElement): string {
  const out: string[] = [];
  for (const [k, v] of new FormData(form)) {
    if (k.startsWith("$ACTION")) continue; // ช่องภายในของ server action
    out.push(`${k}=${typeof v === "string" ? v : `file:${v.name}:${v.size}`}`);
  }
  return out.join("\n");
}

/**
 * เตือน "ยังไม่ได้บันทึก" เมื่อแก้ฟอร์มแล้วจะออกจากหน้า — วางไว้ข้างในฟอร์ม
 * - กดลิงก์ในแอป (ปุ่มกลับ ←, เมนู) → หน้าต่าง: บันทึก / ออกโดยไม่บันทึก / อยู่หน้านี้ต่อ
 * - ปุ่มย้อนกลับของเบราว์เซอร์/มือถือ → หน้าต่างเดียวกัน (กันด้วย history entry สำรอง)
 * - ปิดแท็บ/รีเฟรช → เบราว์เซอร์ถามเอง (กำหนดข้อความไม่ได้)
 */
export function UnsavedGuard({ t }: { t: UnsavedT }) {
  const router = useRouter();
  const anchor = useRef<HTMLSpanElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const state = useRef({
    initial: "",
    off: false, // กดบันทึก/เลือกออกแล้ว — ไม่ต้องเตือน
    trap: false, // ใส่ history entry สำรองไว้แล้ว (ดักปุ่มย้อนกลับ)
    next: null as null | (() => void), // ทำอะไรต่อถ้าเลือก "ออก"
  });

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const s = state.current;
    // เก็บค่าตั้งต้นหลังฟอร์มวาดเสร็จ (ค่าเริ่มต้นจาก JS ของช่องต่างๆ)
    const t0 = window.setTimeout(() => (s.initial = snapshot(form)), 300);
    const dirty = () => !s.off && !!s.initial && snapshot(form) !== s.initial;
    const ask = (next: () => void) => {
      s.next = next;
      if (!dialog.current?.open) dialog.current?.showModal();
    };

    // แก้ครั้งแรก → ใส่ history entry สำรอง (กดย้อนกลับครั้งแรกจะมาเจอหน้าต่างเตือนแทน)
    const onEdit = () => {
      if (s.trap || !dirty()) return;
      s.trap = true;
      history.pushState({ ...history.state, __unsaved: 1 }, "", location.href);
    };
    const onPop = () => {
      if (!s.trap) return;
      s.trap = false;
      if (!dirty()) return history.back(); // แก้กลับเหมือนเดิมแล้ว → ออกตามปกติ
      ask(() => history.back());
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.target === "_blank") return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search)
        return;
      if (!dirty()) return;
      e.preventDefault();
      e.stopPropagation();
      ask(() => router.push(url.pathname + url.search + url.hash));
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!dirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onSubmit = () => {
      s.off = true; // ส่งแล้ว — redirect หลังบันทึกไม่ต้องเตือน
      // บันทึกไม่ผ่าน (ยังอยู่หน้าเดิม) → เตือนต่อจากค่าล่าสุด
      window.setTimeout(() => {
        if (!form.isConnected) return;
        s.off = false;
        s.initial = snapshot(form);
      }, 4000);
    };

    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
    form.addEventListener("submit", onSubmit);
    window.addEventListener("popstate", onPop);
    window.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.clearTimeout(t0);
      form.removeEventListener("input", onEdit);
      form.removeEventListener("change", onEdit);
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [router]);

  const s = state.current;
  const close = () => dialog.current?.close();
  /** อยู่ต่อ: ใส่ entry สำรองกลับ (ถ้าเพิ่งโดนปุ่มย้อนกลับดึงออกไป) */
  const stay = () => {
    close();
    if (!s.trap) {
      s.trap = true;
      history.pushState({ ...history.state, __unsaved: 1 }, "", location.href);
    }
  };
  const leave = () => {
    close();
    s.off = true;
    const next = s.next;
    s.next = null;
    if (s.trap) {
      // ลบ entry สำรองก่อน แล้วค่อยไปต่อ
      s.trap = false;
      const go = () => next?.();
      window.addEventListener("popstate", go, { once: true });
      history.back();
    } else next?.();
  };
  const save = () => {
    stay(); // ถ้าบันทึกไม่ผ่าน (ช่องบังคับว่าง) ยังกันปุ่มย้อนกลับอยู่
    anchor.current?.closest("form")?.requestSubmit();
  };

  return (
    <>
      <span ref={anchor} hidden />
      <dialog
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          stay();
        }}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950">
              <CircleAlert className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">{t.title}</h2>
              <p className="text-sm text-muted">{t.message}</p>
            </div>
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={save}
              autoFocus
              className="flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white active:scale-[.98]"
            >
              <Save className="size-4" /> {t.save}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={leave}
                className="rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-rose-600 hover:border-rose-300"
              >
                {t.leave}
              </button>
              <button
                type="button"
                onClick={stay}
                className="rounded-xl border border-line px-3 py-2.5 text-sm font-medium hover:border-brand"
              >
                {t.stay}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
