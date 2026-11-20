"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { randomCode } from "@/core/lib/code";
import { defaultLocale, isLocale } from "@/i18n/config";
import { parseMoney } from "@/core/lib/format";
import { toEnglishLayout } from "@/core/lib/keyboard";
import type { ProductInput } from "@/core/ports/repositories";
import {
  contributeToCatalog,
  loadCatalogImage,
  lookupCatalog,
  MAX_IMAGE_BYTES,
  sniffImage,
} from "@/server/catalog";
import { audit, diff } from "@/server/audit";
import { getRepositories, getStorage } from "@/server/container";
import { int, optStr, storeCtx, str } from "@/server/form";
import { requireStoreAccess } from "@/server/session";

/** ช่องสินค้าที่ติดตามการแก้ไข */
const PRODUCT_FIELDS = [
  "name",
  "barcode",
  "sku",
  "category",
  "subcategory",
  "unit",
  "priceMinor",
  "costMinor",
  "packUnit",
  "packSize",
  "packPriceMinor",
  "packBarcode",
  "lowStockThreshold",
  "trackStock",
  "expiresAt",
  "note",
] as const satisfies ReadonlyArray<keyof ProductInput>;

type Image = { bytes: Uint8Array; type: string; ext: string };

/**
 * อัปโหลด/ลบรูปสินค้า — รูปที่ถ่ายเองมาก่อน, ไม่มีก็ใช้รูปจากคลังข้อมูล (catalogImage) ถ้ากด "ใช้ข้อมูลนี้"
 * คืน error + รูปที่ใช้ (ไว้เติมคลังกลาง)
 */
async function applyPhoto(
  form: FormData,
  storeId: string,
  productId: string,
): Promise<{ error: string | null; image: Image | null }> {
  const storage = await getStorage();
  if (!storage) return { error: null, image: null };
  const repos = await getRepositories();
  const photo = form.get("photo");
  let image: Image | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_IMAGE_BYTES)
      return { error: "photoTooBig", image: null };
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return { error: "photoInvalid", image: null };
    image = { bytes, ...kind };
  } else if (str(form, "catalogImage")) {
    image = await loadCatalogImage(str(form, "catalogImage")); // โหลดไม่ได้ = ข้ามรูปไป ไม่ถือว่า error
  } else if (form.get("removePhoto") === "1") {
    const old = await repos.products.setImage(storeId, productId, null);
    if (old) await storage.remove([old]).catch(() => {});
    return { error: null, image: null };
  }
  if (!image) return { error: null, image: null };
  // ชื่อไฟล์สุ่มใหม่ทุกครั้ง → เบราว์เซอร์/CDN ไม่ค้างรูปเก่า
  const path = `stores/${storeId}/products/${productId}-${randomCode(8).toLowerCase()}.${image.ext}`;
  try {
    await storage.put(path, image.bytes, image.type);
  } catch (e) {
    console.error("photo upload failed", e);
    return { error: "photoFailed", image: null };
  }
  const old = await repos.products.setImage(storeId, productId, path);
  if (old) await storage.remove([old]).catch(() => {});
  return { error: null, image };
}

/** หน้าเพิ่มสินค้า: ยิง/พิมพ์บาร์โค้ด → หาข้อมูลจากคลังกลาง/แหล่งภายนอก */
export async function lookupBarcodeAction(input: {
  locale: string;
  storeId: string;
  barcode: string;
}) {
  const locale = isLocale(input.locale) ? input.locale : defaultLocale;
  const storeId = String(input.storeId);
  await requireStoreAccess(locale, storeId, "products.create");
  const code = toEnglishLayout(String(input.barcode).trim());
  // มีสินค้าบาร์โค้ดนี้ในร้านแล้ว → ให้ไปแก้ไขตัวเดิมแทนการสร้างซ้ำ
  const found = (
    await (await getRepositories()).products.list(storeId, { search: code })
  ).find((p) => p.barcode === code || p.packBarcode === code);
  if (found)
    return {
      existing: {
        id: found.id,
        name: found.name,
        imageUrl: null as string | null,
      },
    };
  const hit = await lookupCatalog(code);
  return hit ? { hit } : null;
}

