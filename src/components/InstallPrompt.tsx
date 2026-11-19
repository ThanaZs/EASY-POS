"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { detectPlatform, isStandalone, startPwaListener, useInstallPrompt, type Platform } from "@/client/pwa";
import type { Dictionary } from "@/i18n/dictionary";

const SEEN_KEY = "ep_install_seen";
const PLATFORMS: Platform[] = ["ios", "android", "samsung", "desktop"];

/** เริ่มฟัง beforeinstallprompt ตั้งแต่โหลดหน้า (ใส่ใน root layout) */
export function PwaListener() {
  useEffect(() => startPwaListener(), []);
  return null;
}

/**
 * ป๊อปอัพแนะนำติดตั้งแอป — แสดงเมื่อ: ล็อกอินเสร็จ (?welcome=1) หรือเข้าเว็บครั้งแรกในเครื่องนี้
 * ไม่แสดงถ้าเปิดจากแอปที่ติดตั้งแล้ว
 */
export function InstallPrompt({ t }: { t: Dictionary["install"] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const params = useSearchParams();
  const { state, install } = useInstallPrompt();
  const [platform, setPlatform] = useState<Platform>("android");
  const [tab, setTab] = useState<Platform>("android");

  useEffect(() => {
    if (isStandalone()) return;
    const welcome = params.get("welcome") === "1";
    let firstVisit = false;
    try {
      firstVisit = !localStorage.getItem(SEEN_KEY);
    } catch {
      // ignore
    }
    if (!welcome && !firstVisit) return;
    const p = detectPlatform();
    /* eslint-disable react-hooks/set-state-in-effect -- รู้อุปกรณ์ได้เฉพาะใน browser */
    setPlatform(p);
    setTab(p);
    /* eslint-enable react-hooks/set-state-in-effect */
    dialog.current?.showModal();
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore
    }
    // เอา ?welcome=1 ออก (รีเฟรชแล้วไม่เด้งซ้ำ) — แก้แค่ URL ไม่โหลดหน้าจาก server ซ้ำ (เดิม router.replace ทำให้หลังล็อกอินโหลด 2 รอบ)
    if (welcome) window.history.replaceState(null, "", pathname);
  }, [params, pathname]);

  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอนแอปจาก route ของเราเอง */}
          <img src="/icons/icon-192.png" alt="" className="size-14 rounded-2xl shadow" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{t.title}</h2>
            <p className="text-sm text-muted">{t.subtitle}</p>
          </div>
          <button onClick={close} aria-label={t.later} className="rounded-full p-1 hover:bg-surface">
            <X className="size-5" />
          </button>
        </div>

        {state === "installed" ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-center font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            {t.installed}
          </p>
        ) : (
          state === "ready" && (
            <button
              onClick={() => void install().then((ok) => ok && close())}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-lg font-semibold text-white"
            >
              <Download className="size-5" /> {t.installNow}
            </button>
          )
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold">{t.howTitle}</p>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setTab(p)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  tab === p ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-line"
                }`}
              >
                {t.tabs[p]}
                {p === platform && <span className="ml-1 text-xs">· {t.yourDevice}</span>}
              </button>
            ))}
          </div>
          <ol className="space-y-2 rounded-xl bg-surface p-3">
            {t.steps[tab].map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <button onClick={close} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 font-medium">
          <Smartphone className="size-4" /> {t.later}
        </button>
      </div>
    </dialog>
  );
}
