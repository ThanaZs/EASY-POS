"use client";

import { askConfirm, askText, confirmSubmit } from "@/components/AppDialog";
import { useRef, useState } from "react";
import { ImageUp, LoaderCircle, Pencil, QrCode, Trash2 } from "lucide-react";
import { fill } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";
import { savePayQrAction } from "./actions";

/** ด้านยาวสุดของรูป QR ที่เก็บ — พอให้สแกนจากจอคมชัด แต่ไฟล์เล็ก */
const MAX_SIDE = 1000;
/** server รับไม่เกิน 300KB */
const MAX_BYTES = 280 * 1024;

/**
 * ย่อรูป QR ในเบราว์เซอร์ก่อนอัปโหลด: พื้นขาว (รูปโปร่งใสไม่ดำ), ย่อให้ด้านยาวสุด ≤ 1000px
 * เข้ารหัส WebP ไม่สูญเสียก่อน (QR คมที่สุด) → ใหญ่ไป/ไม่รองรับ ค่อยลดเป็น JPEG คุณภาพสูง
 */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, w, h);
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const enc = (type: string, q?: number) =>
    new Promise<Blob | null>((r) => c.toBlob(r, type, q));
  // server รับ WebP/JPEG — WebP คุณภาพ 1 = ไม่สูญเสีย (QR คมสุด); Safari เข้ารหัส WebP ไม่ได้ → ข้ามไป JPEG
  const tries: Array<[string, number]> = [
    ["image/webp", 1],
    ["image/webp", 0.95],
    ["image/jpeg", 0.95],
    ["image/jpeg", 0.88],
    ["image/jpeg", 0.75],
  ];
  let last: Blob | null = null;
  for (const [type, q] of tries) {
    const b = await enc(type, q);
    if (!b || b.type !== type) continue;
    last = b;
    if (b.size <= MAX_BYTES) return b;
  }
  if (!last) throw new Error("encode failed");
  return last;
}

type Qr = { path: string; label: string; url: string };

/** การ์ด "QR รับเงิน" ในตั้งค่าร้าน: หลายรูป (หลายธนาคาร/บัญชี) — เพิ่ม / แก้ชื่อ / ลบ */
export function PayQrField({
  locale,
  storeId,
  qrs,
  status,
  t,
}: {
  locale: string;
  storeId: string;
  qrs: Qr[];
  status?: string;
  t: Dictionary["settings"]["payQr"];
}) {
  const form = useRef<HTMLFormElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const label = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const full = qrs.length >= 6;

  async function onPick(f: File | undefined) {
    if (!f) return;
    setError("");
    const name = await askText(t.namePrompt, `QR ${qrs.length + 1}`);
    if (name === null) return;
    setBusy(true);
    try {
      const blob = await shrink(f);
      const ext = blob.type.split("/")[1] ?? "jpg";
      const dt = new DataTransfer();
      dt.items.add(new File([blob], `qr.${ext}`, { type: blob.type }));
      file.current!.files = dt.files;
      label.current!.value = name.trim();
      form.current!.requestSubmit();
    } catch {
      setBusy(false);
      setError(t.invalid);
    }
  }

  const msgs: Record<string, string> = {
    saved: t.saved,
    removed: t.removed,
    renamed: t.renamed,
    invalid: t.invalid,
    big: t.big,
    failed: t.failed,
    full: t.full,
  };
  const msg = error || (status ? (msgs[status] ?? "") : "");
  const bad =
    !!error || ["invalid", "big", "failed", "full"].includes(status ?? "");
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="storeId" value={storeId} />
    </>
  );

  return (
    <section
      id="pay-qr"
      className="scroll-mt-20 space-y-3 rounded-2xl border border-line bg-card p-4"
    >
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <QrCode className="size-5 text-brand" /> {t.title}
        </h2>
        <p className="text-sm text-muted">{t.hint}</p>
      </div>
      {msg && (
        <p
          role="status"
          className={`text-sm font-medium ${bad ? "text-rose-600" : "text-emerald-600"}`}
        >
          {msg}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {qrs.map((q) => (
          <li
            key={q.path}
            className="flex flex-col gap-2 rounded-xl border border-line p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage */}
            <img
              src={q.url}
              alt={q.label}
              className="aspect-square w-full rounded-lg bg-white object-contain"
            />
            <p className="truncate text-center text-sm font-medium">
              {q.label}
            </p>
            <div className="flex gap-1.5">
              <form
                action={savePayQrAction}
                className="flex-1"
                onSubmit={(e) => {
                  const f = e.currentTarget;
                  confirmSubmit(e, async () => {
                    const name = await askText(t.namePrompt, q.label);
                    if (!name || name === q.label) return false;
                    (f.elements.namedItem("label") as HTMLInputElement).value =
                      name;
                    return true;
                  });
                }}
              >
                {hidden}
                <input type="hidden" name="op" value="rename" />
                <input type="hidden" name="path" value={q.path} />
                <input type="hidden" name="label" value="" />
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-1 rounded-lg border border-line py-1.5 text-xs font-medium hover:border-brand"
                >
                  <Pencil className="size-3.5" /> {t.rename}
                </button>
              </form>
              <form
                action={savePayQrAction}
                onSubmit={(e) =>
                  confirmSubmit(e, () =>
                    askConfirm(fill(t.removeConfirm, { name: q.label }), {
                      ok: t.remove,
                      danger: true,
                    }),
                  )
                }
              >
                {hidden}
                <input type="hidden" name="op" value="remove" />
                <input type="hidden" name="path" value={q.path} />
                <button
                  type="submit"
                  disabled={busy}
                  aria-label={t.remove}
                  title={t.remove}
                  className="grid h-full place-items-center rounded-lg border border-line px-2.5 text-rose-600 hover:border-rose-300"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </form>
            </div>
          </li>
        ))}
        {!full && (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => pick.current?.click()}
              className="flex aspect-square h-auto w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-sm font-semibold text-brand-ink transition hover:border-brand active:scale-95 disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="size-7 animate-spin" />
              ) : (
                <ImageUp className="size-7" />
              )}
              {busy ? t.saving : t.upload}
            </button>
          </li>
        )}
      </ul>
      {full && <p className="text-xs text-muted">{t.full}</p>}

      {/* เลือกไฟล์ (ไม่ส่งตรง) → ย่อแล้วใส่ช่องที่ส่งจริง */}
      <input
        ref={pick}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <form ref={form} action={savePayQrAction} hidden>
        {hidden}
        <input type="hidden" name="op" value="add" />
        <input ref={label} type="hidden" name="label" />
        <input ref={file} type="file" name="qr" />
      </form>
    </section>
  );
}
