"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowBigUp, Delete, Globe } from "lucide-react";
import { setInputValue } from "@/client/devices/scanner";

// ===== คีย์บอร์ดของ EASY-POS (iPhone/iPad ใช้ตัวนี้ทุกครั้ง) =====
// เหตุผล: ต่อเครื่องสแกน Bluetooth (= คีย์บอร์ดจริง) แล้ว iOS ซ่อนคีย์บอร์ดบนจอ, และการสลับไปมาระหว่าง
// คีย์บอร์ด iPhone/คีย์บอร์ดเว็บทำให้ซ้อนกัน → ผู้ใช้เลือก "ใช้คีย์บอร์ดเว็บหมดเลย" บน iPhone
// - ปิดคีย์บอร์ดระบบด้วย inputmode=none (ตั้งตั้งแต่ตอนแตะ ก่อนโฟกัส) → แถบ ˄ ˅ ✓ ของ iOS หายไปด้วย
// - หน้าตา/ตำแหน่งปุ่มเหมือนคีย์บอร์ด iPhone (ไทย เกษมณี / ABC / 123 / #+= / แป้นตัวเลข)
// - กดปุ่มมีป้ายตัวอักษรเด้งเหนือนิ้ว, กดค้างลบ = ลบรัว, 🌐 สลับไทย/อังกฤษ
// - ปิด: ปุ่ม "เสร็จ" หรือแตะนอกคีย์บอร์ด (ปัดจอไม่ปิด); Android/คอม ไม่ใช้เลย

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

type Mode = "num" | "th" | "en" | "sym" | "sym2";
type Target = HTMLInputElement | HTMLTextAreaElement;

