"use client";

import { useRef, useState } from "react";
import {
  Flashlight,
  FlashlightOff,
  Keyboard,
  SwitchCamera,
} from "lucide-react";
import type { BarcodeCamera } from "@/client/camera";
import type { Dictionary } from "@/i18n/dictionary";

/** แตะภาพกล้องเพื่อโฟกัส — คืน onClick สำหรับกล่องวิดีโอ + วงโฟกัสที่จะวาด */
export function useTapFocus(cam: BarcodeCamera) {
  const [ring, setRing] = useState<{
    x: number;
    y: number;
    key: number;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onTap = (e: React.MouseEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget && !(e.target instanceof HTMLVideoElement))
      return; // แตะปุ่ม/รายการ ไม่ใช่ภาพ
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cam.focusAt(x, y);
    setRing({ x: e.clientX - r.left, y: e.clientY - r.top, key: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setRing(null), 900);
  };
  const ringEl = ring && (
    <span
      key={ring.key}
      className="pointer-events-none absolute z-10 size-16 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-amber-300"
      style={{ left: ring.x, top: ring.y }}
    />
  );
  return { onTap, ringEl };
}

/**
 * ปุ่มบนภาพกล้อง: ไฟฉาย (ถ้าเครื่องรองรับ) + พิมพ์รหัสเอง
 * อ่านไม่ได้นาน → ขึ้นคำแนะนำ (ยังสแกนต่อได้เรื่อยๆ ไม่ต้องปิด)
 */
export function CameraTools({
  cam,
  onManual,
  t,
  className = "",
}: {
  cam: BarcodeCamera;
  onManual: (code: string) => void;
  t: Dictionary["scan"];
  className?: string;
}) {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const submit = () => {
    const code = text.replace(/\s/g, "");
    if (code) onManual(code);
    setText("");
    setTyping(false);
  };
  return (
    <div
      className={`pointer-events-none absolute inset-x-3 z-10 flex flex-col items-end gap-2 ${className}`}
    >
      <div className="pointer-events-auto flex gap-2">
        {/* สลับกล้องหลัง (มือถือหลายเลนส์) — เลือกแล้วจำไว้ในเครื่องนี้ */}
        {!cam.error && cam.camera.total > 1 && (
          <button
            type="button"
            onClick={cam.switchCamera}
            aria-label={t.switchCamera}
            title={t.switchCamera}
            className="flex h-11 items-center gap-1 rounded-full bg-black/55 px-3 text-sm font-semibold text-white shadow-lg transition active:scale-90"
          >
            <SwitchCamera className="size-5" /> {cam.camera.index + 1}/
            {cam.camera.total}
          </button>
        )}
        {/* แสดงปุ่มไฟฉายเสมอ (บางเครื่องไม่บอกว่ารองรับ แต่เปิดได้) — เปิดไม่ได้จะขึ้นข้อความแจ้ง */}
        {!cam.error && (
          <button
            type="button"
            onClick={cam.torch.toggle}
            aria-label={t.torch}
            title={t.torch}
            className={`grid size-11 place-items-center rounded-full shadow-lg transition active:scale-90 ${
              cam.torch.on
                ? "bg-amber-300 text-black"
                : "bg-black/55 text-white"
            }`}
          >
            {cam.torch.on ? (
              <Flashlight className="size-5" />
            ) : (
              <FlashlightOff className="size-5" />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setTyping((v) => !v)}
          aria-label={t.typeCode}
          title={t.typeCode}
          className="grid size-11 place-items-center rounded-full bg-black/55 text-white shadow-lg transition active:scale-90"
        >
          <Keyboard className="size-5" />
        </button>
      </div>
      {cam.torch.auto && (
        <p
          className="pointer-events-auto w-full max-w-sm rounded-xl bg-amber-300/95 px-3 py-2 text-center text-sm font-medium text-black"
          role="status"
        >
          {t.torchAuto}
        </p>
      )}
      {cam.torch.failed && (
        <p
          className="pointer-events-auto w-full max-w-sm rounded-xl bg-black/70 px-3 py-2 text-center text-sm text-white"
          role="status"
        >
          {t.torchUnsupported}
        </p>
      )}
      {typing && (
        // ไม่ใช้ <form>: หน้ากล้องมักอยู่ในฟอร์มสินค้า — กด Enter แล้วจะกลายเป็นบันทึกฟอร์มสินค้าแทน
        <div className="pointer-events-auto flex w-full max-w-sm gap-2 rounded-2xl bg-card p-2 shadow-lg">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                submit();
              }
            }}
            inputMode="numeric"
            enterKeyHint="done"
            placeholder={t.typePlaceholder}
            className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 font-mono text-ink outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={submit}
            className="rounded-xl bg-brand px-4 font-semibold text-white"
          >
            OK
          </button>
        </div>
      )}
      {cam.stalled && !typing && !cam.error && (
        <p
          className="pointer-events-auto w-full rounded-xl bg-black/65 px-3 py-2 text-center text-sm text-white"
          role="status"
        >
          {t.stalled}
        </p>
      )}
    </div>
  );
}
