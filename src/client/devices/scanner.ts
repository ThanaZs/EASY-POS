"use client";

// ===== เครื่องสแกนบาร์โค้ด =====
// รองรับ 2 แบบ:
// 1) แบบ "คีย์บอร์ด" (USB / Bluetooth HID ที่จับคู่ในตั้งค่าเครื่อง) — พิมพ์รหัสเร็วๆ แล้ว (มัก) กด Enter
//    อ่าน event.code (ตำแหน่งปุ่มจริง) แทน event.key → คีย์บอร์ดภาษาไทยก็ได้ตัวเลข/อักษรถูก
// 2) แบบ Bluetooth (BLE) เชื่อมตรงจากหน้าเว็บ — กดปุ่ม "เชื่อมผ่าน Bluetooth" → เบราว์เซอร์เด้งหน้าต่างเลือกอุปกรณ์

import { useEffect, useRef, useSyncExternalStore } from "react";

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

// สำรอง: บางเครื่อง (Android บางรุ่น) ไม่ส่ง event.code มา → แปลงอักษรไทย (เกษมณี) กลับเป็นปุ่มอังกฤษ
const TH = "ๅ/-ภถุึคตจขชๆไำพะัีรนยบลฟหกดเ้่าสวงผปแอิืทมใฝ+๑๒๓๔ู฿๕๖๗๘๙๐\"ฎฑธํ๊ณฯญฐ,ฤฆฏโฌ็๋ษศซ.()ฉฮฺ์?ฒฬฦ";
const EN = "1234567890-=qwertyuiop[]asdfghjkl;'zxcvbnm,./!@#$%^&*()_+QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?";
const TH_TO_EN = new Map(Array.from(TH).map((c, i) => [c, EN[i]]));

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
const isThai = (c: string) => /[฀-๿]/.test(c);

/** รวมตัวอักษรของการสแกน 1 ครั้ง — ถ้ามีอักษรไทยปน แปลว่าแป้นไทย → "/" "-" ก็มาจากแป้นไทยด้วย (คือ 2, 3) */
function joinKeys(keys: KeyChar[]): string {
  const thaiLayout = keys.some((k) => k.raw !== null && isThai(k.raw));
  return keys.map((k) => (thaiLayout && k.raw !== null ? (TH_TO_EN.get(k.raw) ?? k.ch) : k.ch)).join("");
}

// ---------- สถานะ ----------
export type ScannerState = {
  lastScanAt: number;
  lastCode: string;
  ble: "idle" | "connecting" | "connected" | "error";
  bleName: string;
  bleError?: "hid" | "failed";
};
const SEEN_KEY = "ep_scanner_seen";
let state: ScannerState = { lastScanAt: 0, lastCode: "", ble: "idle", bleName: "" };
const listeners = new Set<() => void>();
const setState = (patch: Partial<ScannerState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

/** แบบคีย์บอร์ด: ถือว่า "เชื่อมแล้ว" ถ้าเห็นการสแกนจริงภายใน 12 ชม. (ไม่มีสัญญาณเชื่อมต่อให้อ่าน) */
export const CONNECTED_WINDOW_MS = 12 * 60 * 60 * 1000;

// ---------- ส่งรหัสให้หน้าที่เปิดอยู่ ----------
type Handler = (code: string) => void;
const handlers: Handler[] = [];

function deliver(code: string): boolean {
  const handler = handlers[handlers.length - 1];
  const at = Date.now();
  setState({ lastScanAt: at, lastCode: code });
  try {
    localStorage.setItem(SEEN_KEY, String(at));
  } catch {
    // ignore
  }
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
const MIN_LEN = 4; // สั้นสุดที่ถือว่าเป็นบาร์โค้ด
const MAX_GAP_MS = 150; // ห่างกว่านี้ = เริ่มนับใหม่
const MAX_AVG_MS = 70; // เฉลี่ยเร็วกว่านี้ = เครื่องสแกน (เครื่อง Bluetooth บางรุ่นช้ากว่าแบบสาย)
const NO_SUFFIX_IDLE_MS = 180; // เครื่องที่ไม่ส่ง Enter ต่อท้าย: หยุดพิมพ์เท่านี้ = จบรหัส
const NO_SUFFIX_MIN_LEN = 6; // ...และต้องยาวพอ (กันคนพิมพ์เร็วๆ สั้นๆ)

let installed = false;
function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  try {
    const at = Number(localStorage.getItem(SEEN_KEY)) || 0;
    if (at > state.lastScanAt) state = { ...state, lastScanAt: at };
  } catch {
    // ignore
  }

  let chars: KeyChar[] = [];
  let times: number[] = [];
  let snapshot: { el: HTMLInputElement | HTMLTextAreaElement; value: string } | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const avgGap = () => {
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Infinity;
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
      if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
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
      if (!chars.length) {
        const a = document.activeElement;
        snapshot = a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement ? { el: a, value: a.value } : null;
      }
      chars.push(ch);
      times.push(now);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => finish(NO_SUFFIX_MIN_LEN), NO_SUFFIX_IDLE_MS);
    },
    { capture: true },
  );
}