// ไทย (เกษมณี) ตามคีย์บอร์ด iPhone
const TH = [
  ["ๅ", "/", "_", "ภ", "ถ", "ุ", "ึ", "ค", "ต", "จ", "ข", "ช"],
  ["ๆ", "ไ", "ำ", "พ", "ะ", "ั", "ี", "ร", "น", "ย", "บ", "ล"],
  ["ฟ", "ห", "ก", "ด", "เ", "้", "่", "า", "ส", "ว", "ง", "ฃ"],
  ["ผ", "ป", "แ", "อ", "ิ", "ื", "ท", "ม", "ใ", "ฝ"],
];
const TH_SHIFT = [
  ["+", "๑", "๒", "๓", "๔", "ู", "฿", "๕", "๖", "๗", "๘", "๙"],
  ["๐", '"', "ฎ", "ฑ", "ธ", "ํ", "๊", "ณ", "ฯ", "ญ", "ฐ", ","],
  ["ฤ", "ฆ", "ฏ", "โ", "ฌ", "็", "๋", "ษ", "ศ", "ซ", ".", "ฅ"],
  ["(", ")", "ฉ", "ฮ", "ฺ", "์", "?", "ฒ", "ฬ", "ฦ"],
];
const EN = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];
const SYM = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "฿", "&", "@", '"'],
  [".", ",", "?", "!", "'"],
];
const SYM2 = [
  ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="],
  ["_", "\\", "|", "~", "<", ">", "$", "€", "£", "•"],
  [".", ",", "?", "!", "'"],
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

// สีแบบคีย์บอร์ด iPhone (สว่าง/มืด)
const BG = "bg-[#d1d4da] dark:bg-[#2b2b2e]";
const KEY =
  "bg-white text-black dark:bg-[#6b6b70] dark:text-white active:bg-[#c3c7cf] dark:active:bg-[#4a4a4e]";
const FN =
  "bg-[#acb1bb] text-black dark:bg-[#474749] dark:text-white active:bg-white dark:active:bg-[#6b6b70]";

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
  const [pressed, setPressed] = useState<string | null>(null); // ป้ายตัวอักษรเด้งเหนือนิ้ว
  const [lift, setLift] = useState(0); // เว้นที่ให้แถบเล็กของ iOS ตอนต่อเครื่องสแกน
  const panel = useRef<HTMLDivElement>(null);
  const repeat = useRef<ReturnType<typeof setTimeout>>(undefined);
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
    const vv = window.visualViewport;
    // แถบเล็กของ iOS ตอนต่อคีย์บอร์ดจริง (เครื่องสแกน) — วัดส่วนที่ถูกบังล่างจอ แล้วยกคีย์บอร์ดขึ้นเท่านั้น
    const measure = () =>
      setLift(
        vv
          ? Math.min(
              120,
              Math.max(
                0,
                window.innerHeight - vv.height * vv.scale - vv.offsetTop,
              ),
            )
          : 0,
      );
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
      setTimeout(measure, 400);
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
    vv?.addEventListener("resize", measure);
    return () => {
      document.removeEventListener("touchstart", onTouch, { capture: true });
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", measure);
    };
  }, []);

  // ===== ล็อกหน้าไม่ให้เลื่อนระหว่างที่คีย์บอร์ดเปิด → คีย์บอร์ดนิ่ง 100% =====
  // iOS: ตอนมีช่องพิมพ์โฟกัสอยู่ position:fixed จะเลื่อนตามหน้า → ตรึง body ไว้ (position:fixed; top:-y)
  // ปิดคีย์บอร์ด → ปลดล็อก แล้วกลับไปตำแหน่งเดิมของหน้า
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
    // ผู้ใช้ไม่เอา "ปัดจอแล้วปิดคีย์บอร์ด" → ปัดจอไม่ทำอะไร
    // ปิดได้ด้วยปุ่ม "เสร็จ" หรือแตะ (ไม่ลาก) ตรงที่ไม่ใช่คีย์บอร์ด/ช่องพิมพ์
    let start: { x: number; y: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const el = e.target as Element | null;
      start =
        e.touches.length === 1 &&
        !el?.closest?.("[data-vkb]") &&
        !isTypable(el)
          ? { x: t.clientX, y: t.clientY }
          : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const moved = Math.hypot(t.clientX - start.x, t.clientY - start.y);
      start = null;
      if (moved > 10) return; // ลาก/ปัด = ไม่ปิด
      (document.activeElement as HTMLElement | null)?.blur?.();
      setOpened(null);
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
      // ปลดล็อกแล้วกลับตำแหน่งเดิม — iOS ต้องสั่งซ้ำหลังวาดใหม่ (สั่งครั้งเดียวมักโดนรีเซ็ตเป็นบนสุด)
      const y = lockY.current;
      Object.assign(b, prev);
      const back = () => window.scrollTo({ top: y, left: 0, behavior: "instant" });
      back();
      requestAnimationFrame(back);
      setTimeout(back, 60);
      setTimeout(back, 250);
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
  useEffect(() => () => clearTimeout(repeat.current), []);

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

  /** ปุ่มตัวอักษร: กดแล้วมีป้ายตัวอักษรใหญ่เด้งเหนือนิ้ว (แบบ iPhone) */
  const charKey = (ch: string, id: string) => (
    <button
      key={id}
      type="button"
      onPointerDown={(e) => {
        keep(e);
        setPressed(id);
      }}
      onPointerUp={() => setPressed(null)}
      onPointerLeave={() => setPressed((p) => (p === id ? null : p))}
      onPointerCancel={() => setPressed(null)}
      onMouseDown={keep}
      onClick={() => insert(ch)}
      className={`relative h-[42px] min-w-0 flex-1 select-none rounded-[5px] text-[21px] shadow-[0_1px_0_rgba(0,0,0,0.35)] ${KEY}`}
    >
      {ch}
      {pressed === id && (
        <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 grid h-[52px] min-w-[46px] -translate-x-1/2 place-items-center rounded-lg bg-white px-2 text-[30px] text-black shadow-[0_2px_8px_rgba(0,0,0,0.35)] dark:bg-[#6b6b70] dark:text-white">
          {ch}
        </span>
      )}
    </button>
  );
  /** ปุ่มคำสั่ง (shift, ลบ, 123, 🌐, เสร็จ) */
  const fnKey = (
    label: React.ReactNode,
    onPress: () => void,
    cls = "",
    aria?: string,
  ) => (
    <button
      type="button"
      onPointerDown={keep}
      onMouseDown={keep}
      onClick={onPress}
      aria-label={aria}
      className={`grid h-[42px] min-w-0 select-none place-items-center rounded-[5px] text-[15px] shadow-[0_1px_0_rgba(0,0,0,0.35)] ${cls.includes("bg-") ? "" : FN} ${cls}`}
    >
      {label}
    </button>
  );
  /** ปุ่มลบ: กดค้าง = ลบรัว */
  const delKey = (cls: string) => (
    <button
      type="button"
      aria-label="delete"
      onPointerDown={(e) => {
        keep(e);
        backspace();
        const loop = (ms: number) => {
          repeat.current = setTimeout(() => {
            backspace();
            loop(70);
          }, ms);
        };
        loop(450);
      }}
      onPointerUp={() => clearTimeout(repeat.current)}
      onPointerLeave={() => clearTimeout(repeat.current)}
      onPointerCancel={() => clearTimeout(repeat.current)}
      onMouseDown={keep}
      className={`grid h-[42px] min-w-0 select-none place-items-center rounded-[5px] shadow-[0_1px_0_rgba(0,0,0,0.35)] ${FN} ${cls}`}
    >
      <Delete className="size-6" strokeWidth={1.75} />
    </button>
  );

  if (!target) return null;

  const isLetters = mode === "th" || mode === "en";
  const rows =
    mode === "th"
      ? shift
        ? TH_SHIFT
        : TH
      : mode === "en"
        ? EN
        : mode === "sym"
          ? SYM
          : SYM2;
  const doneKey = fnKey(
    labels.done,
    done,
    "flex-[2.4] bg-[#007aff] font-semibold text-white active:bg-[#0062cc]",
  );

  return (
    <div
      ref={panel}
      data-vkb
      style={{
        paddingBottom: `calc(${lift}px + max(env(safe-area-inset-bottom), 6px))`,
      }}
      className={`fixed inset-x-0 bottom-0 z-[80] select-none px-[3px] pt-2 ${BG}`}
      onPointerDown={keep}
    >
      {mode === "num" ? (
        // แป้นตัวเลข (ราคา/จำนวน) แบบ iPhone
        <div className="mx-auto grid max-w-md grid-cols-3 gap-[6px] px-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) =>
            charKey(d, `n${d}`),
          )}
          {charKey(".", "n.")}
          {charKey("0", "n0")}
          {delKey("bg-transparent shadow-none dark:bg-transparent")}
          <div className="col-span-3 flex">{doneKey}</div>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-[11px]">
          {rows.map((row, i) => {
            const last = i === rows.length - 1;
            return (
              <div
                key={i}
                className={`flex gap-[5px] ${
                  // แถวที่ปุ่มน้อยกว่าแถวบน → เว้นข้างให้อยู่กลาง (แบบ iPhone)
                  mode === "en" && i === 1 ? "px-[5%]" : ""
                }`}
              >
                {last &&
                  (isLetters
                    ? fnKey(
                        <ArrowBigUp
                          className={`size-6 ${shift ? "fill-current" : ""}`}
                          strokeWidth={1.5}
                        />,
                        () => setShift((s) => !s),
                        `flex-[1.4] ${shift ? "bg-white text-black dark:bg-white dark:text-black" : ""}`,
                        "shift",
                      )
                    : fnKey(
                        mode === "sym" ? "#+=" : "123",
                        () => setMode(mode === "sym" ? "sym2" : "sym"),
                        "flex-[1.4]",
                      ))}
                {last && !isLetters && <span className="w-1" />}
                {row.map((c, j) => {
                  const ch = mode === "en" && shift ? c.toUpperCase() : c;
                  return charKey(ch, `${mode}${i}-${j}`);
                })}
                {last && !isLetters && <span className="w-1" />}
                {last && delKey("flex-[1.4]")}
              </div>
            );
          })}
          {/* แถวล่าง: 123 | 🌐 | เว้นวรรค | เสร็จ */}
          <div className="flex gap-[5px]">
            {fnKey(
              isLetters ? "123" : localLangLabel(),
              () => (isLetters ? setMode("sym") : setMode(lastLang())),
              "flex-[1.3]",
            )}
            {fnKey(
              <Globe className="size-5" strokeWidth={1.75} />,
              () => setLang(mode === "en" ? "th" : "en"),
              "flex-[1.1]",
              "language",
            )}
            <button
              type="button"
              onPointerDown={keep}
              onMouseDown={keep}
              onClick={() => insert(" ")}
              className={`h-[42px] min-w-0 flex-[5] select-none rounded-[5px] text-[15px] shadow-[0_1px_0_rgba(0,0,0,0.35)] ${KEY}`}
            >
              {mode === "en" ? "space" : labels.space}
            </button>
            {doneKey}
          </div>
        </div>
      )}
    </div>
  );

  /** ภาษาล่าสุดที่ใช้ (กลับจากหน้าสัญลักษณ์) */
  function lastLang(): "th" | "en" {
    try {
      return localStorage.getItem(LANG_KEY) === "en" ? "en" : "th";
    } catch {
      return "th";
    }
  }
  function localLangLabel() {
    return lastLang() === "en" ? "ABC" : "กขค";
  }
}
