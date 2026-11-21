"use client";

import { useState } from "react";

/**
 * รูป QR รับเงินในหน้าชำระเงิน — ร้านมีหลาย QR (หลายธนาคาร/บัญชี) แตะชื่อเพื่อสลับ
 * จำอันที่เลือกล่าสุดไว้ในเครื่อง (เปิดครั้งหน้าขึ้นอันเดิม)
 */
export function PayQrView({
  storeId,
  qrs,
  caption,
}: {
  storeId: string;
  qrs: Array<{ label: string; url: string }>;
  caption: React.ReactNode;
}) {
  const key = `ep_payqr_${storeId}`;
  const [idx, setIdx] = useState(() => {
    try {
      const i = qrs.findIndex((q) => q.url === localStorage.getItem(key));
      return i < 0 ? 0 : i;
    } catch {
      return 0;
    }
  });
  const cur = qrs[Math.min(idx, qrs.length - 1)];
  const pick = (i: number) => {
    setIdx(i);
    try {
      localStorage.setItem(key, qrs[i].url);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {qrs.length > 1 && (
        <div className="flex max-w-full gap-1.5 overflow-x-auto px-1 pb-0.5">
          {qrs.map((q, i) => (
            <button
              key={q.url}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={q === cur}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-95 ${
                q === cur
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-card hover:border-brand"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage */}
      <img
        key={cur.url}
        src={cur.url}
        alt={cur.label}
        className="max-h-[42dvh] w-full max-w-64 rounded-xl border border-line bg-white object-contain p-2"
      />
      <p className="text-sm text-muted">{caption}</p>
    </div>
  );
}
