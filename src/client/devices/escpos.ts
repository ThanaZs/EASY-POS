"use client";

// ===== สร้างคำสั่ง ESC/POS สำหรับเครื่องพิมพ์สลิป =====
// วาดสลิปลง canvas แล้วส่งเป็นรูปขาวดำ (GS v 0) → ภาษาไทย/ทุกภาษาออกถูก ไม่ต้องพึ่งฟอนต์/โค้ดเพจในเครื่องพิมพ์

export type SlipLine =
  | { kind: "text"; text: string; align?: "left" | "center" | "right"; bold?: boolean; size?: number }
  | { kind: "pair"; left: string; right: string; bold?: boolean; size?: number }
  | { kind: "rule" }
  | { kind: "space"; px?: number };

/** ความกว้างหัวพิมพ์ (จุด): 58mm = 384, 80mm = 576 */
export type PaperWidth = 384 | 576;

const FONT = '"Noto Sans Thai", "Sarabun", "Tahoma", sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      out.push(line);
      line = ch;
    } else line += ch;
  }
  out.push(line);
  return out;
}

/** วาดสลิปลง canvas ขาวดำ */
export function drawSlip(lines: SlipLine[], width: PaperWidth): HTMLCanvasElement {
  const pad = 8;
  const inner = width - pad * 2;
  const base = width === 576 ? 26 : 22;
  const measure = document.createElement("canvas").getContext("2d")!;
  // คำนวณความสูงก่อน
  type Op = { y: number; draw: (ctx: CanvasRenderingContext2D) => void };
  const ops: Op[] = [];
  let y = pad;
  for (const l of lines) {
    if (l.kind === "space") {
      y += l.px ?? base / 2;
      continue;
    }
    if (l.kind === "rule") {
      const yy = y + 6;
      ops.push({
        y: yy,
        draw: (ctx) => {
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(pad, yy);
          ctx.lineTo(width - pad, yy);
          ctx.stroke();
          ctx.setLineDash([]);
        },
      });
      y += 14;
      continue;
    }
    const size = Math.round(base * (l.size ?? 1));
    const font = `${l.bold ? "700" : "400"} ${size}px ${FONT}`;
    measure.font = font;
    const lh = Math.round(size * 1.35);
    if (l.kind === "pair") {
      const rightW = measure.measureText(l.right).width;
      const leftLines = wrap(measure, l.left, inner - rightW - 12);
      leftLines.forEach((txt, i) => {
        const yy = y + lh * (i + 1) - Math.round(size * 0.3);
        ops.push({
          y: yy,
          draw: (ctx) => {
            ctx.font = font;
            ctx.textAlign = "left";
            ctx.fillText(txt, pad, yy);
            if (i === leftLines.length - 1) {
              ctx.textAlign = "right";
              ctx.fillText(l.right, width - pad, yy);
            }
          },
        });
      });
      y += lh * leftLines.length;
      continue;
    }
    for (const txt of wrap(measure, l.text, inner)) {
      const yy = y + lh - Math.round(size * 0.3);
      const align = l.align ?? "left";
      const x = align === "center" ? width / 2 : align === "right" ? width - pad : pad;
      ops.push({
        y: yy,
        draw: (ctx) => {
          ctx.font = font;
          ctx.textAlign = align;
          ctx.fillText(txt, x, yy);
        },
      });
      y += lh;
    }
  }
  const height = Math.ceil(y + pad);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.textBaseline = "alphabetic";
  for (const op of ops) op.draw(ctx);
  return canvas;
}

/** canvas → คำสั่ง ESC/POS (เริ่มเครื่อง, รูปแบบ raster, ดันกระดาษ, ตัดกระดาษ) */
export function canvasToEscPos(canvas: HTMLCanvasElement): Uint8Array<ArrayBuffer> {
  const { width, height } = canvas;
  const img = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  const bytesPerRow = Math.ceil(width / 8);
  const bitmap = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
      if (lum < 160) bitmap[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const chunks: number[] = [0x1b, 0x40]; // ESC @ เริ่มเครื่อง
  // ส่งเป็นแถบละ 256 แถว (เครื่องบางรุ่นรับรูปสูงมากไม่ได้)
  for (let y0 = 0; y0 < height; y0 += 256) {
    const h = Math.min(256, height - y0);
    chunks.push(0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, h & 0xff, h >> 8);
    for (const b of bitmap.subarray(y0 * bytesPerRow, (y0 + h) * bytesPerRow)) chunks.push(b);
  }
  chunks.push(0x1b, 0x64, 0x04); // ดันกระดาษ 4 บรรทัด
  chunks.push(0x1d, 0x56, 0x42, 0x00); // ตัดกระดาษ (เครื่องที่ไม่มีมีดจะข้ามคำสั่งนี้)
  return new Uint8Array(chunks);
}
