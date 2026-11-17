"use server";

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
import { getRepositories, getStorage } from "@/server/container";
import { int, optStr, storeCtx, str } from "@/server/form";
import { requireStoreAccess } from "@/server/session";

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
  await requireStoreAccess(locale, String(input.storeId), "products.create");
  return lookupCatalog(toEnglishLayout(String(input.barcode).trim()));
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
    expiresAt: /^\d{4}-\d{2}-\d{2}$/.test(expires)
      ? new Date(`${expires}T00:00:00Z`)
      : null,
  };

  const repos = await getRepositories();
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
  await requireStoreAccess(locale, storeId, "products.delete");
  const oldImage = await (
    await getRepositories()
  ).products.deactivate(storeId, str(form, "productId"));
  if (oldImage) await (await getStorage())?.remove([oldImage]).catch(() => {});
  redirect(`/${locale}/store/${storeId}/inventory`);
}
