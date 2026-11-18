"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  RotateCcwSquare,
  RotateCwSquare,
  Undo2,
  X,
  Zap,
  ZapOff,
  ZoomIn,
} from "lucide-react";
import {
  backCameras,
  openBackCamera,
  type Caps,
  type Track,
} from "@/client/camera";
import type { Dictionary } from "@/i18n/dictionary";

export const PHOTO_SIZE = 600; // รูปสินค้าทุกรูป = 600×600
const MAX_BYTES = 150 * 1024;
const SHOT_MAX = 1600; // ภาพที่ถ่ายเก็บไว้แก้ไข (ด้านยาวสุด)
const LENS_KEY = "ep_photo_cam"; // เลนส์ที่เลือกไว้สำหรับถ่ายรูปสินค้า (แยกจากกล้องสแกน)
const VIDEO = { width: { ideal: 1920 }, height: { ideal: 1080 } };

/** canvas → Blob: WebP ก่อน (เล็กสุด), เบราว์เซอร์ที่ทำ WebP ไม่ได้ (Safari) ใช้ JPEG; ลดคุณภาพจนไม่เกิน 150KB */
async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  for (const q of [0.82, 0.7, 0.6, 0.5]) {
    let blob = await toBlob("image/webp", q);
    if (!blob || blob.type !== "image/webp")
      blob = await toBlob("image/jpeg", q);
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  const last = await toBlob("image/jpeg", 0.4);
  if (!last) throw new Error("encode-failed");
  return last;
}

const store = {
  get: () => {
    try {
      return localStorage.getItem(LENS_KEY);
    } catch {
      return null;
    }
  },
  set: (id: string) => {
    try {
      localStorage.setItem(LENS_KEY, id);
    } catch {
      // ignore
    }
  },
};

// ---------- การแก้ไขภาพ ----------
type Edit = {
  rot: number;
  tilt: number;
  fx: 1 | -1;
  fy: 1 | -1;
  zoom: number;
  px: number;
  py: number;
};
const NO_EDIT: Edit = { rot: 0, tilt: 0, fx: 1, fy: 1, zoom: 1, px: 0, py: 0 };
const rad = (d: number) => (d * Math.PI) / 180;

/** ขนาดภาพหลังหมุน 90° และสเกลขั้นต่ำที่ทำให้กรอบสี่เหลี่ยม S ถูกภาพคลุมเต็ม (แม้เอียง) */
function geometry(src: HTMLCanvasElement, e: Edit, S: number) {
  const odd = e.rot % 2 !== 0;
  const w = odd ? src.height : src.width;
  const h = odd ? src.width : src.height;
  const t = Math.abs(rad(e.tilt));
  const need = S * (Math.cos(t) + Math.sin(t)); // ด้านของกรอบเมื่อมองในแกนของภาพ
  const k = (need / Math.min(w, h)) * e.zoom;
  return { w, h, need, k };
}

/** จำกัดการเลื่อนภาพ (px, py = สัดส่วนของกรอบ) ไม่ให้เห็นขอบว่าง */
function clampPan(src: HTMLCanvasElement, e: Edit): Edit {
  const S = 1;
  const { w, h, need, k } = geometry(src, e, S);
  const sx = Math.max(0, (k * w - need) / 2);
  const sy = Math.max(0, (k * h - need) / 2);
  // หมุนเวกเตอร์การเลื่อนเข้าแกนของภาพ แล้วจำกัดทีละแกน แล้วหมุนกลับ
  const a = rad(e.tilt);
  const ix = e.px * Math.cos(a) + e.py * Math.sin(a);
  const iy = -e.px * Math.sin(a) + e.py * Math.cos(a);
  const cx = Math.max(-sx, Math.min(sx, ix));
  const cy = Math.max(-sy, Math.min(sy, iy));
  return {
    ...e,
    px: cx * Math.cos(a) - cy * Math.sin(a),
    py: cx * Math.sin(a) + cy * Math.cos(a),
  };
}

function render(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  e: Edit,
  S: number,
) {
  const { k } = geometry(src, e, S);
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, S, S);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(S / 2 + e.px * S, S / 2 + e.py * S);
  ctx.scale(e.fx, e.fy);
  // กลับภาพแล้ว ทิศหมุนบนจอจะกลับด้าน → ชดเชยให้หมุนตามที่ผู้ใช้เห็น
  ctx.rotate(rad(e.rot * 90 + e.tilt) * e.fx * e.fy);
  ctx.scale(k, k);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  ctx.restore();
}

