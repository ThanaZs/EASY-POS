"use client";

// ===== เครื่องสแกนบาร์โค้ดแบบ "คีย์บอร์ด" (USB / Bluetooth HID) =====
// เครื่องสแกนส่วนใหญ่ทำตัวเป็นคีย์บอร์ด: พิมพ์รหัสเร็วมากแล้วกด Enter
// ปัญหา: ถ้าเครื่องตั้งภาษาไทยอยู่ จะได้ "ๅ/-ภถุ" แทน "1234" → เราอ่าน event.code (ตำแหน่งปุ่มจริง) แทน event.key
// เลยได้ตัวเลข/อักษรอังกฤษถูกต้องเสมอ ไม่ว่าจะตั้งภาษาอะไร

import { useEffect, useRef, useSyncExternalStore } from "react";

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

/** แปลงปุ่มที่กด → ตัวอักษรแบบคีย์บอร์ดอังกฤษ (null = ไม่ใช่ตัวอักษร) */
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

// ----- สถานะ (ใช้กับ useSyncExternalStore) -----
type ScannerState = { lastScanAt: number; lastCode: string };
const SEEN_KEY = "ep_scanner_seen";
let state: ScannerState = { lastScanAt: 0, lastCode: "" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function loadSeen() {
  try {
    const at = Number(localStorage.getItem(SEEN_KEY)) || 0;
    if (at > state.lastScanAt) state = { ...state, lastScanAt: at };
  } catch {
    // ignore
  }
}

/** ถือว่า "เชื่อมแล้ว" ถ้าเห็นการสแกนจริงภายใน 12 ชั่วโมง (เครื่องแบบคีย์บอร์ดไม่มีสัญญาณเชื่อมต่อให้อ่าน) */
export const CONNECTED_WINDOW_MS = 12 * 60 * 60 * 1000;

// ----- ตัวรับการสแกน (หน้าไหนเปิดอยู่ก็ลงทะเบียน handler ล่าสุด) -----
type Handler = (code: string) => void;
const handlers: Handler[] = [];
let installed = false;

const MIN_LEN = 4; // บาร์โค้ดสั้นสุดที่ถือว่าเป็นการสแกน
const MAX_GAP_MS = 80; // ห่างกว่านี้ = เริ่มนับใหม่
const MAX_AVG_MS = 45; // เฉลี่ยเร็วกว่านี้ = เครื่องสแกน (คนพิมพ์ไม่เร็วขนาดนี้)

type Snapshot = { el: HTMLInputElement | HTMLTextAreaElement; value: string } | null;

/** ตั้งค่า input แบบที่ React รับรู้ (สำหรับ input ที่ React ควบคุม) */
export function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  loadSeen();
  let chars: string[] = [];
  let times: number[] = [];
  let snapshot: Snapshot = null;

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const now = performance.now();
      if (times.length && now - times[times.length - 1] > MAX_GAP_MS) {
        chars = [];
        times = [];
      }

      if (e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter" || e.key === "Tab") {
        const gaps = times.slice(1).map((t, i) => t - times[i]);
        const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Infinity;
        const code = chars.join("").trim();
        const snap = snapshot;
        chars = [];
        times = [];
        snapshot = null;
        const handler = handlers[handlers.length - 1];
        if (code.length >= MIN_LEN && avg <= MAX_AVG_MS && handler) {
          // เป็นการสแกน: ไม่ให้ Enter ไป submit ฟอร์ม, คืนค่าช่องที่โดนพิมพ์ทับ (อาจเป็นภาษาไทยเพี้ยน)
          e.preventDefault();
          e.stopImmediatePropagation();
          if (snap && snap.el.value !== snap.value) setInputValue(snap.el, snap.value);
          state = { lastScanAt: Date.now(), lastCode: code };
          try {
            localStorage.setItem(SEEN_KEY, String(state.lastScanAt));
          } catch {
            // ignore
          }
          emit();
          handler(code);
        }
        return;
      }

      const ch = charFromCode(e.code, e.shiftKey);
      if (ch === null) return;
      if (!chars.length) {
        const a = document.activeElement;
        snapshot =
          a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement ? { el: a, value: a.value } : null;
      }
      chars.push(ch);
      times.push(now);
    },
    { capture: true },
  );
}

/** หน้าไหนต้องรับการสแกน → เรียก hook นี้ (handler ล่าสุดที่ลงทะเบียนได้รหัส) */
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

export function useScannerState(): ScannerState {
  return useSyncExternalStore(
    (cb) => {
      install();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
