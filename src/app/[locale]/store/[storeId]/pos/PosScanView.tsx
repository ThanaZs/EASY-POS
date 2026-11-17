"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ImageOff,
  Minus,
  PauseCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { scanFeedback, useBarcodeCamera } from "@/client/camera";
import { fill } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";

export type ScanLine = {
  key: string;
  label: string;
  imageUrl: string | null;
  unitPriceMinor: number;
  qty: number;
  canAdd: boolean;
};

const SPEEDS = [600, 900, 1200, 1500];
const SPEED_KEY = "ep_scan_speed";

function loadSpeed() {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY));
    return SPEEDS.includes(v) ? v : 900;
  } catch {
    return 900;
  }
}

/**
 * หน้าสแกนด้วยกล้องของระบบขาย (เต็มจอ):
 * บน = ยอดรวม + พักบิล/ล้างตะกร้า · ความเร็วการสแกน · กลาง = กล้อง + รายการที่สแกนแล้ว (ล่าสุดอยู่บน) · ล่าง = ย้อนกลับ / สรุปรายการ
 */
export function PosScanView({
  lines,
  totalText,
  itemCount,
  money,
  onCode,
  setQty,
  onClear,
  onHold,
  onClose,
  onSummary,
  t,
}: {
  lines: ScanLine[];
  totalText: string;
  itemCount: number;
  money: (minor: number) => string;
  /** คืนข้อความผล + สำเร็จไหม */
  onCode: (code: string) => { ok: boolean; message: string; key?: string };
  setQty: (key: string, qty: number) => void;
  onClear: () => void;
  onHold: () => void;
  onClose: () => void;
  onSummary: () => void;
  t: { pos: Dictionary["pos"]; scan: Dictionary["scan"] };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(loadSpeed);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [order, setOrder] = useState<string[]>([]); // คีย์ที่สแกนล่าสุดอยู่หน้า (ที่ไม่ได้สแกน เช่นแตะเลือกเอง ต่อท้าย)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const error = useBarcodeCamera(
    videoRef,
    (code) => {
      const res = onCode(code);
      scanFeedback(res.ok);
      const key = res.key;
      if (key) setOrder((o) => [key, ...o.filter((k) => k !== key)]); // ที่เพิ่งสแกนขึ้นบนสุด
      setToast(res);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 1800);
    },
    { continuous: true, cooldownMs: speed, noCameraText: t.scan.noCamera },
  );

  const rank = (k: string) => {
    const i = order.indexOf(k);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const sorted = [...lines].sort((a, b) => rank(a.key) - rank(b.key));

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black text-ink"
      role="dialog"
      aria-modal
      aria-label={t.scan.title}
    >
      {/* บน: ปุ่ม + ยอดรวม */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-brand to-amber-400 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <button
          onClick={onHold}
          disabled={lines.length === 0}
          className="flex items-center gap-1 rounded-xl border border-white/60 bg-white/15 px-3 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-40"
        >
          <PauseCircle className="size-4" /> {t.pos.hold}
        </button>
        <button
          onClick={onClear}
          disabled={lines.length === 0}
          className="flex items-center gap-1 rounded-xl border border-white/60 bg-white/15 px-3 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-40"
        >
          <Trash2 className="size-4" /> {t.pos.clearCart}
        </button>
        <div className="ml-auto min-w-0 text-right leading-tight">
          <p className="text-xs opacity-90">
            {fill(t.pos.itemsCount, { n: itemCount })}
          </p>
          <p className="truncate text-3xl font-bold tabular-nums sm:text-4xl">
            {totalText}
          </p>
        </div>
      </div>

      {/* ความเร็วการสแกน */}
      <div className="flex items-center gap-2 overflow-x-auto bg-card px-3 py-2 text-sm">
        <span className="shrink-0 text-muted">{t.pos.scanSpeed}:</span>
        {SPEEDS.map((ms) => (
          <button
            key={ms}
            onClick={() => {
              setSpeed(ms);
              try {
                localStorage.setItem(SPEED_KEY, String(ms));
              } catch {
                // ignore
              }
            }}
            className={`shrink-0 rounded-lg px-3 py-1 font-semibold transition active:scale-95 ${
              speed === ms ? "bg-brand-soft text-brand-ink" : "text-muted"
            }`}
          >
            {fill(t.pos.seconds, { n: (ms / 1000).toFixed(1) })}
          </button>
        ))}
      </div>

      {/* กล้อง + รายการ */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          playsInline
          muted
        />
        <div className="pointer-events-none absolute inset-x-0 top-6 grid place-items-center">
          <div className="h-28 w-64 max-w-[80%] rounded-2xl border-4 border-white/80" />
        </div>
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <p className="rounded-xl bg-black/70 p-4">{error}</p>
          </div>
        )}
        {toast && (
          <p
            role="status"
            className={`absolute inset-x-3 top-40 z-10 rounded-xl px-3 py-2 text-center text-sm font-semibold text-white shadow-lg ${
              toast.ok ? "bg-emerald-600/90" : "bg-rose-600/90"
            }`}
          >
            {toast.message}
          </p>
        )}
        <ul className="absolute inset-x-0 bottom-0 max-h-[55%] space-y-2 overflow-y-auto p-3">
          {sorted.length === 0 && (
            <li className="rounded-xl bg-black/50 p-3 text-center text-sm text-white/90">
              {t.scan.hint}
            </li>
          )}
          {sorted.map((l) => (
            <li
              key={l.key}
              className="flex items-center gap-3 rounded-2xl bg-card/90 p-2 shadow backdrop-blur"
            >
              {l.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage
                <img
                  src={l.imageUrl}
                  alt=""
                  className="size-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-surface text-muted">
                  <ImageOff className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.label}</p>
                <p className="text-sm text-muted tabular-nums">
                  {money(l.unitPriceMinor)}{" "}
                  <span className="text-rose-500">×</span> {l.qty}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="font-bold tabular-nums">
                  {money(l.unitPriceMinor * l.qty)}
                </p>
                <div className="flex items-center rounded-lg border border-line bg-card">
                  <button
                    className="p-1"
                    onClick={() => setQty(l.key, l.qty - 1)}
                    aria-label="-"
                  >
                    {l.qty === 1 ? (
                      <Trash2 className="size-4 text-rose-600" />
                    ) : (
                      <Minus className="size-4" />
                    )}
                  </button>
                  <button
                    className="p-1 disabled:opacity-30"
                    onClick={() => setQty(l.key, l.qty + 1)}
                    disabled={!l.canAdd}
                    aria-label="+"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ล่าง */}
      <div className="grid grid-cols-2 bg-gradient-to-r from-brand to-amber-400 pb-[env(safe-area-inset-bottom)] text-lg font-semibold text-white">
        <button
          onClick={onClose}
          className="flex items-center justify-center gap-2 py-4 transition active:scale-95"
        >
          <ArrowLeft className="size-5" /> {t.pos.back}
        </button>
        <button
          onClick={onSummary}
          disabled={lines.length === 0}
          className="flex items-center justify-center gap-2 border-l border-white/40 py-4 transition active:scale-95 disabled:opacity-40"
        >
          {t.pos.summary} <ArrowRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