// ---------- 2) แบบ Bluetooth (BLE) ----------
type BtChar = EventTarget & {
  properties: { notify: boolean; indicate: boolean };
  value?: DataView;
  startNotifications(): Promise<BtChar>;
};
type BtService = { getCharacteristics(): Promise<BtChar[]> };
type BtServer = { getPrimaryServices(): Promise<BtService[]>; disconnect(): void };
type BtDevice = EventTarget & { name?: string; gatt?: { connect(): Promise<BtServer> } };
const bluetooth = () =>
  typeof navigator === "undefined"
    ? undefined
    : (navigator as unknown as { bluetooth?: { requestDevice(o: unknown): Promise<BtDevice> } }).bluetooth;

export const bleSupported = () => !!bluetooth();

// service แบบ "ส่งข้อความ" ที่เครื่องสแกน BLE นิยมใช้
const SCANNER_SERVICES = [
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 / JDY
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip ISSC
  "0000feea-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
];

let bleServer: BtServer | null = null;

export async function connectScannerBluetooth() {
  const bt = bluetooth();
  if (!bt) return;
  setState({ ble: "connecting", bleError: undefined });
  try {
    const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: SCANNER_SERVICES });
    const server = await device.gatt!.connect();
    const notifiers: BtChar[] = [];
    for (const s of await server.getPrimaryServices()) {
      for (const c of await s.getCharacteristics()) if (c.properties.notify || c.properties.indicate) notifiers.push(c);
    }
    if (!notifiers.length) {
      // เครื่องที่ทำงานแบบคีย์บอร์ด (HID) — เบราว์เซอร์ไม่ให้เว็บอ่านตรง ต้องจับคู่ในตั้งค่าเครื่อง
      server.disconnect();
      setState({ ble: "error", bleName: device.name ?? "", bleError: "hid" });
      return;
    }
    const decoder = new TextDecoder();
    let buf = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      const code = buf.replace(/[\r\n\t\0]/g, "").trim();
      buf = "";
      if (code) deliver(code);
    };
    for (const c of notifiers) {
      await c.startNotifications();
      c.addEventListener("characteristicvaluechanged", () => {
        if (!c.value) return;
        buf += decoder.decode(c.value);
        clearTimeout(timer);
        if (/[\r\n]/.test(buf)) flush();
        else timer = setTimeout(flush, 120); // ไม่มีตัวจบบรรทัด → เงียบ 120ms = จบรหัส
      });
    }
    device.addEventListener("gattserverdisconnected", () => {
      bleServer = null;
      setState({ ble: "idle", bleName: "" });
    });
    bleServer = server;
    setState({ ble: "connected", bleName: device.name || "Bluetooth scanner" });
  } catch (e) {
    const cancelled = e instanceof Error && e.name === "NotFoundError";
    setState(cancelled ? { ble: "idle" } : { ble: "error", bleError: "failed" });
  }
}

export function disconnectScannerBluetooth() {
  bleServer?.disconnect();
  bleServer = null;
  setState({ ble: "idle", bleName: "" });
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
