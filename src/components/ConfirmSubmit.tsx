"use client";

import { useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, TriangleAlert } from "lucide-react";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
    >
      {pending && <LoaderCircle className="size-4 animate-spin" />}
      {label}
    </button>
  );
}

/** ปุ่มที่ต้องยืนยันในป๊อปอัพก่อนส่งฟอร์ม (เช่น ลบรหัสเชิญ) — children = hidden inputs ของฟอร์ม */
export function ConfirmSubmit({
  action,
  trigger,
  triggerLabel,
  title,
  message,
  confirmLabel,
  cancelLabel,
  children,
}: {
  action: (form: FormData) => void | Promise<void>;
  trigger: ReactNode;
  triggerLabel: string;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={triggerLabel}
        title={triggerLabel}
        className="rounded-lg p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 dark:hover:bg-rose-950"
      >
        {trigger}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <form action={action} className="space-y-4 p-5">
          {children}
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950">
              <TriangleAlert className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="text-sm text-muted">{message}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="rounded-xl border border-line px-4 py-2.5 font-medium"
            >
              {cancelLabel}
            </button>
            <SubmitButton label={confirmLabel} />
          </div>
        </form>
      </dialog>
    </>
  );
}
