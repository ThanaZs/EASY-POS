"use client";

import { useRef, useState } from "react";
import { Check, ScanBarcode, X } from "lucide-react";
import { isScannerConnected, useBarcodeScanner, useKeyLog, useScannerState } from "@/client/devices/scanner";
import type { Dictionary } from "@/i18n/dictionary";
import { DeviceChip } from "./DeviceChip";

/** ระหว่างเปิดหน้าต่างทดสอบ: รับการสแกนเอง (ไม่ส่งต่อให้หน้า เช่นไม่หยิบใส่ตะกร้า) */
function TestCatcher({ onCode }: { onCode: (c: string) => void }) {
  useBarcodeScanner(onCode);
  return null;
}

/** แสดงปุ่มที่เครื่องได้รับล่าสุด — ใช้ดูว่าเครื่องสแกนส่งอะไรมา (ช่วยแก้ปัญหาเฉพาะเครื่อง) */
function KeyLogView({ label }: { label: string }) {
  const log = useKeyLog();
  return (
    <details className="text-xs text-muted">
      <summary className="cursor-pointer">{label} ({log.length})</summary>
      <code className="mt-1 block break-all rounded-lg bg-surface p-2 font-mono">
        {log.length ? log.map((k) => `${k.src === "input" ? "i:" : ""}${k.key}${k.code ? `/${k.code}` : ""}+${k.dt}`).join("  ") : "—"}
      </code>
    </details>
  );
}

/** ปุ่มสถานะเครื่องสแกน (แบบคีย์บอร์ด USB / Bluetooth ที่จับคู่ในตั้งค่าเครื่อง) + หน้าต่างวิธีเชื่อม/ทดสอบ */
export function ScannerStatus({ t }: { t: Dictionary["devices"] }) {
  const s = useScannerState();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [testCode, setTestCode] = useState("");
  const connected = isScannerConnected(s);

  return (
    <>
      <DeviceChip
        Icon={ScanBarcode}
        label={t.scanner}
        status={connected ? t.connected : t.scannerNotFound}
        tone={connected ? "on" : "off"}
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
          <p className="flex items-center gap-2 text-sm">
            <span className={`size-2.5 rounded-full ${connected || testCode ? "bg-emerald-500" : "bg-neutral-400"}`} />
            <b>{connected || testCode ? t.connected : t.scannerNotFound}</b>
          </p>
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
          <input
            autoFocus
            inputMode="none"
            autoComplete="off"
            placeholder={t.scannerTapHere}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-center text-sm"
          />
          {open && <KeyLogView label={t.scannerDebug} />}
          <p className="text-xs text-muted">✓ {t.scannerLang}</p>
          <p className="text-xs text-muted">{t.scannerReset}</p>
        </div>
      </dialog>
    </>
  );
}
