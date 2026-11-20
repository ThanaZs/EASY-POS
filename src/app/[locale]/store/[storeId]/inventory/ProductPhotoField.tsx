"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { PhotoCapture } from "@/components/PhotoCapture";
import type { Dictionary } from "@/i18n/dictionary";
import { CATALOG_FILL, type CatalogFillDetail } from "./CatalogLookup";

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
  // รูปจากคลังข้อมูล (ใช้เมื่อไม่ได้ถ่ายเอง) — server โหลดมาเก็บตอนบันทึก
  const [catalog, setCatalog] = useState<{ url: string; ref: string } | null>(
    null,
  );
  useEffect(() => {
    const onFill = (e: Event) => {
      const { imageUrl, imageRef } = (e as CustomEvent<CatalogFillDetail>)
        .detail;
      if (imageUrl && imageRef) {
        setCatalog({ url: imageUrl, ref: imageRef });
        setRemoved(false);
      }
    };
    window.addEventListener(CATALOG_FILL, onFill);
    return () => window.removeEventListener(CATALOG_FILL, onFill);
  }, []);
  useEffect(
    () => () => void (preview && URL.revokeObjectURL(preview)),
    [preview],
  );

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
    setCatalog(null);
    setRemoved(true);
  }

  const shown = preview ?? (removed ? null : (catalog?.url ?? currentUrl));

  // แบบกะทัดรัด: ช่องรูปสี่เหลี่ยม แตะ = ถ่ายรูป (อยู่บนสุดของฟอร์ม คู่กับชื่อสินค้า)
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={shown ? t.change : t.take}
        className="grid size-[5.5rem] place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface text-muted transition active:scale-95 hover:border-brand"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage / blob (ไม่ใช้ Image Optimization เพื่อไม่กินโควตา)
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs">
            <span className="grid size-10 place-items-center rounded-full bg-brand text-white shadow-sm">
              <Camera className="size-5" />
            </span>
            {t.take}
          </span>
        )}
      </button>
      {shown && (
        <button
          type="button"
          onClick={remove}
          aria-label={t.remove}
          className="absolute -right-1.5 -top-1.5 grid size-7 place-items-center rounded-full border border-line bg-card text-rose-600 shadow"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        name="photo"
        accept="image/webp,image/jpeg"
        hidden
        tabIndex={-1}
      />
      {removed && <input type="hidden" name="removePhoto" value="1" />}
      {catalog && !preview && (
        <input type="hidden" name="catalogImage" value={catalog.ref} />
      )}
      {open && (
        <PhotoCapture
          onDone={useShot}
          onClose={() => setOpen(false)}
          t={t}
          noCamera={noCamera}
        />
      )}
    </div>
  );
}
