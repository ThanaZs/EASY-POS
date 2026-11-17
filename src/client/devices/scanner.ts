"use client";

// ===== เครื่องสแกนบาร์โค้ดแบบ "คีย์บอร์ด" (USB / Bluetooth ที่จับคู่ในตั้งค่าเครื่อง) =====
// พิมพ์รหัสเร็วๆ แล้ว (มัก) กด Enter — อ่าน event.code (ตำแหน่งปุ่มจริง) แทน event.key
// → คีย์บอร์ดภาษาไทยก็ได้ตัวเลข/อักษรถูก
// (เคยมีปุ่มเชื่อม Bluetooth ตรงจากเว็บ แต่หลุดบ่อย → เอาออกแล้ว ใช้จับคู่ในตั้งค่าเครื่องแทน)

import { useEffect, useRef, useSyncExternalStore } from "react";
import { isThai, TH_TO_EN, toEnglishLayout } from "@/core/lib/keyboard";

export { toEnglishLayout };

// ---------- แปลงปุ่ม → ตัวอักษร (แบบคีย์บอร์ดอังกฤษ) ----------
const CODE_MAP: Record<string, [string, string]> = {
  Minus: ["-", "_"],
  Equal: ["=", "+"],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Backslash: ["\\", "|"],
  Semicolon: [";", ":"],
  Quote: ["'", '"'],
  Comma: [",", "<"],
  Period: [".", ">"],
  Slash: ["/", "?"],
  Backquote: ["`", "~"],
  Space: [" ", " "],
  NumpadDecimal: [".", "."],
  NumpadSubtract: ["-", "-"],
  NumpadAdd: ["+", "+"],
  NumpadMultiply: ["*", "*"],
  NumpadDivide: ["/", "/"],
};
const SHIFT_DIGITS = ")!@#$%^&*(";

export function charFromCode(code: string, shift: boolean): string | null {
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return shift ? m[1] : m[1].toLowerCase();
  m = /^Digit(\d)$/.exec(code);
  if (m) return shift ? SHIFT_DIGITS[Number(m[1])] : m[1];
  m = /^Numpad(\d)$/.exec(code);
  if (m) return m[1];
  const pair = CODE_MAP[code];
  return pair ? pair[shift ? 1 : 0] : null;
}


/** ตัวอักษรจากปุ่มที่กด; raw = อักษรที่เบราว์เซอร์ส่งมา (เก็บไว้ตีความใหม่ถ้าทั้งชุดเป็นแป้นไทย) */
type KeyChar = { ch: string; raw: string | null };
function charFromEvent(e: KeyboardEvent): KeyChar | null {
  const byCode = e.code ? charFromCode(e.code, e.shiftKey) : null;
  if (byCode !== null) return { ch: byCode, raw: null };
  if (e.key.length !== 1) return null;
  if (/^[\x20-\x7e]$/.test(e.key)) return { ch: e.key, raw: e.key };
  const en = TH_TO_EN.get(e.key);
  return en ? { ch: en, raw: e.key } : null;
}

/** รวมตัวอักษรของการสแกน 1 ครั้ง — ถ้ามีอักษรไทยปน แปลว่าแป้นไทย → "/" "-" ก็มาจากแป้นไทยด้วย (คือ 2, 3) */
function joinKeys(keys: KeyChar[]): string {
  const thaiLayout = keys.some((k) => k.raw !== null && isThai(k.raw));
  return keys.map((k) => (thaiLayout && k.raw !== null ? (TH_TO_EN.get(k.raw) ?? k.ch) : k.ch)).join("");
}

