"use server";

import type { ImportResult, ImportRow } from "@/core/domain/types";
import { parseMoney } from "@/core/lib/format";
import { toEnglishLayout } from "@/core/lib/keyboard";
import { isLocale } from "@/i18n/config";
import { getRepositories } from "@/server/container";
import { audit } from "@/server/audit";
import { requireStoreAccess } from "@/server/session";

/** ข้อมูลดิบจากไฟล์ (ข้อความทุกช่อง) — server ตรวจ/แปลงเองทั้งหมด ไม่เชื่อค่าจาก client */
export type RawImportRow = {
  barcode?: string;
  name?: string;
  price?: string;
  cost?: string;
  stock?: string;
  category?: string;
  subcategory?: string;
};

const EMPTY = new Set([
  "",
  "nan",
  "none",
  "null",
  "-",
  "n/a",
  "#n/a",
  "undefined",
]);
const clean = (v: unknown, max: number) => {
  const s = String(v ?? "").trim();
  return EMPTY.has(s.toLowerCase()) ? null : s.slice(0, max);
};

/** บาร์โค้ดจาก Excel อาจมาเป็นตัวเลข: "8859159901186.0", "8.859159901186E12" → "8859159901186" */
function cleanBarcode(v: unknown): string | null {
  let s = clean(v, 64);
  if (!s) return null;
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
  else if (/^\d(\.\d+)?e\+?\d+$/i.test(s))
    s = BigInt(Math.round(Number(s))).toString();
  return toEnglishLayout(s);
}

function cleanMoney(v: unknown, currency: string): number {
  const s = clean(v, 32);
  if (!s) return 0;
  const n = Number(s.replace(/[,\s฿$]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return parseMoney(n.toFixed(2), currency) ?? 0;
}

function cleanQty(v: unknown): number | null {
  const s = clean(v, 32);
  if (!s) return null;
  const n = Math.round(Number(s.replace(/[,\s]/g, "")));
  return Number.isFinite(n)
    ? Math.max(-1_000_000, Math.min(1_000_000, n))
    : null;
}

/** นำเข้าทีละก้อน (client แบ่งส่ง ≤ 300 แถว) */
export async function importProductsAction(input: {
  locale: string;
  storeId: string;
  rows: RawImportRow[];
  updateStock: boolean;
}): Promise<ImportResult & { ok: true }> {
  const locale = isLocale(input.locale) ? input.locale : "th";
  const { store, user } = await requireStoreAccess(
    locale,
    input.storeId,
    "products.create",
  );
  const rows: ImportRow[] = (Array.isArray(input.rows) ? input.rows : [])
    .slice(0, 300)
    .map((r) => {
      const category = clean(r.category, 60);
      return {
        barcode: cleanBarcode(r.barcode),
        name: clean(r.name, 120) ?? "",
        priceMinor: cleanMoney(r.price, store.currency),
        costMinor: cleanMoney(r.cost, store.currency),
        stockQty: cleanQty(r.stock),
        category,
        subcategory: category ? clean(r.subcategory, 60) : null,
      };
    });
  const repos = await getRepositories();
  const res = await repos.products.importRows(store.id, rows, user.id, {
    updateStock: !!input.updateStock,
  });
  // เติมคลังข้อมูลกลาง (ชื่อ/หมวด — ไม่มีราคา/สต็อก) — พลาดได้ ไม่กระทบการนำเข้า
  await repos.catalog
    .contribute(
      rows
        .filter((r) => r.barcode && r.name)
        .map((r) => ({
          barcode: r.barcode!,
          name: r.name,
          category: r.category,
          subcategory: r.subcategory,
          unit: "ชิ้น",
        })),
    )
    .catch((e) => console.error("catalog contribute failed", e));
  await audit(store.id, user, "product.import", {
    entityType: "product",
    note: `+${res.created} / ~${res.updated} / skip ${res.skipped}${input.updateStock ? " (stock)" : ""}`,
  });
  return { ok: true, ...res };
}
