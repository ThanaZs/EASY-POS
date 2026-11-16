"use client";

import { useEffect, useRef, useState } from "react";
import { Bluetooth, Check, LoaderCircle, ScanBarcode, X } from "lucide-react";
import {
  bleSupported,
  CONNECTED_WINDOW_MS,
  connectScannerBluetooth,
  disconnectScannerBluetooth,
  useBarcodeScanner,
  useScannerState,
} from "@/client/devices/scanner";
import type { Dictionary } from "@/i18n/dictionary";
import { DeviceChip } from "./DeviceChip";

const isRecent = (at: number) => at > 0 && Date.now() - at < CONNECTED_WINDOW_MS;

/** ระหว่างเปิดหน้าต่างทดสอบ: รับการสแกนเอง (ไม่ส่งต่อให้หน้า เช่นไม่หยิบใส่ตะกร้า) */
function TestCatcher({ onCode }: { onCode: (c: string) => void }) {
  useBarcodeScanner(onCode);
  return null;
}

/** ปุ่มสถานะเครื่องสแกน + หน้าต่างเชื่อม Bluetooth / ทดสอบแบบคีย์บอร์ด */
export function ScannerStatus({ t }: { t: Dictionary["devices"] }) {
  const s = useScannerState();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [testCode, setTestCode] = useState("");
  const [bt, setBt] = useState(false);
  useEffect(() => {
    setBt(bleSupported()); // eslint-disable-line react-hooks/set-state-in-effect -- รู้ได้เฉพาะใน browser
  }, []);

  const connected = s.ble === "connected" || isRecent(s.lastScanAt);
  const tone = s.ble === "connecting" ? "busy" : connected ? "on" : "off";
  const statusText = s.ble === "connecting" ? t.connecting : connected ? t.connected : t.scannerNotFound;

  return (
    <>
      <DeviceChip
        Icon={ScanBarcode}
        label={t.scanner}
        status={statusText}
        tone={tone}
        onClick={() => {
          setTestCode("");
          setOpen(true);
          dialog.current?.showModal();
        }}
      />
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50"
      >
        {open && <TestCatcher onCode={setTestCode} />}
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ScanBarcode className="size-5" /> {t.scannerTitle}
            </h2>
            <button onClick={() => dialog.current?.close()} aria-label={t.close} className="rounded-full p-1 hover:bg-surface">
              <X className="size-5" />
            </button>
          </div>

          {/* สถานะปัจจุบัน */}
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`size-2.5 rounded-full ${
                tone === "on" ? "bg-emerald-500" : tone === "busy" ? "animate-pulse bg-amber-400" : "bg-neutral-400"
              }`}
            />
            <b>{statusText}</b>
            {s.ble === "connected" && (
              <span className="text-muted">
                · {t.scannerVia} Bluetooth: {s.bleName}
              </span>
            )}
          </p>

          {/* เชื่อมผ่าน Bluetooth → เบราว์เซอร์เด้งหน้าต่างเลือกอุปกรณ์ */}
          {bt && (
            <div className="space-y-2">
              {s.ble === "connected" ? (
                <button
                  onClick={disconnectScannerBluetooth}
                  className="w-full rounded-xl border border-line px-3 py-2.5 font-medium"
                >
                  {t.disconnect}
                </button>
              ) : (
                <button
                  disabled={s.ble === "connecting"}
                  onClick={() => void connectScannerBluetooth()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 font-semibold text-white disabled:opacity-60"
                >
                  {s.ble === "connecting" ? <LoaderCircle className="size-4 animate-spin" /> : <Bluetooth className="size-4" />}
                  {s.ble === "connecting" ? t.connecting : t.scannerConnectBt}
                </button>
              )}
              {s.ble === "error" && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  {s.bleError === "hid" ? t.scannerHidHint : t.scannerBtFailed}
                </p>
              )}
              {s.ble === "idle" && <p className="text-xs text-muted">{t.scannerBtHint}</p>}
            </div>
          )}

          {/* แบบคีย์บอร์ด: ยิงทดสอบ */}
          <div className="space-y-2 border-t border-line pt-3">
            {bt && <p className="text-sm font-medium">{t.scannerOr}</p>}
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>{t.scannerUsb}</li>
              <li>{t.scannerBt}</li>
              <li>{t.scannerTest}</li>
            </ol>
            <div
              className={`rounded-xl border-2 border-dashed p-4 text-center ${
                testCode ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-line"
              }`}
            >
              {testCode ? (
                <p className="flex items-center justify-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                  <Check className="size-5" /> {t.connected}: <code className="font-mono">{testCode}</code>
                </p>
              ) : (
                <p className="animate-pulse text-muted">{t.scannerWaiting}</p>
              )}
            </div>
            <p className="text-xs text-muted">✓ {t.scannerLang}</p>
          </div>
        </div>
      </dialog>
    </>
  );
}