// ---------- สถานะ ----------
export type ScannerState = { lastScanAt: number; lastCode: string };
let state: ScannerState = { lastScanAt: 0, lastCode: "" };
const listeners = new Set<() => void>();
const setState = (patch: Partial<ScannerState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

/**
 * "เชื่อมแล้ว" = เห็นการสแกนจริงตั้งแต่เปิดหน้านี้ (เครื่องแบบคีย์บอร์ดไม่มีสัญญาณเชื่อมต่อให้อ่าน)
 * ปิดเว็บ / สลับแอป / ออกจากหน้า → รีเซ็ตเป็น "ยังไม่พบ" (ผู้ใช้ต้องยิง 1 ครั้งเพื่อยืนยันว่ายังต่ออยู่)
 */
export const isScannerConnected = (s: ScannerState) => s.lastScanAt > 0;

// ---------- ส่งรหัสให้หน้าที่เปิดอยู่ ----------
type Handler = (code: string) => void;
const handlers: Handler[] = [];

function deliver(code: string): boolean {
  const handler = handlers[handlers.length - 1];
  setState({ lastScanAt: Date.now(), lastCode: code });
  if (!handler) return false;
  handler(code);
  return true;
}

/** ตั้งค่า input แบบที่ React รับรู้ */
export function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// ---------- 1) แบบคีย์บอร์ด ----------
// iPad/iPhone: Bluetooth ส่งปุ่มช้ากว่าและเป็นจังหวะไม่สม่ำเสมอ → ผ่อนเกณฑ์ให้
const IOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
const MIN_LEN = 4; // สั้นสุดที่ถือว่าเป็นบาร์โค้ด
const MAX_GAP_MS = IOS ? 350 : 200; // ห่างกว่านี้ = เริ่มนับใหม่
const MAX_AVG_MS = IOS ? 140 : 100; // เฉลี่ยเร็วกว่านี้ = เครื่องสแกน (คนพิมพ์ ~150ms+)
const NO_SUFFIX_IDLE_MS = IOS ? 400 : 180; // เครื่องที่ไม่ส่ง Enter ต่อท้าย: หยุดพิมพ์เท่านี้ = จบรหัส

// ---------- บันทึกปุ่มที่เข้ามา (ดูในหน้าต่างทดสอบ ใช้หาสาเหตุเมื่อเครื่องไหนอ่านไม่ได้) ----------
export type KeyLog = { key: string; code: string; dt: number; src: "key" | "input" };
let keyLog: KeyLog[] = [];
let logLast = 0;
const logListeners = new Set<() => void>();
function logKey(key: string, code: string, src: KeyLog["src"]) {
  if (!logListeners.size) return;
  const now = performance.now();
  keyLog = [...keyLog.slice(-11), { key, code, dt: logLast ? Math.round(now - logLast) : 0, src }];
  logLast = now;
  logListeners.forEach((l) => l());
}
// subscribe ต้องเป็นฟังก์ชันเดิมทุกครั้ง (ถ้าสร้างใหม่ทุก render React จะ subscribe ซ้ำ → เคยวนไม่จบ React error #185)
function subscribeLog(cb: () => void) {
  install();
  if (!logListeners.size) {
    keyLog = []; // เปิดหน้าต่างทดสอบใหม่ → เริ่มบันทึกใหม่
    logLast = 0;
  }
  logListeners.add(cb);
  return () => {
    logListeners.delete(cb);
  };
}
const getLog = () => keyLog;
export function useKeyLog(): KeyLog[] {
  return useSyncExternalStore(subscribeLog, getLog, getLog);
}
const NO_SUFFIX_MIN_LEN = 6; // ...และต้องยาวพอ (กันคนพิมพ์เร็วๆ สั้นๆ)

let installed = false;
function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  // ออกจากหน้า/ปิดแอป → สถานะกลับเป็น "ยังไม่พบ"
  const resetStatus = () => setState({ lastScanAt: 0, lastCode: "" });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") resetStatus();
  });
  window.addEventListener("pagehide", resetStatus);

  let chars: KeyChar[] = [];
  let times: number[] = [];
  let snapshot: { el: HTMLInputElement | HTMLTextAreaElement; value: string } | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const avgGap = () => {
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Infinity;
  };
  let lastKeyCharAt = -Infinity; // keydown ล่าสุดที่อ่านตัวอักษรได้ (กันนับซ้ำกับ input event)
  const push = (ch: KeyChar, now: number) => {
    if (times.length && now - times[times.length - 1] > MAX_GAP_MS) reset();
    if (!chars.length) {
      const a = document.activeElement;
      snapshot = a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement ? { el: a, value: a.value } : null;
    }
    chars.push(ch);
    times.push(now);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => finish(NO_SUFFIX_MIN_LEN), NO_SUFFIX_IDLE_MS);
  };
  const reset = () => {
    chars = [];
    times = [];
    snapshot = null;
    clearTimeout(idleTimer);
  };
  /** ถ้าเป็นการสแกน → คืนค่าช่องที่โดนพิมพ์ทับ + ส่งรหัส; คืน true ถ้าใช่ */
  const finish = (minLen: number): boolean => {
    const code = joinKeys(chars).trim();
    const snap = snapshot;
    const isScan = code.length >= minLen && avgGap() <= MAX_AVG_MS && handlers.length > 0;
    reset();
    if (!isScan) return false;
    if (snap && snap.el.value !== snap.value) setInputValue(snap.el, snap.value);
    deliver(code);
    return true;
  };

  window.addEventListener(
    "keydown",
    (e) => {
      logKey(e.key, e.code, "key");
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const now = performance.now();
      if (times.length && now - times[times.length - 1] > MAX_GAP_MS) reset();
      if (e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter" || e.key === "Tab") {
        if (finish(MIN_LEN)) {
          e.preventDefault(); // ไม่ให้ Enter ของเครื่องสแกนไป submit ฟอร์ม
          e.stopImmediatePropagation();
        }
        return;
      }

      const ch = charFromEvent(e);
      if (ch === null) return;
      lastKeyCharAt = now;
      push(ch, now);
    },
    { capture: true },
  );

  // สำรอง: บางเครื่อง (iPad/iOS, คีย์บอร์ดบางภาษา) keydown ไม่บอกตัวอักษร ("Unidentified")
  // แต่ช่องกรอกยังได้ข้อความ → อ่านจาก input event แทน
  window.addEventListener(
    "input",
    (e) => {
      const ie = e as InputEvent;
      const now = performance.now();
      if (ie.inputType === "insertLineBreak") {
        if (finish(MIN_LEN)) e.stopImmediatePropagation();
        return;
      }
      if (ie.inputType !== "insertText" || !ie.data) return;
      logKey(ie.data, "", "input");
      if (now - lastKeyCharAt < 60) return; // keydown อ่านไปแล้ว
      // เครื่องสแกนส่งทีละ 1 ตัว — ข้อความหลายตัวพร้อมกัน = คีย์บอร์ดเดาคำ/วาง ไม่ใช่การสแกน
      const raw = ie.data;
      if ([...raw].length !== 1) return reset();
      const en = TH_TO_EN.get(raw);
      push(/^[\x20-\x7e]$/.test(raw) ? { ch: raw, raw } : en ? { ch: en, raw } : { ch: raw, raw: null }, now);
    },
    { capture: true },
  );
}

// ---------- hooks ----------
/** หน้าไหนต้องรับการสแกน → เรียก hook นี้ (handler ล่าสุดได้รหัส) */
export function useBarcodeScanner(onScan: Handler) {
  const ref = useRef(onScan);
  useEffect(() => {
    ref.current = onScan;
  });
  useEffect(() => {
    install();
    const h: Handler = (code) => ref.current(code);
    handlers.push(h);
    return () => {
      const i = handlers.lastIndexOf(h);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, []);
}

function subscribeState(cb: () => void) {
  install();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const getState = () => state;
export function useScannerState(): ScannerState {
  return useSyncExternalStore(subscribeState, getState, getState);
}