type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * ถ่ายรูปสินค้าด้วยกล้องในเว็บ:
 * - ถ่าย: เลือกเลนส์, เปิด/ปิดแฟลช, ซูม (นิ้วถ่าง/แถบเลื่อน — ใช้ซูมของกล้องถ้ามี ไม่งั้นซูมดิจิทัล)
 * - แก้ไขหลังถ่าย: ครอป (ลาก/ถ่างนิ้วในกรอบ), หมุน 90°, เอียง, กลับซ้าย-ขวา/บน-ล่าง → 600×600 + บีบอัด
 */
export function PhotoCapture({
  onDone,
  onClose,
  t,
  noCamera,
}: {
  onDone: (blob: Blob) => void;
  onClose: () => void;
  t: Dictionary["photo"];
  noCamera: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<Track | null>(null);
  const [error, setError] = useState(false);
  const [lensId, setLensId] = useState<string | null>(() => store.get());
  const [lenses, setLenses] = useState<MediaDeviceInfo[]>([]);
  const [activeId, setActiveId] = useState("");
  const [torch, setTorch] = useState({ on: false, failed: false });
  const [zoomCaps, setZoomCaps] = useState<{
    min: number;
    max: number;
    step: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [shot, setShot] = useState<HTMLCanvasElement | null>(null);
  const [edit, setEdit] = useState<Edit>(NO_EDIT);
  const [busy, setBusy] = useState(false);

  // ----- เปิดกล้อง (เปิดใหม่เมื่อเปลี่ยนเลนส์) -----
  useEffect(() => {
    if (shot) return; // หน้าแก้ไข: ปิดกล้องไว้ประหยัดแบต
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-media");
        if (lensId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: lensId }, ...VIDEO },
              audio: false,
            });
          } catch {
            stream = null; // เลนส์ที่จำไว้ใช้ไม่ได้แล้ว
          }
        }
        stream ??= await openBackCamera();
        if (stopped) return void stream.getTracks().forEach((x) => x.stop());
        const track = stream.getVideoTracks()[0] as Track;
        trackRef.current = track;
        setActiveId(track.getSettings?.().deviceId || lensId || "");
        setTorch({ on: false, failed: false });
        const caps = (track.getCapabilities?.() ?? {}) as Caps & {
          zoom?: { min: number; max: number; step: number };
        };
        if (caps.zoom && caps.zoom.max > caps.zoom.min) {
          setZoomCaps({
            min: caps.zoom.min,
            max: Math.min(caps.zoom.max, 10),
            step: caps.zoom.step || 0.1,
          });
          setZoom(caps.zoom.min);
        } else {
          setZoomCaps(null);
          setZoom(1);
        }
        if (caps.focusMode?.includes("continuous"))
          await track
            .applyConstraints({
              advanced: [
                { focusMode: "continuous" } as MediaTrackConstraintSet,
              ],
            })
            .catch(() => {});
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        backCameras()
          .then((list) => !stopped && setLenses(list))
          .catch(() => {});
      } catch {
        if (!stopped) setError(true);
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((x) => x.stop());
      trackRef.current = null;
    };
  }, [lensId, shot]);

  const pickLens = (id: string) => {
    store.set(id);
    setLensId(id);
  };

  function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    const next = !torch.on;
    track
      .applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      })
      .then(() => {
        const s = track.getSettings?.() as MediaTrackSettings & {
          torch?: boolean;
        };
        if (next && s && "torch" in s && !s.torch) throw new Error("no-torch");
        if (
          next &&
          !((track.getCapabilities?.() ?? {}) as Caps).torch &&
          !(s && "torch" in s)
        )
          throw new Error("no-torch");
        setTorch({ on: next, failed: false });
      })
      .catch(() => {
        setTorch({ on: false, failed: true });
        setTimeout(() => setTorch((x) => ({ ...x, failed: false })), 3000);
      });
  }

  const zMin = zoomCaps?.min ?? 1;
  const zMax = zoomCaps?.max ?? 4;
  const applyZoom = useCallback(
    (z: number) => {
      const v = Math.max(zMin, Math.min(zMax, z));
      setZoom(v);
      if (zoomCaps)
        trackRef.current
          ?.applyConstraints({
            advanced: [{ zoom: v } as MediaTrackConstraintSet],
          })
          .catch(() => {});
    },
    [zMin, zMax, zoomCaps],
  );

  // ----- ถ่าง/บีบนิ้วบนภาพกล้อง = ซูม -----
  const livePts = useRef(new Map<number, Pt>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const onLiveDown = (e: React.PointerEvent) => {
    livePts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (livePts.current.size === 2) {
      const [a, b] = [...livePts.current.values()];
      pinch.current = { d: dist(a, b), z: zoom };
    }
  };
  const onLiveMove = (e: React.PointerEvent) => {
    if (!livePts.current.has(e.pointerId)) return;
    livePts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (livePts.current.size === 2 && pinch.current) {
      const [a, b] = [...livePts.current.values()];
      applyZoom(pinch.current.z * (dist(a, b) / pinch.current.d));
    }
  };
  const onLiveUp = (e: React.PointerEvent) => {
    livePts.current.delete(e.pointerId);
    if (livePts.current.size < 2) pinch.current = null;
  };

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    // ซูมดิจิทัล = ตัดกลางภาพ; ซูมของกล้อง = ภาพจากกล้องซูมมาแล้ว
    const dz = zoomCaps ? 1 : zoom;
    const sw = v.videoWidth / dz;
    const sh = v.videoHeight / dz;
    const scale = Math.min(1, SHOT_MAX / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    c.getContext("2d")!.drawImage(
      v,
      (v.videoWidth - sw) / 2,
      (v.videoHeight - sh) / 2,
      sw,
      sh,
      0,
      0,
      c.width,
      c.height,
    );
    setEdit(NO_EDIT);
    setShot(c);
  }

  // ----- หน้าแก้ไข: วาดตัวอย่าง -----
  const previewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = previewRef.current;
    if (!shot || !cv) return;
    const S = Math.round(cv.clientWidth * (window.devicePixelRatio || 1));
    if (cv.width !== S) cv.width = cv.height = S;
    render(cv.getContext("2d")!, shot, edit, S);
  }, [shot, edit]);

  const update = (patch: Partial<Edit>) =>
    setEdit((e) => (shot ? clampPan(shot, { ...e, ...patch }) : e));

  // ลาก = เลื่อนตำแหน่งครอป, ถ่างนิ้ว/ล้อเมาส์ = ซูมครอป
  const editPts = useRef(new Map<number, Pt>());
  const editPinch = useRef<{ d: number; z: number } | null>(null);
  const onEditDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    editPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (editPts.current.size === 2) {
      const [a, b] = [...editPts.current.values()];
      editPinch.current = { d: dist(a, b), z: edit.zoom };
    }
  };
  const onEditMove = (e: React.PointerEvent) => {
    const prev = editPts.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    editPts.current.set(e.pointerId, cur);
    const size = previewRef.current?.clientWidth || 1;
    if (editPts.current.size === 2 && editPinch.current) {
      const [a, b] = [...editPts.current.values()];
      update({
        zoom: Math.max(
          1,
          Math.min(5, editPinch.current.z * (dist(a, b) / editPinch.current.d)),
        ),
      });
    } else if (editPts.current.size === 1) {
      setEdit((x) =>
        shot
          ? clampPan(shot, {
              ...x,
              px: x.px + (cur.x - prev.x) / size,
              py: x.py + (cur.y - prev.y) / size,
            })
          : x,
      );
    }
  };
  const onEditUp = (e: React.PointerEvent) => {
    editPts.current.delete(e.pointerId);
    if (editPts.current.size < 2) editPinch.current = null;
  };

  async function confirmShot() {
    if (!shot) return;
    setBusy(true);
    try {
      const out = document.createElement("canvas");
      out.width = out.height = PHOTO_SIZE;
      render(out.getContext("2d")!, shot, edit, PHOTO_SIZE);
      onDone(await encode(out));
    } finally {
      setBusy(false);
    }
  }

  const round =
    "grid size-11 place-items-center rounded-full bg-white/15 active:scale-95 disabled:opacity-40";
  const tool = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    active = false,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] active:scale-95 ${active ? "bg-white/25" : ""}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white select-none"
      role="dialog"
      aria-modal
      aria-label={t.title}
    >
      <div className="flex items-center justify-between p-3">
        <span className="font-semibold">{shot ? t.editTitle : t.title}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/15 p-2"
          aria-label={t.close}
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative grid min-h-0 flex-1 place-items-center overflow-hidden">
        <div className="relative aspect-square w-[min(92vw,58vh)] overflow-hidden rounded-2xl ring-4 ring-white/80">
          {!shot ? (
            <div
              className="absolute inset-0 touch-none"
              onPointerDown={onLiveDown}
              onPointerMove={onLiveMove}
              onPointerUp={onLiveUp}
              onPointerCancel={onLiveUp}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 size-full object-cover"
                style={zoomCaps ? undefined : { transform: `scale(${zoom})` }}
              />
            </div>
          ) : (
            <canvas
              ref={previewRef}
              className="absolute inset-0 size-full cursor-move touch-none"
              onPointerDown={onEditDown}
              onPointerMove={onEditMove}
              onPointerUp={onEditUp}
              onPointerCancel={onEditUp}
              onWheel={(e) =>
                update({
                  zoom: Math.max(
                    1,
                    Math.min(5, edit.zoom * (e.deltaY < 0 ? 1.1 : 0.9)),
                  ),
                })
              }
            />
          )}
          {shot && (
            // เส้นตาราง 3×3 ช่วยจัดภาพให้ตรง
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="border border-white/25" />
              ))}
            </div>
          )}
        </div>
        {error && !shot && (
          <p className="absolute inset-x-6 rounded-xl bg-black/70 p-4 text-center">
            {noCamera}
          </p>
        )}
        {torch.failed && (
          <p className="absolute inset-x-6 top-3 rounded-xl bg-black/80 p-3 text-center text-sm">
            {t.flashNo}
          </p>
        )}
      </div>

      {!shot ? (
        <div className="space-y-3 p-4">
          {/* ซูม */}
          <label className="mx-auto flex max-w-md items-center gap-3 text-sm">
            <ZoomIn className="size-4 shrink-0" />
            <input
              type="range"
              min={zMin}
              max={zMax}
              step={zoomCaps?.step ?? 0.1}
              value={zoom}
              onChange={(e) => applyZoom(Number(e.target.value))}
              className="flex-1 accent-white"
              aria-label={t.zoom}
            />
            <span className="w-12 text-right tabular-nums">
              {zoom.toFixed(1)}×
            </span>
          </label>
          {/* เลือกเลนส์ */}
          {lenses.length > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto">
              {lenses.map((d, i) => (
                <button
                  key={d.deviceId}
                  type="button"
                  title={d.label}
                  onClick={() => pickLens(d.deviceId)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                    d.deviceId === activeId
                      ? "bg-white font-semibold text-black"
                      : "bg-white/15"
                  }`}
                >
                  {t.lens} {i + 1}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-8">
            <button
              type="button"
              onClick={toggleTorch}
              disabled={error}
              className={round}
              aria-label={t.flash}
            >
              {torch.on ? (
                <Zap className="size-5 text-yellow-300" />
              ) : (
                <ZapOff className="size-5" />
              )}
            </button>
            <button
              type="button"
              onClick={capture}
              disabled={error}
              aria-label={t.capture}
              className="grid size-18 place-items-center rounded-full border-4 border-white bg-white/20 disabled:opacity-40"
            >
              <Camera className="size-8" />
            </button>
            <span className="size-11" />
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <p className="text-center text-xs text-white/70">{t.cropHint}</p>
          <div className="flex justify-center gap-1 overflow-x-auto">
            {tool(<RotateCcwSquare className="size-5" />, t.rotateLeft, () =>
              update({ rot: (edit.rot + 3) % 4 }),
            )}
            {tool(<RotateCwSquare className="size-5" />, t.rotateRight, () =>
              update({ rot: (edit.rot + 1) % 4 }),
            )}
            {tool(
              <FlipHorizontal2 className="size-5" />,
              t.flipH,
              () => update({ fx: edit.fx === 1 ? -1 : 1 }),
              edit.fx === -1,
            )}
            {tool(
              <FlipVertical2 className="size-5" />,
              t.flipV,
              () => update({ fy: edit.fy === 1 ? -1 : 1 }),
              edit.fy === -1,
            )}
            {tool(<Undo2 className="size-5" />, t.reset, () =>
              setEdit(NO_EDIT),
            )}
          </div>
          <label className="mx-auto flex max-w-md items-center gap-3 text-sm">
            <span className="w-10 shrink-0">{t.tilt}</span>
            <input
              type="range"
              min={-45}
              max={45}
              step={0.5}
              value={edit.tilt}
              onChange={(e) => update({ tilt: Number(e.target.value) })}
              onDoubleClick={() => update({ tilt: 0 })}
              className="flex-1 accent-white"
            />
            <span className="w-12 text-right tabular-nums">
              {edit.tilt.toFixed(1)}°
            </span>
          </label>
          <label className="mx-auto flex max-w-md items-center gap-3 text-sm">
            <ZoomIn className="size-4 w-10 shrink-0" />
            <input
              type="range"
              min={1}
              max={5}
              step={0.05}
              value={edit.zoom}
              onChange={(e) => update({ zoom: Number(e.target.value) })}
              className="flex-1 accent-white"
              aria-label={t.zoom}
            />
            <span className="w-12 text-right tabular-nums">
              {edit.zoom.toFixed(1)}×
            </span>
          </label>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setShot(null)}
              className="flex items-center gap-2 rounded-full bg-white/15 px-5 py-3 font-medium"
            >
              <RotateCcw className="size-5" /> {t.retake}
            </button>
            <button
              type="button"
              onClick={() => void confirmShot()}
              disabled={busy}
              className="flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-60"
            >
              <Check className="size-5" /> {t.use}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