export async function saveProductAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const productId = str(form, "productId");
  const { store, user } = await requireStoreAccess(
    locale,
    storeId,
    productId ? "products.edit" : "products.create",
  );
  const base = `/${locale}/store/${storeId}/inventory`;
  const back = productId ? `${base}/${productId}` : `${base}/new`;

  const name = str(form, "name").slice(0, 120);
  const price = parseMoney(str(form, "price"), store.currency);
  const cost = parseMoney(str(form, "cost"), store.currency);
  if (!name) redirect(`${back}?error=name`);
  if (price === null || cost === null) redirect(`${back}?error=price`);

  // ขายยกแพ็ก/ลัง (ไม่บังคับ)
  const packOn = form.get("packEnabled") === "on";
  const packSize = packOn ? int(form, "packSize", 0, 100_000, 0) : 0;
  if (packOn && packSize < 2) redirect(`${back}?error=packSize`);
  const packPriceText = str(form, "packPrice");
  const packPriceMinor =
    packOn && packPriceText ? parseMoney(packPriceText, store.currency) : null;
  if (packOn && packPriceText && packPriceMinor === null)
    redirect(`${back}?error=price`);
  const code = (k: string) => {
    const v = optStr(form, k, 60);
    return v ? toEnglishLayout(v) : null; // ยิงตอนคีย์บอร์ดไทย → ตัวเลข
  };

  const expires = str(form, "expiresAt");
  const input: ProductInput = {
    name,
    sku: optStr(form, "sku", 60),
    barcode: code("barcode"),
    category: optStr(form, "category", 60),
    subcategory: optStr(form, "category", 60)
      ? optStr(form, "subcategory", 60)
      : null,
    unit: str(form, "unit").slice(0, 20) || "ชิ้น",
    packUnit: packOn ? str(form, "packUnit").slice(0, 20) || "ลัง" : null,
    packSize: packOn ? packSize : null,
    packPriceMinor,
    packBarcode: packOn ? code("packBarcode") : null,
    priceMinor: price,
    costMinor: cost,
    lowStockThreshold: int(
      form,
      "lowStockThreshold",
      0,
      1_000_000,
      store.lowStockThreshold,
    ),
    trackStock: form.get("trackStock") === "on",
    note: str(form, "note").slice(0, 500),
    expiresAt: /^\d{4}-\d{2}-\d{2}$/.test(expires)
      ? new Date(`${expires}T00:00:00Z`)
      : null,
  };

  const repos = await getRepositories();
  const before = productId
    ? await repos.products.findById(storeId, productId)
    : null;
  let error: string | null = null;
  let savedId = productId;
  try {
    if (productId) await repos.products.update(storeId, productId, input);
    else
      savedId = (
        await repos.products.create(
          storeId,
          input,
          int(form, "initialQty", 0, 1_000_000, 0),
          user.id,
        )
      ).id;
  } catch (e) {
    if (!(e instanceof Error && e.message === "DUPLICATE_BARCODE")) throw e;
    error = "duplicate";
  }
  if (error) redirect(`${back}?error=${error}`);
  // รูปพัง ≠ สินค้าพัง: บันทึกสินค้าแล้ว แจ้งให้ถ่ายใหม่ในหน้าแก้ไข
  const { error: photoError, image } = await applyPhoto(form, storeId, savedId);

  // ----- บันทึกการแก้ไข -----
  if (before) {
    const changes = diff(before, input, [...PRODUCT_FIELDS]);
    if (image) changes.photo = [before.imagePath ? "old" : null, "new"];
    else if (form.get("removePhoto") === "1" && before.imagePath)
      changes.photo = ["old", null];
    await audit(storeId, user, "product.update", {
      entityType: "product",
      entityId: savedId,
      entityName: input.name,
      changes,
    });
    // แก้จำนวนคงเหลือในหน้าแก้ไขสินค้า → ปรับสต็อก (บันทึกในประวัติสต็อกด้วย)
    const wanted = form.get("stockQty");
    if (wanted !== null && String(wanted).trim() !== "") {
      const target = int(
        form,
        "stockQty",
        -1_000_000,
        1_000_000,
        before.stockQty,
      );
      const fresh = await repos.products.findById(storeId, savedId);
      if (fresh && target !== fresh.stockQty) {
        const mv = await repos.stock.move({
          storeId,
          productId: savedId,
          type: "adjust",
          qty: target - fresh.stockQty,
          note: "แก้จำนวนในหน้าแก้ไขสินค้า",
          actorId: user.id,
        });
        await audit(storeId, user, "stock.adjust", {
          entityType: "product",
          entityId: savedId,
          entityName: input.name,
          changes: {
            stockQty: [mv?.qtyBefore ?? fresh.stockQty, mv?.qtyAfter ?? target],
          },
        });
      }
    }
  } else {
    await audit(storeId, user, "product.create", {
      entityType: "product",
      entityId: savedId,
      entityName: input.name,
      changes: {
        priceMinor: [null, input.priceMinor],
        stockQty: [null, int(form, "initialQty", 0, 1_000_000, 0)],
      },
    });
  }
  // เติมคลังข้อมูลกลาง (ชื่อ/หมวด/หน่วย/รูป — ไม่มีราคา) ให้ร้านอื่นสแกนแล้วได้ข้อมูลเลย
  if (input.barcode) {
    await contributeToCatalog(
      {
        barcode: input.barcode,
        name: input.name,
        category: input.category,
        subcategory: input.subcategory,
        unit: input.unit,
      },
      image,
    );
  }
  redirect(photoError ? `${base}/${savedId}?error=${photoError}` : base);
}

