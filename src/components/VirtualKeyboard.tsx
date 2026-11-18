"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowBigUp, Delete } from "lucide-react";
import { setInputValue } from "@/client/devices/scanner";

// ===== คีย์บอร์ดของ EASY-POS เอง (เฉพาะ iPhone/iPad) =====
// ปัญหา: iPhone/iPad ต่อเครื่องสแกน Bluetooth (เป็น "คีย์บอร์ดจริง") → iOS ซ่อนคีย์บอร์ดบนจอ แตะช่องแล้วพิมพ์ไม่ได้
// แก้: บน iOS แตะช่องพิมพ์ = เปิดคีย์บอร์ดนี้ทุกครั้ง (ตัวเลข / ไทย / อังกฤษ)
// และปิดคีย์บอร์ดระบบด้วย inputmode=none ไม่ให้ขึ้นซ้อนกัน; Android/คอม ไม่มีปัญหานี้ → ไม่ใช้เลย

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

type Mode = "num" | "th" | "en" | "sym";
type Target = HTMLInputElement | HTMLTextAreaElement;

const TH = [
  ["ๅ", "/", "-", "ภ", "ถ", "ุ", "ึ", "ค", "ต", "จ", "ข", "ช"],
  ["ๆ", "ไ", "ำ", "พ", "ะ", "ั", "ี", "ร", "น", "ย", "บ", "ล"],
  ["ฟ", "ห", "ก", "ด", "เ", "้", "่", "า", "ส", "ว", "ง"],
  ["ผ", "ป", "แ", "อ", "ิ", "ื", "ท", "ม", "ใ", "ฝ"],
];
const TH_SHIFT = [
  ["+", "๑", "๒", "๓", "๔", "ู", "฿", "๕", "๖", "๗", "๘", "๙"],
  ["๐", '"', "ฎ", "ฑ", "ธ", "ํ", "๊", "ณ", "ฯ", "ญ", "ฐ", "ฃ"],
  ["ฤ", "ฆ", "ฏ", "โ", "ฌ", "็", "๋", "ษ", "ศ", "ซ", "ฅ"],
  ["(", ")", "ฉ", "ฮ", "ฺ", "์", "?", "ฒ", "ฬ", "ฦ"],
];
const EN = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];
const SYM = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "฿", "&", "@", '"'],
  [".", ",", "?", "!", "'", "*", "#", "%", "+", "="],
  ["_", "\\", "<", ">", "[", "]", "{", "}"],
];

const TEXT_TYPES = new Set([
  "text",
  "search",
  "tel",
  "url",
  "password",
  "email",
  "number",
  "",
]);
const isTypable = (el: EventTarget | null): el is Target =>
  (el instanceof HTMLInputElement &&
    TEXT_TYPES.has(el.type) &&
    !el.readOnly &&
    !el.disabled) ||
  (el instanceof HTMLTextAreaElement && !el.readOnly && !el.disabled);
// ช่องที่ถูกปิดคีย์บอร์ดระบบ (inputmode=none) จำค่าเดิมไว้ใน data-vkb-im → ใช้เลือกแป้นตัวเลข
const origMode = (el: Target) => el.dataset.vkbIm ?? el.inputMode;
const isNumeric = (el: Target) =>
  el instanceof HTMLInputElement &&
  (el.type === "number" ||
    ["numeric", "decimal", "tel"].includes(origMode(el)));
/** ปิดคีย์บอร์ดของ iOS สำหรับช่องนี้ (ใช้ของเราแทน) */
const suppressSystem = (el: Target) => {
  if (el.inputMode === "none") return;
  el.dataset.vkbIm = el.inputMode;
  el.inputMode = "none";
};

const LANG_KEY = "ep_vkb_lang";

