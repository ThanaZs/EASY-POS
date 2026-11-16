"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/PrimaryButton";
import { voidSaleAction } from "./actions";

/** ปุ่มยกเลิกบิล — กดแล้วถามยืนยัน + ใส่เหตุผลก่อน */
export function VoidForm({
  locale,
  storeId,
  saleId,
  labels,
}: {
  locale: string;
  storeId: string;
  saleId: string;
  labels: { void: string; reason: string; confirm: string; cancel: string };
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-rose-300 px-4 py-2.5 font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
      >
        {labels.void}
      </button>
    );
  }
  return (
    <form action={voidSaleAction} className="space-y-3 rounded-2xl border border-rose-300 bg-card p-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="saleId" value={saleId} />
      <p className="text-sm">{labels.confirm}</p>
      <input
        name="reason"
        maxLength={200}
        placeholder={labels.reason}
        autoFocus
        className="w-full rounded-xl border border-line bg-card px-3 py-2 outline-none focus:border-brand"
      />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line px-4 py-2.5 font-medium">
          {labels.cancel}
        </button>
        <PrimaryButton type="submit">{labels.void}</PrimaryButton>
      </div>
    </form>
  );
}
