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

/** ตรวจเลขตรวจสอบ (check digit) ของ EAN-8 / UPC-A / EAN-13 / GTIN-14 — กันอ่านผิดหลัก */
export function validGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length))
    return true; // ไม่ใช่ GTIN (เช่น Code128) → ไม่ตรวจ
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** ความคมของภาพ (variance ของ Laplacian บนภาพเทาขนาดเล็ก) — ยิ่งมากยิ่งชัด */
function sharpness(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): number {
  const { data } = ctx.getImageData(0, 0, w, h);
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    g[i] =
      data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      sum += lap;
      sq += lap * lap;
      n++;
    }
  const mean = sum / n;
  return sq / n - mean * mean;
}

type Caps = MediaTrackCapabilities & {
  torch?: boolean;
  focusMode?: string[];
  pointsOfInterest?: unknown;
};
type Track = MediaStreamTrack & { getCapabilities?: () => Caps };

export type BarcodeCamera = {
  error: string | null;
  /** ไม่มีรหัสที่อ่านผ่านมาสักพัก → แสดงคำแนะนำ (ยังอ่านต่อเรื่อยๆ) */
  stalled: boolean;
  /** supported = กล้องบอกว่ารองรับ; ไม่บอกก็ยังลองเปิดได้ (บางเครื่องไม่รายงาน) → failed = ลองแล้วเปิดไม่ได้ */
  torch: {
    supported: boolean;
    on: boolean;
    failed: boolean;
    toggle: () => void;
  };
  /** แตะจอเพื่อโฟกัส (x, y = 0..1 ของภาพ) */
  focusAt: (x: number, y: number) => void;
  /** กล้องหลังที่ใช้อยู่ (index เริ่ม 0) จากทั้งหมด total ตัว — total ≤ 1 = ไม่ต้องมีปุ่มสลับ */
  camera: { index: number; total: number; label: string };
  /** สลับไปกล้องหลังตัวถัดไป แล้วจำไว้ในเครื่องนี้ (ทุกหน้าที่ใช้กล้อง) */
  switchCamera: () => void;
};

const CAM_KEY = "ep_cam_device";
const MAIN_CAM = /camera2 0,|camera 0,|main/i; // ชื่อกล้องหลักที่พบบ่อยบน Android
const VIDEO = { width: { ideal: 1920 }, height: { ideal: 1080 } };
const hasTorch = (st: MediaStream) => {
  const t = st.getVideoTracks()[0] as Track | undefined;
  return !!(t?.getCapabilities?.() as Caps | undefined)?.torch;
};

/** รายชื่อกล้องหลัง (ตัดกล้องหน้าออก) — ใช้หลังได้รับอนุญาตกล้องแล้ว (ก่อนนั้นชื่อเป็นค่าว่าง) */
async function backCameras(): Promise<MediaDeviceInfo[]> {
  const all = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === "videoinput",
  );
  const backs = all.filter((d) => !/front|user|หน้า|facetime/i.test(d.label));
  return backs.length ? backs : all;
}

/**
 * เปิดกล้องหลัง — มือถือหลายเลนส์ (เช่น Samsung) facingMode "environment" มักได้เลนส์มุมกว้าง/เทเล ที่ไม่มีไฟแฟลช
 * → ถ้ากล้องที่ได้ไม่มีไฟฉาย ลองกล้องหลังตัวอื่นทีละตัว เลือกตัวที่มีไฟ (มักเป็นกล้องหลัก "camera2 0") แล้วจำไว้ในเครื่อง
 */
async function openBackCamera(): Promise<MediaStream> {
  const md = navigator.mediaDevices;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(CAM_KEY);
  } catch {
    // ignore
  }
  if (saved) {
    try {
      return await md.getUserMedia({
        video: { deviceId: { exact: saved }, ...VIDEO },
        audio: false,
      });
    } catch {
      // กล้องเปลี่ยน/ไม่มีแล้ว → หาใหม่
    }
  }
  const first = await md.getUserMedia({
    video: { facingMode: { ideal: "environment" }, ...VIDEO },
    audio: false,
  });
  if (hasTorch(first)) return first;
  try {
    const firstId = first.getVideoTracks()[0]?.getSettings().deviceId;
    const backs = (await md.enumerateDevices())
      .filter(
        (d) =>
          d.kind === "videoinput" &&
          d.deviceId !== firstId &&
          !/front|user|หน้า/i.test(d.label),
      )
      // กล้องหลักของ Samsung/Android มักชื่อ "camera2 0, facing back"
      .sort(
        (a, b) =>
          Number(MAIN_CAM.test(b.label)) - Number(MAIN_CAM.test(a.label)),
      )
      .slice(0, 4);
    if (backs.length) {
      first.getTracks().forEach((t) => t.stop()); // บางเครื่องเปิดกล้องพร้อมกันหลายตัวไม่ได้
      for (const d of backs) {
        try {
          const st = await md.getUserMedia({
            video: { deviceId: { exact: d.deviceId }, ...VIDEO },
            audio: false,
          });
          if (hasTorch(st)) {
            try {
              localStorage.setItem(CAM_KEY, d.deviceId);
            } catch {
              // ignore
            }
            return st;
          }
          st.getTracks().forEach((t) => t.stop());
        } catch {
          // กล้องตัวนี้เปิดไม่ได้ — ลองตัวถัดไป
        }
      }
      return await md.getUserMedia({
        video: { facingMode: { ideal: "environment" }, ...VIDEO },
        audio: false,
      });
    }
  } catch {
    // enumerateDevices ใช้ไม่ได้ — ใช้กล้องแรก
  }
  return first;
}