export function VirtualKeyboard({
  labels,
}: {
  labels: { done: string; space: string };
}) {
  const pathname = usePathname();
  const [opened, setOpened] = useState<{ el: Target; path: string } | null>(
    null,
  );
  const [mode, setMode] = useState<Mode>("th");
  const [shift, setShift] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  // เปลี่ยนหน้า / ช่องถูกลบออกจากหน้า → ไม่แสดงคีย์บอร์ดค้างบนหน้าอื่น
  const target =
    opened && opened.path === pathname && opened.el.isConnected
      ? opened.el
      : null;
  const setTarget = (el: Target | null) =>
    setOpened(el ? { el, path: window.location.pathname } : null);

  const open = (el: Target) => {
    setTarget(el);
    setShift(false);
    let lang: Mode = "th";
    try {
      lang = localStorage.getItem(LANG_KEY) === "en" ? "en" : "th";
    } catch {
      // ignore
    }
    setMode(
      isNumeric(el)
        ? "num"
        : el.getAttribute("lang") === "en" ||
            ["email", "password", "url"].includes(el.type)
          ? "en"
          : lang,
    );
    setTimeout(
      () => el.scrollIntoView({ block: "center", behavior: "smooth" }),
      50,
    );
  };

  useEffect(() => {
    if (!isIOS()) return; // Android/คอม ไม่ต้องใช้
    // ปิดคีย์บอร์ดระบบตั้งแต่ตอนแตะ (ก่อนโฟกัส) — ตั้งหลังโฟกัสแล้ว iOS อาจเด้งคีย์บอร์ดตัวเองขึ้นมาก่อน
    const onTouch = (e: Event) => {
      const el = e.target;
      if (isTypable(el) && !panel.current?.contains(el)) suppressSystem(el);
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (!isTypable(el) || panel.current?.contains(el)) return;
      suppressSystem(el);
      open(el);
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget;
      if (next && (isTypable(next) || panel.current?.contains(next as Node)))
        return;
      setTimeout(() => {
        if (!isTypable(document.activeElement)) setTarget(null);
      }, 120);
    };
    document.addEventListener("touchstart", onTouch, {
      capture: true,
      passive: true,
    });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("touchstart", onTouch, { capture: true });
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // iOS: ตอนมีช่องพิมพ์โฟกัสอยู่ position:fixed ไม่ติดจอ (เลื่อนตามหน้า) → วางตำแหน่งเองทุกเฟรม
  // ที่ขอบล่างของส่วนที่มองเห็น (visualViewport) ในพิกัดของหน้า → ติดล่างจอเสมอเหมือนคีย์บอร์ดระบบ
  // เผื่อ 64px ล่างสุดให้แถบ ˄ ˅ ✓ ของ iOS (พื้นหลังยาวลงไปใต้แถบ ไม่มีช่องว่าง)
  const lift = 64;
  useEffect(() => {
    if (!target) return;
    let raf = 0;
    let last = NaN;
    const vv = window.visualViewport;
    const put = () => {
      const p = panel.current;
      if (!p) return;
      const bottom = vv
        ? vv.pageTop + vv.height
        : window.scrollY + window.innerHeight;
      const top = Math.round(bottom - p.offsetHeight);
      if (top !== last) {
        p.style.transform = `translate3d(0, ${top}px, 0)`;
        last = top;
      }
    };
    const loop = () => {
      put();
      raf = requestAnimationFrame(loop);
    };
    loop();
    // เผื่อบางจังหวะ rAF หยุด (เลื่อนแบบ momentum) → วางใหม่ทันทีที่มี scroll/resize ด้วย
    window.addEventListener("scroll", put, { passive: true });
    vv?.addEventListener("scroll", put);
    vv?.addEventListener("resize", put);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", put);
      vv?.removeEventListener("scroll", put);
      vv?.removeEventListener("resize", put);
    };
  }, [target]);

  // ดันเนื้อหาขึ้นไม่ให้คีย์บอร์ดบังช่อง
  useEffect(() => {
    if (!target) return;
    const h = panel.current?.offsetHeight ?? 0; // รวมส่วนที่เผื่อแถบ iOS แล้ว
    document.body.style.paddingBottom = `${h}px`;
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [target, mode]);

  function insert(text: string) {
    const el = target;
    if (!el) return;
    const v = el.value;
    let start = v.length;
    let end = v.length;
    try {
      start = el.selectionStart ?? v.length;
      end = el.selectionEnd ?? v.length;
    } catch {
      // type=number ไม่มี selection → ต่อท้าย
    }
    const max = el.maxLength > 0 ? el.maxLength : Infinity;
    const next = (v.slice(0, start) + text + v.slice(end)).slice(0, max);
    setInputValue(el, next);
    try {
      el.setSelectionRange(start + text.length, start + text.length);
    } catch {
      // ignore
    }
    if (shift) setShift(false);
  }
  function backspace() {
    const el = target;
    if (!el) return;
    const v = el.value;
    let start = v.length;
    let end = v.length;
    try {
      start = el.selectionStart ?? v.length;
      end = el.selectionEnd ?? v.length;
    } catch {
      // ignore
    }
    if (start === end && start === 0) return;
    const from = start === end ? start - 1 : start;
    setInputValue(el, v.slice(0, from) + v.slice(end));
    try {
      el.setSelectionRange(from, from);
    } catch {
      // ignore
    }
  }
  function done() {
    const el = target;
    if (el) {
      // Enter ให้ช่องค้นหา/สแกนทำงานต่อ (หน้าที่ฟัง Enter เช่นค้นหาในระบบขาย)
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
      el.blur();
    }
    setTarget(null);
  }
  const setLang = (m: "th" | "en") => {
    setMode(m);
    try {
      localStorage.setItem(LANG_KEY, m);
    } catch {
      // ignore
    }
  };

  // ป้องกันปุ่มแย่งโฟกัส (ช่องยังโฟกัสอยู่ เคอร์เซอร์ไม่หาย)
  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
  const key = (label: React.ReactNode, onPress: () => void, cls = "") => (
    <button
      type="button"
      onPointerDown={keep}
      onMouseDown={keep}
      onClick={onPress}
      className={`h-11 min-w-0 flex-1 select-none rounded-lg text-lg shadow-sm transition active:scale-95 ${
        cls.includes("bg-") ? "" : "bg-card text-ink active:bg-brand-soft" // ปุ่มสี (เสร็จ) ไม่ใช้พื้นการ์ด
      } ${cls}`}
    >
      {label}
    </button>
  );

  if (!target) return null;

  const rows =
    mode === "th" ? (shift ? TH_SHIFT : TH) : mode === "en" ? EN : SYM;
  return (
    <div
      ref={panel}
      // พื้นหลังยาวถึงขอบล่างจอ (ใต้แถบ ˄ ˅ ✓ ของ iOS) → ไม่มีช่องว่างเห็นหน้าเว็บ ปุ่มอยู่เหนือแถบพอดี
      style={{ paddingBottom: `calc(${lift}px + env(safe-area-inset-bottom))` }}
      className="absolute inset-x-0 top-0 z-[80] space-y-1.5 border-t border-line bg-surface p-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
      onPointerDown={keep}
    >
      {mode === "num" ? (
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <div key={d} className="flex">
              {key(d, () => insert(d), "h-12 text-2xl")}
            </div>
          ))}
          <div className="flex">
            {key(".", () => insert("."), "h-12 text-2xl")}
          </div>
          <div className="flex">
            {key("0", () => insert("0"), "h-12 text-2xl")}
          </div>
          <div className="flex">
            {key(<Delete className="mx-auto size-6" />, backspace, "h-12")}
          </div>
          <div className="col-span-3 flex">
            {key(labels.done, done, "h-12 bg-brand font-semibold text-white")}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-1">
              {i === rows.length - 1 &&
                mode !== "sym" &&
                key(
                  <ArrowBigUp
                    className={`mx-auto size-5 ${shift ? "fill-current" : ""}`}
                  />,
                  () => setShift((s) => !s),
                  "flex-[1.5]",
                )}
              {row.map((c) => {
                const ch = mode === "en" && shift ? c.toUpperCase() : c;
                return (
                  <div key={c} className="flex min-w-0 flex-1">
                    {key(ch, () => insert(ch))}
                  </div>
                );
              })}
              {i === rows.length - 1 &&
                key(
                  <Delete className="mx-auto size-5" />,
                  backspace,
                  "flex-[1.5]",
                )}
            </div>
          ))}
          <div className="flex gap-1">
            {key(
              mode === "sym" ? "กขค" : "?123",
              () => setMode(mode === "sym" ? "th" : "sym"),
              "flex-[1.5] text-sm",
            )}
            {key(
              mode === "en" ? "ไทย" : "EN",
              () => setLang(mode === "en" ? "th" : "en"),
              "flex-[1.2] text-sm",
            )}
            {key(labels.space, () => insert(" "), "flex-[4] text-sm")}
            {key(
              labels.done,
              done,
              "flex-[2] bg-brand text-sm font-semibold text-white",
            )}
          </div>
        </div>
      )}
    </div>
  );
}
