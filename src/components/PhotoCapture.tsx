"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, RotateCcw, X } from "lucide-react";

export const PHOTO_SIZE = 600; // รูปสินค้าทุกรูป = 600×600
const MAX_BYTES = 150 * 1024;

/** canvas → Blob: WebP ก่อน (เล็กสุด), เบราว์เซอร์ที่ทำ WebP ไม่ได้ (Safari) ใช้ JPEG; ลดคุณภาพจนไม่เกิน 150KB */
async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  for (const q of [0.82, 0.7, 0.6, 0.5]) {
    let blob = await toBlob("image/webp", q);
    if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", q);
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  const last = await toBlob("image/jpeg", 0.4);
  if (!last) throw new Error("encode-failed");
  return last;
}

/**
 * ถ่ายรูปสินค้าด้วยกล้องในเว็บ (ไม่มีการเลือกไฟล์จากเครื่อง) → ครอปสี่เหลี่ยมจัตุรัสตรงกลาง 600×600 + บีบอัด
 */
export function PhotoCapture({
  onDone,
  onClose,
  labels,
}: {
  onDone: (blob: Blob) => void;
  onClose: () => void;
  labels: { title: string; capture: string; retake: string; use: string; close: string; noCamera: string };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (stopped) return;
        videoRef.current!.srcObject = stream;
        await videoRef.current!.play();
      } catch {
        if (!stopped) setError(true);
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => () => void (shot && URL.revokeObjectURL(shot.url)), [shot]);

  async function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const side = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    const blob = await encode(canvas);
    setShot({ blob, url: URL.createObjectURL(blob) });
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal aria-label={labels.title}>
      <div className="flex items-center justify-between p-3">
        <span className="font-semibold">{labels.title}</span>
        <button type="button" onClick={onClose} className="rounded-full bg-white/15 p-2" aria-label={labels.close}>
          <X className="size-5" />
        </button>
      </div>
      <div className="relative grid flex-1 place-items-center overflow-hidden">
        {/* กรอบสี่เหลี่ยมจัตุรัส = ส่วนที่จะถูกเก็บ */}
        <div className="relative aspect-square w-[min(92vw,70vh)] overflow-hidden rounded-2xl ring-4 ring-white/80">
          <video ref={videoRef} playsInline muted className={`absolute inset-0 size-full object-cover ${shot ? "hidden" : ""}`} />
          {shot && (
            // eslint-disable-next-line @next/next/no-img-element -- รูปจาก blob ในเครื่อง
            <img src={shot.url} alt="" className="absolute inset-0 size-full object-cover" />
          )}
        </div>
        {error && <p className="absolute inset-x-6 rounded-xl bg-black/70 p-4 text-center">{labels.noCamera}</p>}
      </div>
      <div className="flex items-center justify-center gap-4 p-5">
        {shot ? (
          <>
            <button
              type="button"
              onClick={() => setShot(null)}
              className="flex items-center gap-2 rounded-full bg-white/15 px-5 py-3 font-medium"
            >
              <RotateCcw className="size-5" /> {labels.retake}
            </button>
            <button
              type="button"
              onClick={() => onDone(shot.blob)}
              className="flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-semibold text-white"
            >
              <Check className="size-5" /> {labels.use}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void capture()}
            disabled={error}
            aria-label={labels.capture}
            className="grid size-18 place-items-center rounded-full border-4 border-white bg-white/20 disabled:opacity-40"
          >
            <Camera className="size-8" />
          </button>
        )}
      </div>
    </div>
  );
}
