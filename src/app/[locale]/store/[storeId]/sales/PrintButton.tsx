"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 font-medium hover:bg-surface"
    >
      <Printer className="size-4" /> {label}
    </button>
  );
}
