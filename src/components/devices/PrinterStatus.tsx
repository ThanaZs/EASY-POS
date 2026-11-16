"use client";

import { useEffect, useRef, useState } from "react";
import { Bluetooth, Printer, Usb, X } from "lucide-react";
import {
  autoReconnect,
  connectBluetooth,
  connectUsb,
  disconnect,
  getAutoPrint,
  getPaper,
  printSlip,
  setAutoPrint,
  setPaper,
  supports,
  usePrinter,
} from "@/client/devices/printer";
import type { PaperWidth } from "@/client/devices/escpos";
import type { Dictionary } from "@/i18n/dictionary";
import { DeviceChip } from "./DeviceChip";

/** ปุ่มสถานะเครื่องพิมพ์ + หน้าต่างเชื่อม/ตั้งค่า/พิมพ์ทดสอบ */
export function PrinterStatus({ t, storeName }: { t: Dictionary["devices"]; storeName: string }) {
  const p = usePrinter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [cap, setCap] = useState({ bluetooth: false, usb: false });
  const [paper, setPaperState] = useState<PaperWidth>(384);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    // ค่าที่อ่านได้เฉพาะใน browser
    /* eslint-disable react-hooks/set-state-in-effect */
    setCap(supports());
    setPaperState(getPaper());
    setAuto(getAutoPrint());
    /* eslint-enable react-hooks/set-state-in-effect */
    void autoReconnect();
  }, []);

  const tone = p.status === "connected" ? "on" : p.status === "error" ? "error" : p.status === "idle" ? "off" : "busy";
  const statusText =
    p.status === "connected"
      ? t.connected
      : p.status === "connecting"
        ? t.connecting
        : p.status === "printing"
          ? t.printing
          : p.status === "error"
            ? t.error
            : t.notConnected;
  const busy = p.status === "connecting" || p.status === "printing";

  return (
    <>
      <DeviceChip Icon={Printer} label={t.printer} status={statusText} tone={tone} onClick={() => dialog.current?.showModal()} />
      <dialog
        ref={dialog}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Printer className="size-5" /> {t.printerTitle}
            </h2>
            <button onClick={() => dialog.current?.close()} aria-label={t.close} className="rounded-full p-1 hover:bg-surface">
              <X className="size-5" />
            </button>
          </div>

          <p className="flex items-center gap-2 text-sm">
            <span
              className={`size-2.5 rounded-full ${
                tone === "on" ? "bg-emerald-500" : tone === "error" ? "bg-rose-500" : tone === "busy" ? "animate-pulse bg-amber-400" : "bg-neutral-400"
              }`}
            />
            <b>{statusText}</b>
            {p.name && <span className="text-muted">· {p.name}</span>}
          </p>

          {!cap.bluetooth && !cap.usb ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{t.unsupported}</p>
          ) : p.status === "connected" || p.status === "printing" ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={busy}
                onClick={() => void printSlip([{ kind: "text", text: storeName, align: "center", bold: true, size: 1.3 }, { kind: "text", text: t.testText, align: "center" }]).catch(() => {})}
                className="rounded-xl bg-brand px-3 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {t.testPrint}
              </button>
              <button onClick={disconnect} className="rounded-xl border border-line px-3 py-2.5 font-medium">
                {t.disconnect}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {cap.bluetooth && (
                <button
                  disabled={busy}
                  onClick={() => void connectBluetooth()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  <Bluetooth className="size-4" /> {t.connectBt}
                </button>
              )}
              {cap.usb && (
                <button
                  disabled={busy}
                  onClick={() => void connectUsb()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-3 py-2.5 font-medium disabled:opacity-50"
                >
                  <Usb className="size-4" /> {t.connectUsb}
                </button>
              )}
              <p className="text-xs text-muted">{t.btHint}</p>
            </div>
          )}

          <div className="space-y-2 border-t border-line pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span>{t.paper}</span>
              <div className="flex gap-1">
                {([384, 576] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      setPaper(w);
                      setPaperState(w);
                    }}
                    className={`rounded-lg border px-3 py-1 ${paper === w ? "border-brand bg-brand-soft text-brand-ink" : "border-line"}`}
                  >
                    {w === 384 ? t.paper58 : t.paper80}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => {
                  setAutoPrint(e.target.checked);
                  setAuto(e.target.checked);
                }}
                className="size-4"
              />
              {t.autoPrint}
            </label>
          </div>
        </div>
      </dialog>
    </>
  );
}
