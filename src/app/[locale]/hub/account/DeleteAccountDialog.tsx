"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { fill } from "@/core/lib/format";
import { deleteAccountAction } from "../actions";

type Labels = {
  deleteAccount: string;
  deleteTitle: string;
  deleteWarn: string;
  deleteAccountData: string;
  deleteStores: string;
  deleteNoStores: string;
  deleteTypePrompt: string;
  deleteWord: string;
  deleteConfirm: string;
  cancel: string;
  deleteMismatch: string;
};

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

/** ปุ่มลบบัญชี → ป๊อปอัพเตือน + ต้องพิมพ์คำยืนยันให้ตรงก่อนถึงจะกดลบได้ */
export function DeleteAccountDialog({
  locale,
  ownedStores,
  labels,
  mismatch,
}: {
  locale: string;
  ownedStores: string[];
  labels: Labels;
  mismatch: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const ok = text.trim() === labels.deleteWord;

  // ถ้า server ตอบกลับว่าพิมพ์ไม่ตรง → เปิดป๊อปอัพค้างไว้ให้แก้
  useEffect(() => {
    if (mismatch) dialogRef.current?.showModal();
  }, [mismatch]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setText("");
          dialogRef.current?.showModal();
        }}
        className="w-full rounded-xl border border-rose-300 px-4 py-2.5 font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950"
      >
        {labels.deleteAccount}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <form action={deleteAccountAction} className="space-y-4 p-5">
          <input type="hidden" name="locale" value={locale} />
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950">
              <TriangleAlert className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">{labels.deleteTitle}</h2>
              <p className="text-sm text-muted">{labels.deleteWarn}</p>
            </div>
          </div>

          <ul className="list-disc space-y-1 rounded-xl bg-rose-50 py-3 pl-8 pr-3 text-sm text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
            <li>{labels.deleteAccountData}</li>
            <li>
              {ownedStores.length === 0 ? (
                labels.deleteNoStores
              ) : (
                <>
                  {labels.deleteStores}
                  <ul className="mt-1 list-[circle] pl-5 font-semibold">
                    {ownedStores.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
            </li>
          </ul>

          <label className="block space-y-1">
            <span className="text-sm">
              {fill(labels.deleteTypePrompt, { word: "" })}
              <b className="select-all rounded bg-surface px-1.5 py-0.5 font-mono">{labels.deleteWord}</b>
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
            {mismatch && !text && <span className="text-sm text-rose-600">{labels.deleteMismatch}</span>}
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-xl border border-line px-4 py-2.5 font-medium"
            >
              {labels.cancel}
            </button>
            <ConfirmButton enabled={ok} label={labels.deleteConfirm} />
          </div>
        </form>
      </dialog>
    </>
  );
}
