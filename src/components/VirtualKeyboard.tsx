"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowBigUp, Delete } from "lucide-react";
import {
  isScannerConnected,
  setInputValue,
  useScannerState,
} from "@/client/devices/scanner";

// ===== คีย์บอร์ดของ EASY-POS เอง =====
// ปัญหา: iPhone/iPad ต่อเครื่องสแกน Bluetooth (เป็น "คีย์บอร์ดจริง") → iOS ซ่อนคีย์บอร์ดบนจอ แตะช่องแล้วพิมพ์ไม่ได้
// เว็บสั่งให้คีย์บอร์ด iOS เด้งไม่ได้ → แตะช่องพิมพ์แล้วรอดูว่าจอหดไหม (คีย์บอร์ดระบบขึ้น)
// ถ้าไม่หด = ไม่มีคีย์บอร์ดระบบ → เปิดคีย์บอร์ดนี้แทน (ตัวเลข / ไทย / อังกฤษ)
// ใช้เฉพาะ iPhone/iPad และเฉพาะตอนสถานะเครื่องสแกน = เชื่อมแล้ว (Android/คอม ไม่มีปัญหานี้ → ไม่ใช้เลย)

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
const isNumeric = (el: Target) =>
  el instanceof HTMLInputElement &&
  (el.type === "number" ||
    ["numeric", "decimal", "tel"].includes(el.inputMode));

const LANG_KEY = "ep_vkb_lang";

export function VirtualKeyboard({
  labels,
}: {
  labels: { done: string; space: string };
}) {
  const [rawTarget, setTarget] = useState<Target | null>(null);
  const [mode, setMode] = useState<Mode>("th");
  const [shift, setShift] = useState(false);
  const noSystemKeyboard = useRef(false); // เคยตรวจแล้วว่าไม่มีคีย์บอร์ดระบบ → ครั้งต่อไปเปิดทันที
  const panel = useRef<HTMLDivElement>(null);
  const scannerOn = isScannerConnected(useScannerState());
  const scannerRef = useRef(scannerOn);
  useEffect(() => {
    scannerRef.current = scannerOn;
  }, [scannerOn]);
  // เครื่องสแกนหลุด/รีเซ็ตสถานะ → ซ่อนคีย์บอร์ดของเรา
  const target = scannerOn ? rawTarget : null;

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
    const vv = window.visualViewport;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (!isTypable(el)) return;
      if (!scannerRef.current) return; // ยังไม่เห็นเครื่องสแกน → ใช้คีย์บอร์ดระบบตามปกติ
      if (panel.current?.contains(el)) return;
      clearTimeout(timer);
      if (noSystemKeyboard.current) return open(el);
      const before = vv?.height ?? window.innerHeight;
      timer = setTimeout(() => {
        if (document.activeElement !== el) return;
        const now = vv?.height ?? window.innerHeight;
        if (before - now < 150) {
          // จอไม่หด = คีย์บอร์ดระบบไม่ขึ้น (มีเครื่องสแกน/คีย์บอร์ดจริงต่ออยู่)
          noSystemKeyboard.current = true;
          open(el);
        }
      }, 650);
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget;
      if (next && (isTypable(next) || panel.current?.contains(next as Node)))
        return;
      setTimeout(() => {
        if (!isTypable(document.activeElement)) setTarget(null);
      }, 120);
    };
    // คีย์บอร์ดระบบกลับมาแล้ว (ถอดเครื่องสแกน) → ปิดของเรา
    let base = vv?.height ?? window.innerHeight;
    const onResize = () => {
      const h = vv?.height ?? window.innerHeight;
      if (base - h > 150) {
        noSystemKeyboard.current = false;
        setTarget(null);
      }
      if (h > base) base = h;
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    vv?.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", onResize);
    };
  }, []);

  // iPhone/iPad ที่ต่อคีย์บอร์ดจริง: iOS แสดงแถบ ˄ ˅ ✓ ลอยอยู่ล่างจอ (เว็บย้าย/ซ่อนไม่ได้)
  // → ยกคีย์บอร์ดของเราขึ้นเหนือแถบนั้น: ใช้ส่วนที่ visualViewport ถูกบังจริง ถ้าวัดไม่ได้ (แถบลอยทับ) เผื่อไว้ 64px บน iOS
  const [lift, setLift] = useState(0);
  useEffect(() => {
    if (!target) return;
    const vv = window.visualViewport;
    const ios = isIOS();
    const update = () => {
      const covered = vv
        ? Math.max(0, window.innerHeight - (vv.offsetTop + vv.height))
        : 0;
      setLift(covered >= 40 ? covered : ios ? 64 : 0);
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [target]);

  // ดันเนื้อหาขึ้นไม่ให้คีย์บอร์ดบังช่อง
  useEffect(() => {
    if (!target) return;
    const h = (panel.current?.offsetHeight ?? 0) + lift;
    document.body.style.paddingBottom = `${h}px`;
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [target, mode, lift]);

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
      style={{ bottom: lift }}
      className="fixed inset-x-0 bottom-0 z-[80] space-y-1.5 border-t border-line bg-surface p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
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
