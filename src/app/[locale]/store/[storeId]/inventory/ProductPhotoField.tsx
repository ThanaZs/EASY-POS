"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageOff, Trash2 } from "lucide-react";
import { PhotoCapture } from "@/components/PhotoCapture";
import type { Dictionary } from "@/i18n/dictionary";

/**
 * รูปสินค้าในฟอร์ม: ถ่ายจากกล้องในเว็บเท่านั้น (ไม่มีปุ่มเลือกไฟล์)
 * รูปที่ถ่ายจะถูกใส่ใน <input type="file" name="photo"> ที่ซ่อนไว้ แล้วส่งไปพร้อมฟอร์ม
 */
export function ProductPhotoField({
  currentUrl,
  t,
  noCamera,
}: {
  currentUrl: string | null;
  t: Dictionary["photo"];
  noCamera: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function useShot(blob: Blob) {
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const file = new File([blob], `photo.${ext}`, { type: blob.type });
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileRef.current) fileRef.current.files = dt.files;
    setPreview(URL.createObjectURL(blob));
    setRemoved(false);
    setOpen(false);
  }

  function remove() {
    if (fileRef.current) fileRef.current.value = "";
    setPreview(null);
    setRemoved(true);
  }

  const shown = preview ?? (removed ? null : currentUrl);

  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="text-sm text-muted">{t.title}</span>
      <div className="flex items-center gap-4">
        <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-surface">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage / blob (ไม่ใช้ Image Optimization เพื่อไม่กินโควตา)
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <ImageOff className="size-8 text-muted" />
          )}
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 font-semibold text-white"
          >
            <Camera className="size-4" /> {shown ? t.change : t.take}
          </button>
          {shown && (
            <button type="button" onClick={remove} className="flex items-center gap-2 text-sm text-rose-600 hover:underline">
              <Trash2 className="size-4" /> {t.remove}
            </button>
          )}
          <p className="text-xs text-muted">{t.hint}</p>
        </div>
      </div>
      <input ref={fileRef} type="file" name="photo" accept="image/webp,image/jpeg" hidden tabIndex={-1} />
      {removed && <input type="hidden" name="removePhoto" value="1" />}
      {open && (
        <PhotoCapture
          onDone={useShot}
          onClose={() => setOpen(false)}
          labels={{ title: t.title, capture: t.capture, retake: t.retake, use: t.use, close: t.close, noCamera }}
        />
      )}
    </div>
  );
}
