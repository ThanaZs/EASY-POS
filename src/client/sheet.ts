"use client";

// อ่านไฟล์ตาราง (Excel .xlsx / .csv) ในเบราว์เซอร์ → แถวของข้อความ
// .xlsx = zip ของไฟล์ XML → แตก zip ด้วย fflate แล้วอ่าน XML ด้วย DOMParser (ไม่ต้องใช้ไลบรารี Excel ตัวใหญ่)

import { strFromU8, unzipSync } from "fflate";

export type Sheet = string[][];

const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+$/, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

function parseXml(files: Record<string, Uint8Array>, path: string): Document | null {
  const f = files[path];
  return f ? new DOMParser().parseFromString(strFromU8(f), "application/xml") : null;
}

/** อ่านแผ่นงานแรกของไฟล์ .xlsx */
export function readXlsx(buf: ArrayBuffer): Sheet {
  const files = unzipSync(new Uint8Array(buf));
  // หาไฟล์ของแผ่นงานแรกจาก workbook + relationships
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = parseXml(files, "xl/workbook.xml");
  const rels = parseXml(files, "xl/_rels/workbook.xml.rels");
  const first = wb?.getElementsByTagName("sheet")[0];
  const rid = first?.getAttribute("r:id") ?? first?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  if (rid && rels) {
    for (const r of Array.from(rels.getElementsByTagName("Relationship"))) {
      if (r.getAttribute("Id") === rid) {
        const target = r.getAttribute("Target") ?? "";
        sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
      }
    }
  }
  // ข้อความที่ใช้ร่วมกัน (shared strings)
  const shared: string[] = [];
  const ss = parseXml(files, "xl/sharedStrings.xml");
  if (ss) {
    for (const si of Array.from(ss.getElementsByTagName("si"))) {
      shared.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
    }
  }
  const doc = parseXml(files, sheetPath);
  if (!doc) throw new Error("no-sheet");
  const rows: Sheet = [];
  for (const row of Array.from(doc.getElementsByTagName("row"))) {
    const out: string[] = [];
    let auto = 0;
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r");
      const idx = ref ? colIndex(ref) : auto;
      auto = idx + 1;
      const type = c.getAttribute("t");
      let v = "";
      if (type === "s") v = shared[Number(c.getElementsByTagName("v")[0]?.textContent ?? -1)] ?? "";
      else if (type === "inlineStr") v = Array.from(c.getElementsByTagName("t")).map((t) => t.textContent ?? "").join("");
      else v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      out[idx] = v;
    }
    rows.push(Array.from(out, (x) => x ?? ""));
  }
  return rows;
}

/** อ่าน CSV (รองรับเครื่องหมายคำพูด, ขึ้นบรรทัดในช่อง, BOM) */
export function readCsv(text: string): Sheet {
  const rows: Sheet = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export async function readSheetFile(file: File): Promise<Sheet> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") return readCsv(await file.text());
  return readXlsx(await file.arrayBuffer());
}
