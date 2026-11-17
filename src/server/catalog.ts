import "server-only";
import { randomCode } from "@/core/lib/code";
import type { CatalogItem } from "@/core/ports/repositories";
import { getRepositories, getStorage } from "@/server/container";

// ===== คลังข้อมูลสินค้ากลาง =====
// ลำดับการค้น: คลังของเรา (ร้านต่างๆ เพิ่มไว้) → Open Food Facts → Open Beauty Facts
// รูปจากภายนอกยังไม่คัดลอกตอนค้น — คัดลอกเข้าที่เก็บของเราเมื่อร้านกด "ใช้ข้อมูลนี้" แล้วบันทึกสินค้า

export const MAX_IMAGE_BYTES = 300 * 1024;

/** ตรวจว่าเป็นรูปจริง (ดูหัวไฟล์ ไม่เชื่อนามสกุล/ชนิดที่ส่งมา) */
export function sniffImage(
  b: Uint8Array,
): { type: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { type: "image/jpeg", ext: "jpg" };
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return { type: "image/webp", ext: "webp" };
  return null;
}

export const validBarcode = (code: string) => /^[0-9A-Za-z-]{6,40}$/.test(code);

export type CatalogHit = {
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  unit: string | null;
  imageUrl: string | null; // ไว้แสดงในการ์ด
  imageRef: string | null; // ส่งกลับมาตอนบันทึกสินค้า: "catalog:<path>" หรือ "url:<https://...>"
  source: CatalogItem["source"];
};

const EXTERNAL = [
  { source: "off" as const, api: "https://world.openfoodfacts.org" },
  { source: "obf" as const, api: "https://world.openbeautyfacts.org" },
];
const IMAGE_HOSTS = new Set([
  "images.openfoodfacts.org",
  "images.openbeautyfacts.org",
  "static.openfoodfacts.org",
]);
// แหล่งข้อมูลขอให้ระบุชื่อแอป (ไม่ใส่ข้อมูลผู้ใช้)
const UA = "EASY-POS/1.0 (point-of-sale web app)";

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, ...init?.headers },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchExternal(barcode: string): Promise<CatalogItem | null> {
  for (const src of EXTERNAL) {
    try {
      const res = await fetchWithTimeout(
        `${src.api}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name_th,product_name,product_name_en,generic_name,brands,image_front_url,quantity`,
        4000,
      );
      if (!res.ok) continue;
      const j = (await res.json()) as {
        status?: number;
        product?: Record<string, string | undefined>;
      };
      const p = j.product;
      if (j.status !== 1 || !p) continue;
      const base = (
        p.product_name_th ||
        p.product_name ||
        p.product_name_en ||
        p.generic_name ||
        ""
      ).trim();
      if (!base) continue;
      const brand = p.brands?.split(",")[0]?.trim() || null;
      const qty = p.quantity?.trim();
      let name = base;
      // ใส่ยี่ห้อนำหน้าเฉพาะชื่อยี่ห้อสั้นๆ (บางรายการเป็นชื่อบริษัทยาวๆ)
      if (brand && brand.length <= 20 && !name.toLowerCase().includes(brand.toLowerCase()))
        name = `${brand} ${name}`;
      if (qty && !name.includes(qty)) name = `${name} ${qty}`;
      const img =
        p.image_front_url &&
        IMAGE_HOSTS.has(new URL(p.image_front_url).hostname)
          ? p.image_front_url
          : null;
      return {
        barcode,
        name: name.slice(0, 120),
        brand,
        category: null,
        subcategory: null,
        unit: null,
        imagePath: null,
        imageUrl: img,
        source: src.source,
      };
    } catch {
      // แหล่งนี้ช้า/ล่ม — ลองแหล่งถัดไป
    }
  }
  return null;
}

/** ค้นข้อมูลสินค้าจากบาร์โค้ด (คลังเรา → แหล่งภายนอก แล้วเก็บผลไว้ในคลัง) */
export async function lookupCatalog(
  barcode: string,
): Promise<CatalogHit | null> {
  if (!validBarcode(barcode)) return null;
  const repos = await getRepositories();
  let item = await repos.catalog.get(barcode);
  if (!item) {
    item = await fetchExternal(barcode);
    if (item)
      await repos.catalog
        .saveExternal(item)
        .catch((e) => console.error("catalog save failed", e));
  }
  if (!item) return null;
  const storage = await getStorage();
  const fromPath =
    item.imagePath && storage ? storage.publicUrl(item.imagePath) : null;
  return {
    name: item.name,
    brand: item.brand,
    category: item.category,
    subcategory: item.subcategory,
    unit: item.unit,
    imageUrl: fromPath ?? item.imageUrl,
    imageRef: item.imagePath
      ? `catalog:${item.imagePath}`
      : item.imageUrl
        ? `url:${item.imageUrl}`
        : null,
    source: item.source,
  };
}

/** โหลดรูปจาก imageRef (เฉพาะแหล่งที่อนุญาต) → bytes ที่ตรวจแล้ว */
export async function loadCatalogImage(
  ref: string,
): Promise<{ bytes: Uint8Array; type: string; ext: string } | null> {
  const storage = await getStorage();
  let url: string | null = null;
  if (ref.startsWith("catalog:")) {
    const path = ref.slice("catalog:".length);
    if (storage && /^catalog\/[\w.-]+$/.test(path))
      url = storage.publicUrl(path);
  } else if (ref.startsWith("url:")) {
    const u = ref.slice("url:".length);
    try {
      const parsed = new URL(u);
      if (parsed.protocol === "https:" && IMAGE_HOSTS.has(parsed.hostname))
        url = parsed.toString();
    } catch {
      // URL ไม่ถูกต้อง
    }
  }
  if (!url) return null;
  const tryLoad = async (u: string) => {
    try {
      const res = await fetchWithTimeout(u, 6000);
      if (!res.ok) return null;
      if (Number(res.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) return null;
      const kind = sniffImage(bytes);
      return kind ? { bytes, ...kind } : null;
    } catch {
      return null;
    }
  };
  // รูป Open Food Facts มีหลายขนาด (.400.jpg / .200.jpg) — ใหญ่เกินก็ลองขนาดเล็กลง
  return (await tryLoad(url)) ?? (/\.400\.jpg$/.test(url) ? await tryLoad(url.replace(/\.400\.jpg$/, ".200.jpg")) : null);
}

/** ร้านบันทึกสินค้าที่มีบาร์โค้ด → เพิ่มเข้าคลังกลาง (+ รูป ถ้าคลังยังไม่มี) — พลาดได้ ไม่กระทบการบันทึกสินค้า */
export async function contributeToCatalog(
  item: Pick<
    CatalogItem,
    "barcode" | "name" | "category" | "subcategory" | "unit"
  >,
  image?: { bytes: Uint8Array; type: string; ext: string } | null,
) {
  try {
    if (!validBarcode(item.barcode)) return;
    const repos = await getRepositories();
    await repos.catalog.contribute([item]);
    if (!image) return;
    const existing = await repos.catalog.get(item.barcode);
    if (!existing || existing.imagePath) return;
    const storage = await getStorage();
    if (!storage) return;
    const path = `catalog/${item.barcode.replace(/[^\w-]/g, "")}-${randomCode(6).toLowerCase()}.${image.ext}`;
    await storage.put(path, image.bytes, image.type);
    if (!(await repos.catalog.setImageIfMissing(item.barcode, path)))
      await storage.remove([path]).catch(() => {});
  } catch (e) {
    console.error("catalog contribute failed", e);
  }
}
