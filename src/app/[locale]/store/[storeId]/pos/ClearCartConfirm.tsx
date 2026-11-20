"use client";

import { Trash2 } from "lucide-react";
import { fill } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";

/** ถามยืนยันก่อนล้างตะกร้า (กันกดพลาด) — ใช้ทั้งหน้าขายปกติและหน้ากล้อง */
export function ClearCartConfirm({
  itemCount,
  totalText,
  t,
  onCancel,
  onConfirm,
}: {
  itemCount: number;
  totalText: string;
  t: Pick<
    Dictionary["pos"],
    "clearConfirmTitle" | "clearConfirmText" | "cancel" | "clear"
  >;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-6"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs space-y-4 rounded-3xl bg-card p-5 text-center text-ink shadow-2xl"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950">
          <Trash2 className="size-7" />
        </span>
        <div>
          <p className="text-lg font-bold">{t.clearConfirmTitle}</p>
          <p className="text-sm text-muted">
            {fill(t.clearConfirmText, { n: itemCount, total: totalText })}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className="h-12 rounded-xl border border-line font-semibold active:scale-95"
          >
            {t.cancel}
          </button>
          <button
            onClick={onConfirm}
            className="h-12 rounded-xl bg-rose-600 font-semibold text-white active:scale-95"
          >
            {t.clear}
          </button>
        </div>
      </div>
    </div>
  );
}
