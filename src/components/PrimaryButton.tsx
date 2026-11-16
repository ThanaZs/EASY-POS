"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

/** ปุ่มหลัก — ระหว่างส่งฟอร์มจะหมุน + กดซ้ำไม่ได้ (กันสร้างร้าน/บิลซ้ำ) */
export function PrimaryButton({ children, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
    >
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
