"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleHelp, PenLine, TriangleAlert } from "lucide-react";

/**
 * หน้าต่างถาม/แจ้งแบบของแอป (แทน window.confirm / prompt / alert ของเบราว์เซอร์)
 * วาง <DialogHost /> ไว้ครั้งเดียว (ใน shell) แล้วเรียก askConfirm / askText / showAlert ที่ไหนก็ได้
 * ข้อความบรรทัดแรก = หัวข้อ, บรรทัดถัดไป = รายละเอียด
 */
type Kind = "confirm" | "text" | "alert";
type Req = {
  kind: Kind;
  text: string;
  ok?: string;
  danger?: boolean;
  value?: string;
  resolve: (v: unknown) => void;
};
type Opts = { ok?: string; danger?: boolean };

let open: ((r: Req) => void) | null = null;
const queue: Req[] = [];
function push(r: Omit<Req, "resolve">) {
  return new Promise<unknown>((resolve) => {
    const req = { ...r, resolve };
    if (open) open(req);
    else queue.push(req);
  });
}

/** ถามยืนยัน → true = ตกลง */
export function askConfirm(text: string, o: Opts = {}) {
  return push({ kind: "confirm", text, ...o }) as Promise<boolean>;
}
/** ถามให้พิมพ์ → ข้อความ (ตัดช่องว่างแล้ว) หรือ null = ยกเลิก/ว่าง */
export function askText(text: string, value = "", o: Opts = {}) {
  return push({ kind: "text", text, value, ...o }) as Promise<string | null>;
}
/** แจ้งเตือน (มีปุ่มตกลงปุ่มเดียว) */
export function showAlert(text: string) {
  return push({ kind: "alert", text }) as Promise<void>;
}

export function DialogHost({ t }: { t: { ok: string; cancel: string } }) {
  const [req, setReq] = useState<Req | null>(null);
  const [value, setValue] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const cur = useRef<Req | null>(null);
  const show = (r: Req | null) => {
    cur.current = r;
    if (r) setValue(r.value ?? "");
    setReq(r);
  };

  useEffect(() => {
    open = (r) => {
      if (cur.current) queue.push(r);
      else show(r);
    };
    const first = queue.shift();
    if (first) open(first);
    return () => {
      open = null;
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    if (!dialog.current?.open) dialog.current?.showModal();
    if (req.kind === "text")
      requestAnimationFrame(() => input.current?.select());
  }, [req]);

  function done(ok: boolean) {
    if (!req) return;
    const v = value.trim();
    req.resolve(
      req.kind === "text"
        ? ok && v
          ? v
          : null
        : req.kind === "confirm"
          ? ok
          : undefined,
    );
    dialog.current?.close();
    show(queue.shift() ?? null);
  }

  const [title, ...rest] = (req?.text ?? "").split("\n");
  const detail = rest.join("\n").trim();
  const Icon =
    req?.kind === "text"
      ? PenLine
      : req?.kind === "alert"
        ? CircleAlert
        : req?.danger
          ? TriangleAlert
          : CircleHelp;
  const tone = req?.danger
    ? "bg-rose-100 text-rose-600 dark:bg-rose-950"
    : req?.kind === "alert"
      ? "bg-amber-100 text-amber-600 dark:bg-amber-950"
      : "bg-brand-soft text-brand-ink";

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        done(false);
      }}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      {req && (
        <form
          method="dialog"
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            done(true);
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full ${tone}`}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2 className="text-lg font-bold leading-snug">{title}</h2>
              {detail && (
                <p className="mt-0.5 whitespace-pre-line text-sm text-muted">
                  {detail}
                </p>
              )}
            </div>
          </div>
          {req.kind === "text" && (
            <input
              ref={input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={60}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-brand"
            />
          )}
          <div
            className={`grid gap-2 ${req.kind === "alert" ? "" : "grid-cols-2"}`}
          >
            {req.kind !== "alert" && (
              <button
                type="button"
                onClick={() => done(false)}
                className="rounded-xl border border-line px-4 py-2.5 font-medium"
              >
                {t.cancel}
              </button>
            )}
            <button
              type="submit"
              autoFocus={req.kind !== "text"}
              disabled={req.kind === "text" && !value.trim()}
              className={`rounded-xl px-4 py-2.5 font-semibold text-white disabled:opacity-50 ${
                req.danger ? "bg-rose-600" : "bg-brand"
              }`}
            >
              {req.ok ?? t.ok}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

/**
 * ใช้ใน onSubmit ของฟอร์ม: หยุดส่งไว้ก่อน → ถาม (async) → ตอบตกลงค่อยส่งจริง
 * ask คืน true = ส่งต่อ (เตรียมค่าในฟอร์มก่อนคืน true ได้ เช่นใส่ชื่อที่พิมพ์)
 */
export function confirmSubmit(
  e: React.FormEvent<HTMLFormElement>,
  ask: () => Promise<boolean>,
) {
  const f = e.currentTarget;
  if (f.dataset.asked === "1") {
    delete f.dataset.asked;
    return;
  }
  e.preventDefault();
  const by = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
  void ask().then((ok) => {
    if (!ok || !f.isConnected) return;
    f.dataset.asked = "1";
    f.requestSubmit(by ?? undefined);
  });
}
