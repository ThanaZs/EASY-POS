"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, LogOut, Trash2, TriangleAlert } from "lucide-react";
import { fill } from "@/core/lib/format";
import type { Dictionary } from "@/i18n/dictionary";
import { deleteStoreAction, leaveStoreAction } from "./danger-actions";

function ConfirmButton({ enabled, label }: { enabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!enabled || pending}
      className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40"
    >
      {pending && <LoaderCircle className="size-4 animate-spin" />}
      {label}
    </button>
  );
}

/**
 * mode="delete": เจ้าของลบร้าน — ต้องพิมพ์ชื่อร้านให้ตรงก่อนกดได้
 * mode="leave": พนักงานออกจากร้าน — ยืนยันครั้งเดียว
 */
export function StoreDangerDialog({
  mode,
  locale,
  storeId,
  storeName,
  t,
  mismatch = false,
}: {
  mode: "delete" | "leave";
  locale: string;
  storeId: string;
  storeName: string;
  t: Dictionary["danger"];
  mismatch?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const del = mode === "delete";
  const ok = !del || text.trim() === storeName.trim();

  useEffect(() => {
    if (mismatch) dialog.current?.showModal();
  }, [mismatch]);

  const Icon = del ? Trash2 : LogOut;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setText("");
          dialog.current?.showModal();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 px-4 py-2.5 font-medium text-rose-600 transition hover:bg-rose-50 active:scale-[0.98] dark:border-rose-900 dark:hover:bg-rose-950"
      >
        <Icon className="size-4" /> {del ? t.deleteStore : t.leave}
      </button>

      <dialog
        ref={dialog}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <form action={del ? deleteStoreAction : leaveStoreAction} className="space-y-4 p-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="storeId" value={storeId} />
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950">
              <TriangleAlert className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">{fill(del ? t.deleteTitle : t.leaveTitle, { name: storeName })}</h2>
              <p className="text-sm text-muted">{del ? t.deleteWarn : t.leaveWarn}</p>
            </div>
          </div>

          {del && (
            <>
              <ul className="list-disc space-y-1 rounded-xl bg-rose-50 py-3 pl-8 pr-3 text-sm text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                <li>{t.deleteData}</li>
                <li>{t.deleteStaff}</li>
              </ul>
              <label className="block space-y-1">
                <span className="text-sm">
                  {t.typeName} <b className="select-all rounded bg-surface px-1.5 py-0.5">{storeName}</b>
                </span>
                <input
                  name="confirm"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  autoComplete="off"
                  className={`w-full rounded-xl border bg-card px-3 py-2.5 outline-none focus:ring-2 ${
                    text && !ok ? "border-rose-400 focus:ring-rose-200" : "border-line focus:border-rose-500 focus:ring-rose-200"
                  }`}
                />
                {mismatch && !text && <span className="text-sm text-rose-600">{t.mismatch}</span>}
              </label>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="rounded-xl border border-line px-4 py-2.5 font-medium"
            >
              {t.cancel}
            </button>
            <ConfirmButton enabled={ok} label={del ? t.deleteConfirm : t.leaveConfirm} />
          </div>
        </form>
      </dialog>
    </>
  );
}