export async function deleteProductAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { user } = await requireStoreAccess(locale, storeId, "products.delete");
  const repos = await getRepositories();
  const productId = str(form, "productId");
  const product = await repos.products.findById(storeId, productId);
  const oldImage = await repos.products.deactivate(storeId, productId);
  if (product)
    await audit(storeId, user, "product.delete", {
      entityType: "product",
      entityId: productId,
      entityName: product.name,
      note: product.barcode ?? "",
    });
  if (oldImage) await (await getStorage())?.remove([oldImage]).catch(() => {});
  redirect(`/${locale}/store/${storeId}/inventory`);
}

/** ปักหมุด/เลิกปักหมุดสินค้า (ปุ่มในรายการคลังสินค้า) */
export async function togglePinAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { user } = await requireStoreAccess(locale, storeId, "products.edit");
  const productId = str(form, "productId");
  const pinned = str(form, "pinned") === "1";
  const p = await (
    await getRepositories()
  ).products.setPinned(storeId, productId, pinned);
  if (p)
    await audit(storeId, user, pinned ? "product.pin" : "product.unpin", {
      entityType: "product",
      entityId: p.id,
      entityName: p.name,
      changes: { pinned: [!pinned, pinned] },
    });
  // อยู่หน้าเดิม (ตัวกรองเดิม) แค่ให้รายการโหลดใหม่ → ปักหมุดขึ้นบนสุดทันที
  refresh();
}

/**
 * แก้ราคาหลายสินค้าพร้อมกัน (เลือกในคลังสินค้า): ตั้งเป็นราคาเดียว / เพิ่ม / ลด (เป็นบาทหรือ %)
 * คำนวณจากค่าใน DB ปัจจุบัน — ราคาติดลบ = 0; บันทึกประวัติการแก้ไขทีละสินค้า
 */
export async function bulkPriceAction(input: {
  locale: string;
  storeId: string;
  ids: string[];
  field: "price" | "cost";
  mode: "set" | "inc" | "dec";
  unit: "money" | "pct";
  value: string;
}): Promise<{ ok: true; n: number } | { ok: false; error: "invalid" | "none" }> {
  const locale = isLocale(input.locale) ? input.locale : defaultLocale;
  const { storeId } = input;
  const { store, user } = await requireStoreAccess(locale, storeId, "products.edit");
  const ids = [...new Set(input.ids)].slice(0, 2000);
  if (ids.length === 0) return { ok: false, error: "none" };
  const pct = input.mode !== "set" && input.unit === "pct";
  const raw = String(input.value ?? "").replace(/[,\s]/g, "");
  const num = pct ? (/^\d+(\.\d{1,2})?$/.test(raw) ? Number(raw) : null) : parseMoney(raw, store.currency);
  if (num === null || raw === "" || (pct && num > 1000)) return { ok: false, error: "invalid" };
  const key = input.field === "cost" ? "costMinor" : "priceMinor";
  const sign = input.mode === "dec" ? -1 : 1;
  const next = (old: number) =>
    Math.max(
      0,
      input.mode === "set" ? num : pct ? Math.round((old * (1 + (sign * num) / 100)) / 100) * 100 : old + sign * num, // % → ปัดเป็นบาทเต็ม
    );

  const repos = await getRepositories();
  let n = 0;
  for (const id of ids) {
    const p = await repos.products.findById(storeId, id);
    if (!p || !p.isActive) continue;
    const value = next(p[key]);
    if (value === p[key]) continue;
    await repos.products.update(storeId, id, { [key]: value });
    await audit(storeId, user, "product.update", {
      entityType: "product",
      entityId: id,
      entityName: p.name,
      changes: { [key]: [p[key], value] },
    });
    n++;
  }
  refresh();
  return { ok: true, n };
}

