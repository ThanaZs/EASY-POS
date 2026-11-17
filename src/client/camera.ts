"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// กล้องอ่านบาร์โค้ด — ใช้ร่วมกันระหว่าง CameraScanner (หน้าทั่วไป) และหน้าสแกนของระบบขาย

type Detector = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

const FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "code_93",
  "itf",
  "codabar",
  "qr_code",
];

/** ใช้ BarcodeDetector ของเบราว์เซอร์ (Android Chrome) ถ้ามี ไม่งั้นใช้ zxing-wasm (iPhone/Firefox) — โหลดเฉพาะตอนเปิดกล้อง */
async function createDetector(): Promise<Detector> {
  const Native = (
    globalThis as {
      BarcodeDetector?: {
        new (o: { formats: string[] }): Detector;
        getSupportedFormats(): Promise<string[]>;
      };
    }
  ).BarcodeDetector;
  if (Native) {
    const supported = await Native.getSupportedFormats().catch(
      () => [] as string[],
    );
    const formats = FORMATS.filter((f) => supported.includes(f));
    if (formats.includes("ean_13")) return new Native({ formats });
  }
  const { BarcodeDetector, setZXingModuleOverrides } =
    await import("barcode-detector/ponyfill");
  // โหลด WASM จากเว็บเราเอง (public/wasm) แทน CDN
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) =>
      path.endsWith(".wasm") ? "/wasm/zxing_reader.wasm" : prefix + path,
  });
  return new BarcodeDetector({ formats: FORMATS as never[] });
}

export function scanFeedback(ok = true) {
  navigator.vibrate?.(ok ? 60 : [40, 60, 40]);
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 1200 : 300;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.2));
    osc.onended = () => ctx.close();
  } catch {
    // บางเบราว์เซอร์ไม่ให้เล่นเสียง — ไม่เป็นไร
  }
}

/**
 * เปิดกล้องหลังใส่ <video> แล้วอ่านบาร์โค้ดวนไปเรื่อยๆ
 * - cooldownMs: หลังอ่านได้ 1 ครั้ง พักการอ่านเท่านี้ (= "ความเร็วการสแกน" กันยิงซ้ำรัวๆ)
 * - continuous=false: อ่านได้ครั้งเดียวแล้วหยุด
 * คืนข้อความ error (เปิดกล้องไม่ได้) หรือ null
 */
export function useBarcodeCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  onDetected: (code: string) => void,
  {
    continuous = true,
    cooldownMs = 1500,
    noCameraText,
  }: { continuous?: boolean; cooldownMs?: number; noCameraText: string },
): string | null {
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(onDetected);
  const cooldown = useRef(cooldownMs);
  useEffect(() => {
    cb.current = onDetected;
    cooldown.current = cooldownMs;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let pauseUntil = 0;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-media");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
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
            if (video.readyState >= 2 && Date.now() >= pauseUntil) {
              const [hit] = await detector.detect(video);
              const code = hit?.rawValue?.trim();
              if (code && !stopped) {
                pauseUntil = Date.now() + cooldown.current;
                cb.current(code);
                if (!continuous) return;
              }
            }
          } catch {
            // เฟรมนี้อ่านไม่ได้ — ลองเฟรมถัดไป
          }
          timer = setTimeout(tick, 100);
        };
        tick();
      } catch {
        if (!stopped) setError(noCameraText);
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoRef, continuous, noCameraText]);

  return error;
}