/**
 * เปิดกล้องหลังใส่ <video> แล้วอ่านบาร์โค้ดวนไปเรื่อยๆ — ทำให้แม่นขึ้นด้วย:
 * 1) ตัดเฉพาะกลางภาพ (บริเวณกรอบเล็ง) แล้วค่อยอ่าน + ทุกๆ 3 เฟรมอ่านทั้งภาพ
 * 2) ข้ามเฟรมที่เบลอ (ความคมต่ำกว่าค่าเฉลี่ยล่าสุดมาก) → อ่านเฉพาะจังหวะที่ภาพชัด
 * 3) ต้องอ่านได้รหัสเดิม 2 เฟรมติดกันก่อนถึงจะรับ + ตรวจเลขตรวจสอบของ EAN/UPC
 * 4) อ่านไม่ผ่านนานเกิน 5 วิ → stalled=true (ให้หน้าจอแนะนำ/ให้พิมพ์เลขเอง) แล้วอ่านต่อ
 * - cooldownMs: หลังรับรหัส 1 ครั้ง พักการอ่านเท่านี้ (= "ความเร็วการสแกน")
 */
export function useBarcodeCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  onDetected: (code: string) => void,
  {
    continuous = true,
    cooldownMs = 1500,
    noCameraText,
    region = { x: 0.1, y: 0.3, w: 0.8, h: 0.4 },
  }: {
    continuous?: boolean;
    cooldownMs?: number;
    noCameraText: string;
    /** บริเวณกรอบเล็งในภาพ (สัดส่วน 0..1) — อ่านตรงนี้ก่อน */
    region?: { x: number; y: number; w: number; h: number };
  },
): BarcodeCamera {
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchFailed, setTorchFailed] = useState(false);
  const [camInfo, setCamInfo] = useState({ index: 0, total: 0, label: "" });
  const [restart, setRestart] = useState(0); // เพิ่มค่า = เปิดกล้องใหม่ (หลังสลับกล้อง)
  const trackRef = useRef<Track | null>(null);
  const cb = useRef(onDetected);
  const cooldown = useRef(cooldownMs);
  const area = useRef(region);
  useEffect(() => {
    cb.current = onDetected;
    cooldown.current = cooldownMs;
    area.current = region;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let pauseUntil = 0;
    let lastAccepted = Date.now();
    let candidate = { code: "", at: 0 };
    let frame = 0;
    let sharpAvg = 0;
    const crop = document.createElement("canvas");
    const cropCtx = crop.getContext("2d", { willReadFrequently: true });
    const probe = document.createElement("canvas");
    const probeCtx = probe.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-media");
        stream = await openBackCamera();
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const track = stream.getVideoTracks()[0] as Track;
        trackRef.current = track;
        backCameras()
          .then((list) => {
            if (stopped) return;
            const id = track.getSettings?.().deviceId;
            const i = Math.max(
              0,
              list.findIndex((d) => d.deviceId === id),
            );
            setCamInfo({
              index: i,
              total: list.length,
              label: list[i]?.label ?? "",
            });
          })
          .catch(() => {});
        const caps = (track.getCapabilities?.() ?? {}) as Caps;
        setTorchSupported(!!caps.torch);
        if (caps.focusMode?.includes("continuous")) {
          await track
            .applyConstraints({
              advanced: [
                { focusMode: "continuous" } as MediaTrackConstraintSet,
              ],
            })
            .catch(() => {});
        }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        // Chrome บางรุ่นรายงานว่ามีไฟฉายหลังภาพเริ่มเล่นแล้วเท่านั้น → ตรวจซ้ำ
        const recheck = () => {
          const c = (track.getCapabilities?.() ?? {}) as Caps;
          if (c.torch && !stopped) setTorchSupported(true);
        };
        recheck();
        setTimeout(recheck, 800);
        const detector = await createDetector();
        lastAccepted = Date.now();

        const tick = async () => {
          if (stopped) return;
          try {
            const now = Date.now();
            if (
              video.readyState >= 2 &&
              now >= pauseUntil &&
              cropCtx &&
              probeCtx
            ) {
              frame++;
              const vw = video.videoWidth;
              const vh = video.videoHeight;
              // บริเวณกรอบเล็ง
              const sx = vw * area.current.x;
              const sy = vh * area.current.y;
              const sw = vw * area.current.w;
              const sh = vh * area.current.h;
              probe.width = 160;
              probe.height = Math.max(40, Math.round((160 * sh) / sw));
              probeCtx.drawImage(
                video,
                sx,
                sy,
                sw,
                sh,
                0,
                0,
                probe.width,
                probe.height,
              );
              const sharp = sharpness(probeCtx, probe.width, probe.height);
              sharpAvg = sharpAvg ? sharpAvg * 0.85 + sharp * 0.15 : sharp;
              const blurry = sharp < sharpAvg * 0.7;
              if (!blurry || frame % 4 === 0) {
                crop.width = Math.min(1280, Math.round(sw));
                crop.height = Math.round((crop.width * sh) / sw);
                cropCtx.drawImage(
                  video,
                  sx,
                  sy,
                  sw,
                  sh,
                  0,
                  0,
                  crop.width,
                  crop.height,
                );
                let hits = await detector.detect(
                  crop as unknown as HTMLVideoElement,
                );
                if (!hits.length && frame % 3 === 0)
                  hits = await detector.detect(video);
                const code = hits
                  .map((h) => h.rawValue?.trim())
                  .find((c) => c && validGtin(c));
                if (code && !stopped) {
                  if (code === candidate.code && now - candidate.at < 1000) {
                    candidate = { code: "", at: 0 };
                    pauseUntil = now + cooldown.current;
                    lastAccepted = now;
                    setStalled(false);
                    cb.current(code);
                    if (!continuous) return;
                  } else candidate = { code, at: now };
                }
              }
              if (now - lastAccepted > 5000) setStalled(true);
            }
          } catch {
            // เฟรมนี้อ่านไม่ได้ — ลองเฟรมถัดไป
          }
          timer = setTimeout(tick, 80);
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
      trackRef.current = null;
    };
  }, [videoRef, continuous, noCameraText, restart]);

  return {
    camera: camInfo,
    switchCamera: () => {
      backCameras()
        .then((list) => {
          if (list.length < 2) return;
          const id = trackRef.current?.getSettings?.().deviceId;
          const i = list.findIndex((d) => d.deviceId === id);
          const next = list[(i + 1) % list.length];
          try {
            localStorage.setItem(CAM_KEY, next.deviceId);
          } catch {
            // ignore
          }
          setTorchOn(false);
          setTorchSupported(false);
          setRestart((n) => n + 1);
        })
        .catch(() => {});
    },
    error,
    stalled,
    torch: {
      supported: torchSupported,
      on: torchOn,
      failed: torchFailed,
      toggle: () => {
        const track = trackRef.current;
        if (!track) return;
        const next = !torchOn;
        track
          .applyConstraints({
            advanced: [{ torch: next } as MediaTrackConstraintSet],
          })
          .then(() => {
            // บางเบราว์เซอร์ไม่ error แต่ก็ไม่เปิดไฟ → ดูค่าจริง
            const s = track.getSettings?.() as MediaTrackSettings & {
              torch?: boolean;
            };
            if (next && s && "torch" in s && !s.torch)
              throw new Error("no-torch");
            if (next && s && !("torch" in s) && !torchSupported)
              throw new Error("no-torch");
            setTorchOn(next);
            setTorchFailed(false);
          })
          .catch(() => {
            setTorchFailed(true);
            setTimeout(() => setTorchFailed(false), 3500);
          });
      },
    },
    focusAt: (x, y) => {
      const track = trackRef.current;
      if (!track) return;
      const caps = (track.getCapabilities?.() ?? {}) as Caps;
      const set: Record<string, unknown> = {};
      if (caps.pointsOfInterest) set.pointsOfInterest = [{ x, y }];
      if (caps.focusMode?.includes("single-shot"))
        set.focusMode = "single-shot";
      else if (caps.focusMode?.includes("continuous"))
        set.focusMode = "continuous";
      if (!Object.keys(set).length) return;
      track
        .applyConstraints({ advanced: [set as MediaTrackConstraintSet] })
        .then(() => {
          // โฟกัสจุดเดียวเสร็จแล้วกลับไปโฟกัสต่อเนื่อง
          if (
            set.focusMode === "single-shot" &&
            caps.focusMode?.includes("continuous")
          )
            setTimeout(
              () =>
                track
                  .applyConstraints({
                    advanced: [
                      { focusMode: "continuous" } as MediaTrackConstraintSet,
                    ],
                  })
                  .catch(() => {}),
              1500,
            );
        })
        .catch(() => {});
    },
  };
}
