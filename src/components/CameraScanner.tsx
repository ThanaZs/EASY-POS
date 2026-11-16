"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Detector = { detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>> };

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar", "qr_code"];

/** ใช้ BarcodeDetector ของเบราว์เซอร์ (Android Chrome) ถ้ามี ไม่งั้นใช้ zxing-wasm (iPhone/Firefox) — โหลดเฉพาะตอนเปิดกล้อง */
async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } })
    .BarcodeDetector;
  if (Native) {
    const supported = await Native.getSupportedFormats().catch(() => [] as string[]);
    const formats = FORMATS.filter((f) => supported.includes(f));
    if (formats.includes("ean_13")) return new Native({ formats });
  }
  const { BarcodeDetector, setZXingModuleOverrides } = await import("barcode-detector/ponyfill");
  // โหลด WASM จากเว็บเราเอง (public/wasm) แทน CDN
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/wasm/zxing_reader.wasm" : prefix + path),
  });
  return new BarcodeDetector({ formats: FORMATS as never[] });
}

function feedback() {
  navigator.vibrate?.(60);
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1200;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => ctx.close();
  } catch {
    // บางเบราว์เซอร์ไม่ให้เล่นเสียง — ไม่เป็นไร
  }
}

/**
 * กล้องสแกนบาร์โค้ด (เต็มจอ)
 * - continuous=true: สแกนต่อเนื่อง (หน้าขาย) — รหัสเดิมซ้ำต้องเว้น 1.5 วินาที
 * - continuous=false: เจอแล้วปิดเอง (กรอกช่องบาร์โค้ด)
 */
export function CameraScanner({
  onDetected,
  onClose,
  continuous = false,
  labels,
  status,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
  continuous?: boolean;
  labels: { title: string; close: string; hint: string; noCamera: string };
  status?: string | null; // ข้อความผลล่าสุดจากผู้เรียก เช่น "เพิ่ม น้ำดื่ม แล้ว"
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let last = { code: "", at: 0 };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-media");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = await createDetector();

        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2) {
              const [hit] = await detector.detect(video);
              const code = hit?.rawValue?.trim();
              const now = Date.now();
              if (code && (code !== last.code || now - last.at > 1500)) {
                last = { code, at: now };
                feedback();
                onDetectedRef.current(code);
                if (!continuous) {
                  onCloseRef.current();
                  return;
                }
              }
            }
          } catch {
            // เฟรมนี้อ่านไม่ได้ — ลองเฟรมถัดไป
          }
          timer = setTimeout(tick, 120);
        };
        tick();
      } catch {
        if (!stopped) setError(labels.noCamera);
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [continuous, labels.noCamera]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal aria-label={labels.title}>
      <div className="flex items-center justify-between p-3">
        <span className="font-semibold">{labels.title}</span>
        <button onClick={onClose} className="rounded-full bg-white/15 p-2" aria-label={labels.close}>
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 size-full object-cover" playsInline muted />
        {/* กรอบเล็ง */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-40 w-72 max-w-[80%] rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <p className="rounded-xl bg-black/70 p-4">{error}</p>
          </div>
        )}
      </div>
      <div className="space-y-1 p-4 text-center text-sm">
        {status ? <p className="font-semibold text-emerald-300">{status}</p> : <p className="text-white/70">{labels.hint}</p>}
      </div>
    </div>
  );
}
