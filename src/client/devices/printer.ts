"use client";

// ===== เชื่อมเครื่องพิมพ์สลิป (ESC/POS) ผ่าน Web Bluetooth / WebUSB =====
// - Bluetooth: Chrome บน Android / คอม (iPhone ไม่รองรับ → ใช้ "พิมพ์ผ่านเบราว์เซอร์")
// - USB: Chrome บนคอม / Android ที่ต่อ OTG
// การเชื่อมต่อเก็บไว้ระดับแอป → เปลี่ยนหน้าในเว็บแล้วยังเชื่อมอยู่

import { useSyncExternalStore } from "react";
import { canvasToEscPos, drawSlip, type PaperWidth, type SlipLine } from "./escpos";

// ---- ชนิดข้อมูลขั้นต่ำของ Web Bluetooth / WebUSB (ยังไม่มีใน lib.dom ของ TypeScript) ----
type BtCharacteristic = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithoutResponse(v: BufferSource): Promise<void>;
  writeValueWithResponse(v: BufferSource): Promise<void>;
};
type BtService = { getCharacteristics(): Promise<BtCharacteristic[]> };
type BtServer = { connected: boolean; getPrimaryServices(): Promise<BtService[]>; disconnect(): void };
type BtDevice = EventTarget & { name?: string; gatt?: { connect(): Promise<BtServer> } };
type Bluetooth = { requestDevice(o: unknown): Promise<BtDevice> };
type UsbEndpoint = { direction: "in" | "out"; type: string; endpointNumber: number };
type UsbInterface = { interfaceNumber: number; alternate: { endpoints: UsbEndpoint[] } };
type UsbDevice = {
  productName?: string;
  opened: boolean;
  configuration: { interfaces: UsbInterface[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  transferOut(ep: number, data: BufferSource): Promise<unknown>;
};
type Usb = EventTarget & { requestDevice(o: unknown): Promise<UsbDevice>; getDevices(): Promise<UsbDevice[]> };

const nav = () => (typeof navigator === "undefined" ? undefined : (navigator as unknown as { bluetooth?: Bluetooth; usb?: Usb }));
export const supports = () => ({ bluetooth: !!nav()?.bluetooth, usb: !!nav()?.usb });

// service UUID ที่เครื่องพิมพ์สลิปราคาประหยัดใช้กันบ่อย
const BT_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
];

type Conn =
  | { kind: "bluetooth"; name: string; write: (d: Uint8Array<ArrayBuffer>) => Promise<void>; close: () => void }
  | { kind: "usb"; name: string; write: (d: Uint8Array<ArrayBuffer>) => Promise<void>; close: () => void };

export type PrinterState = { status: "idle" | "connecting" | "connected" | "printing" | "error"; name: string; kind?: Conn["kind"]; error?: string };

let conn: Conn | null = null;
let state: PrinterState = { status: "idle", name: "" };
const listeners = new Set<() => void>();
const set = (s: PrinterState) => {
  state = s;
  listeners.forEach((l) => l());
};

export const usePrinter = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function connectBluetooth() {
  const bt = nav()?.bluetooth;
  if (!bt) throw new Error("unsupported");
  set({ status: "connecting", name: "" });
  try {
    const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: BT_SERVICES });
    const server = await device.gatt!.connect();
    let ch: BtCharacteristic | undefined;
    for (const s of await server.getPrimaryServices()) {
      for (const c of await s.getCharacteristics()) {
        if (c.properties.writeWithoutResponse || c.properties.write) {
          ch = c;
          break;
        }
      }
      if (ch) break;
    }
    if (!ch) throw new Error("no-writable-characteristic");
    const c = ch;
    const name = device.name || "Bluetooth printer";
    conn = {
      kind: "bluetooth",
      name,
      // BLE ส่งได้ทีละน้อย → แบ่งก้อนละ 180 byte
      write: async (data) => {
        for (let i = 0; i < data.length; i += 180) {
          const part = data.slice(i, i + 180);
          if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(part);
          else await c.writeValueWithResponse(part);
          await sleep(15);
        }
      },
      close: () => server.disconnect(),
    };
    device.addEventListener("gattserverdisconnected", () => {
      conn = null;
      set({ status: "idle", name: "" });
    });
    set({ status: "connected", name, kind: "bluetooth" });
  } catch (e) {
    conn = null;
    const cancelled = e instanceof Error && e.name === "NotFoundError";
    set(cancelled ? { status: "idle", name: "" } : { status: "error", name: "", error: String(e) });
  }
}

async function openUsb(device: UsbDevice) {
  if (!device.opened) await device.open();
  if (!device.configuration) await device.selectConfiguration(1);
  for (const itf of device.configuration!.interfaces) {
    const ep = itf.alternate.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
    if (!ep) continue;
    await device.claimInterface(itf.interfaceNumber);
    const name = device.productName || "USB printer";
    conn = {
      kind: "usb",
      name,
      write: async (data) => {
        for (let i = 0; i < data.length; i += 4096) await device.transferOut(ep.endpointNumber, data.slice(i, i + 4096));
      },
      close: () => void device.close(),
    };
    set({ status: "connected", name, kind: "usb" });
    return;
  }
  throw new Error("no-bulk-out-endpoint");
}

export async function connectUsb() {
  const usb = nav()?.usb;
  if (!usb) throw new Error("unsupported");
  set({ status: "connecting", name: "" });
  try {
    await openUsb(await usb.requestDevice({ filters: [] }));
  } catch (e) {
    conn = null;
    const cancelled = e instanceof Error && e.name === "NotFoundError";
    set(cancelled ? { status: "idle", name: "" } : { status: "error", name: "", error: String(e) });
  }
}

/** เปิดหน้าใหม่ → ต่อเครื่อง USB ที่เคยอนุญาตแล้วให้อัตโนมัติ (Bluetooth ต้องกดเชื่อมใหม่ตามข้อจำกัดเบราว์เซอร์) */
export async function autoReconnect() {
  if (conn) return;
  const usb = nav()?.usb;
  if (!usb) return;
  try {
    const [d] = await usb.getDevices();
    if (d) await openUsb(d);
  } catch {
    conn = null;
    set({ status: "idle", name: "" });
  }
}

export function disconnect() {
  conn?.close();
  conn = null;
  set({ status: "idle", name: "" });
}

// ---- ตั้งค่า (เก็บในเครื่อง) ----
const PAPER_KEY = "ep_printer_paper";
const AUTO_KEY = "ep_printer_auto";
export function getPaper(): PaperWidth {
  try {
    return localStorage.getItem(PAPER_KEY) === "576" ? 576 : 384;
  } catch {
    return 384;
  }
}
export function setPaper(w: PaperWidth) {
  try {
    localStorage.setItem(PAPER_KEY, String(w));
  } catch {
    // ignore
  }
}
export function getAutoPrint(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}
export function setAutoPrint(v: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, v ? "1" : "0");
  } catch {
    // ignore
  }
}

/** พิมพ์สลิป — คืน false ถ้ายังไม่ได้เชื่อมเครื่อง (ให้ผู้เรียกใช้ window.print แทน) */
export async function printSlip(lines: SlipLine[]): Promise<boolean> {
  if (!conn) return false;
  const c = conn;
  set({ ...state, status: "printing" });
  try {
    await c.write(canvasToEscPos(drawSlip(lines, getPaper())));
    set({ status: "connected", name: c.name, kind: c.kind });
    return true;
  } catch (e) {
    set({ status: "error", name: c.name, kind: c.kind, error: String(e) });
    throw e;
  }
}