/**
 * รวมสินค้า 2 ตัวที่จริงๆ เป็นของเดียวกัน: "สินค้านี้ (source) คือลัง/แพ็กของสินค้าอื่น (target)"
 * เช่น เคยเพิ่ม "น้ำดื่ม (ลัง)" แยกจาก "น้ำดื่ม (ขวด)" → รวมเป็นสินค้าเดียว สต็อกนับเป็นขวด
 * - target: ตั้งขายยกลัง = หน่วย/ราคา/บาร์โค้ดของ source, 1 ลัง = packSize ชิ้น
 * - สต็อกของ source (เป็นลัง) × packSize → บวกเข้า target (บันทึกในประวัติสต็อกทั้งสองตัว)
 * - source: ปิดใช้ (บิลเก่ายังอ้างถึงได้) + ย้ายบาร์โค้ดไปเป็นบาร์โค้ดลังของ target
 */
export async function mergeAsPackAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { user } = await requireStoreAccess(locale, storeId, "products.edit");
  const repos = await getRepositories();
  const sourceId = str(form, "sourceId");
  const targetId = str(form, "targetId");
  const back = `/${locale}/store/${storeId}/inventory/${sourceId}`;
  const packSize = int(form, "packSize", 2, 100_000, 0);
  const [source, target] = await Promise.all([
    repos.products.findById(storeId, sourceId),
    repos.products.findById(storeId, targetId),
  ]);
  if (
    !source?.isActive ||
    !target?.isActive ||
    source.id === target.id ||
    packSize < 2
  )
    redirect(`${back}?error=merge`);

  const packUnit =
    source.unit && source.unit !== target.unit ? source.unit : "ลัง";
  const packBarcode = source.barcode ?? source.packBarcode ?? null;
  const qty = source.stockQty;

  // 1) source: เอาบาร์โค้ดออกก่อน (บาร์โค้ดห้ามซ้ำในร้าน) แล้วปิดใช้
  await repos.products.update(storeId, source.id, { barcode: null, packBarcode: null });
  if (qty !== 0)
    await repos.stock.move({
      storeId,
      productId: source.id,
      type: "adjust",
      qty: -qty,
      note: `รวมเป็นลังของ ${target.name}`,
      actorId: user.id,
    });
  const oldImage = await repos.products.deactivate(storeId, source.id);

  // 2) target: ตั้งขายยกลัง + รับสต็อกจาก source (ลัง × จำนวนต่อลัง)
  const patch = {
    packUnit,
    packSize,
    packPriceMinor: source.priceMinor > 0 ? source.priceMinor : null,
    packBarcode,
  };
  await repos.products.update(storeId, target.id, patch);
  if (qty !== 0)
    await repos.stock.move({
      storeId,
      productId: target.id,
      type: "adjust",
      qty: qty * packSize,
      note: `รวมจาก ${source.name} (${qty} ${packUnit} × ${packSize})`,
      actorId: user.id,
    });

  await audit(storeId, user, "product.update", {
    entityType: "product",
    entityId: target.id,
    entityName: target.name,
    changes: diff(target, patch, ["packUnit", "packSize", "packPriceMinor", "packBarcode"]),
    note: `รวมจาก ${source.name}`,
  });
  await audit(storeId, user, "product.delete", {
    entityType: "product",
    entityId: source.id,
    entityName: source.name,
    note: `รวมเป็นลังของ ${target.name}`,
  });
  if (oldImage) await (await getStorage())?.remove([oldImage]).catch(() => {});
  redirect(`/${locale}/store/${storeId}/inventory/${target.id}?merged=1`);
}
