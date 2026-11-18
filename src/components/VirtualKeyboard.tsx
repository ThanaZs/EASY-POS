"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowBigUp,
  Check,
  ChevronDown,
  ChevronUp,
  Delete,
} from "lucide-react";
import {
  isScannerConnected,
  setInputValue,
  useScannerState,
} from "@/client/devices/scanner";

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
  labels: { done: string; space: string; prev: string; next: string };
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

  // ===== ล็อกหน้าไม่ให้เลื่อนระหว่างที่คีย์บอร์ดเปิด → คีย์บอร์ดนิ่ง 100% =====
  // iOS: ตอนมีช่องพิมพ์โฟกัสอยู่ position:fixed จะเลื่อนตามหน้า → ตรึง body ไว้ (position:fixed; top:-y)
  // หน้าเลื่อนไม่ได้ = คีย์บอร์ดไม่ขยับ; ระบบเลื่อนช่องที่พิมพ์ขึ้นมาให้เห็นเอง (ย้าย top ของ body)
  // ปิดคีย์บอร์ด → ปลดล็อก แล้วกลับไปตำแหน่งเดิมของหน้า
  // เผื่อ 64px ล่างสุดให้แถบ ˄ ˅ ✓ ของ iOS (พื้นหลังคีย์บอร์ดยาวลงไปใต้แถบ ไม่มีช่องว่าง)
  // แถบ ˄ ˅ ✓ ของ iOS ขึ้นเฉพาะตอนมีคีย์บอร์ดจริง (เครื่องสแกน) ต่ออยู่ → เผื่อที่ 64px เฉพาะตอนนั้น
  const lift = isScannerConnected(useScannerState()) ? 64 : 0;
  const lockY = useRef(0);
  const isOpen = !!target;
  useEffect(() => {
    if (!isOpen) return;
    const b = document.body.style;
    const prev = {
      position: b.position,
      top: b.top,
      left: b.left,
      right: b.right,
      width: b.width,
    };
    lockY.current = window.scrollY;
    Object.assign(b, {
      position: "fixed",
      top: `-${lockY.current}px`,
      left: "0",
      right: "0",
      width: "100%",
    });
    return () => {
      Object.assign(b, prev);
      window.scrollTo(0, lockY.current);
    };
  }, [isOpen]);

  // เลื่อนช่องที่กำลังพิมพ์ให้อยู่เหนือคีย์บอร์ด (เฉพาะเมื่อโดนบัง/หลุดจอ)
  useEffect(() => {
    if (!target) return;
    const id = requestAnimationFrame(() => {
      const kb = panel.current?.offsetHeight ?? 0;
      const avail = window.innerHeight - kb; // ส่วนที่มองเห็นเหนือคีย์บอร์ด
      const r = target.getBoundingClientRect();
      if (r.top >= 8 && r.bottom <= avail - 8) return; // เห็นอยู่แล้ว ไม่ต้องขยับ
      const max = Math.max(0, document.body.scrollHeight - avail);
      const y = Math.min(
        max,
        Math.max(0, lockY.current + r.top + r.height / 2 - avail / 2),
      );
      lockY.current = y;
      document.body.style.top = `-${y}px`;
    });
    return () => cancelAnimationFrame(id);
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
  /** ˄ ˅ ไปช่องพิมพ์ก่อนหน้า/ถัดไปในหน้า (แทนแถบของ iOS ที่หายไปเมื่อปิดคีย์บอร์ดระบบ) */
  const fields = () =>
    [...document.querySelectorAll<Target>("input, textarea")].filter(
      (el) =>
        isTypable(el) &&
        el.getClientRects().length > 0 &&
        !el.closest("[data-vkb]"),
    );
  const step = (dir: 1 | -1) => {
    if (!target) return;
    const list = fields();
    const next = list[list.indexOf(target) + dir];
    if (next) next.focus();
  };
  const navState = (() => {
    if (!target) return { prev: false, next: false };
    const list = fields();
    const i = list.indexOf(target);
    return { prev: i > 0, next: i >= 0 && i < list.length - 1 };
  })();
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
      data-vkb
      // พื้นหลังยาวถึงขอบล่างจอ; เผื่อที่ให้แถบของ iOS เฉพาะตอนต่อเครื่องสแกน (ไม่งั้นไม่มีแถบ → ชิดล่าง)
      style={{
        paddingBottom: `calc(${lift}px + env(safe-area-inset-bottom))`,
      }}
      className="fixed inset-x-0 bottom-0 z-[80] space-y-1.5 border-t border-line bg-surface p-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
      onPointerDown={keep}
    >
      {/* แถบ ˄ ˅ เสร็จ ✓ (ของเราเอง อยู่บนคีย์บอร์ดเสมอ) */}
      <div className="mx-auto flex max-w-2xl items-center gap-1">
        {(
          [
            [-1, ChevronUp, navState.prev],
            [1, ChevronDown, navState.next],
          ] as const
        ).map(([dir, Icon, ok]) => (
          <button
            key={dir}
            type="button"
            onPointerDown={keep}
            onMouseDown={keep}
            onClick={() => step(dir)}
            disabled={!ok}
            aria-label={dir < 0 ? labels.prev : labels.next}
            className="grid h-9 w-12 place-items-center rounded-lg text-ink active:bg-brand-soft disabled:opacity-30"
          >
            <Icon className="size-6" />
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          onPointerDown={keep}
          onMouseDown={keep}
          onClick={done}
          className="flex h-9 items-center gap-1 rounded-lg px-3 font-semibold text-brand-ink active:bg-brand-soft"
        >
          {labels.done} <Check className="size-5" />
        </button>
      </div>
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
            {key(labels.space, () => insert(" "), "flex-[6] text-sm")}
          </div>
        </div>
      )}
    </div>
  );
}
