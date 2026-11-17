"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { scanFeedback, useBarcodeCamera } from "@/client/camera";

/**
 * กล้องสแกนบาร์โค้ด (เต็มจอ) สำหรับกรอกช่อง/ค้นหา
 * - continuous=true: สแกนต่อเนื่อง
 * - continuous=false: เจอแล้วปิดเอง (กรอกช่องบาร์โค้ด)
 * (หน้าขายใช้ PosScanView ที่มีตะกร้า/ยอดรวมในตัว)
 */
export function CameraScanner({
  onDetected,
  onClose,
  continuous = false,
  labels,
  status,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
  continuous?: boolean;
  labels: { title: string; close: string; hint: string; noCamera: string };
  status?: string | null; // ข้อความผลล่าสุดจากผู้เรียก เช่น "เพิ่ม น้ำดื่ม แล้ว"
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const error = useBarcodeCamera(
    videoRef,
    (code) => {
      scanFeedback();
      onDetected(code);
      if (!continuous) onClose();
    },
    { continuous, noCameraText: labels.noCamera },
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal
      aria-label={labels.title}
    >
      <div className="flex items-center justify-between p-3">
        <span className="font-semibold">{labels.title}</span>
        <button
          onClick={onClose}
          className="rounded-full bg-white/15 p-2"
          aria-label={labels.close}
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          playsInline
          muted
        />
        {/* กรอบเล็ง */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-40 w-72 max-w-[80%] rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <p className="rounded-xl bg-black/70 p-4">{error}</p>
          </div>
        )}
      </div>
      <div className="space-y-1 p-4 text-center text-sm">
        {status ? (
          <p className="font-semibold text-emerald-300">{status}</p>
        ) : (
          <p className="text-white/70">{labels.hint}</p>
        )}
      </div>
    </div>
  );
}
