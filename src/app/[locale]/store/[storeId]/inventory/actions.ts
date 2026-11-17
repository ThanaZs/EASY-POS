"use server";

import { redirect } from "next/navigation";
import { randomCode } from "@/core/lib/code";
import { parseMoney } from "@/core/lib/format";
import type { ProductInput } from "@/core/ports/repositories";
import { getRepositories, getStorage } from "@/server/container";
import { int, optStr, storeCtx, str } from "@/server/form";
import { requireStoreAccess } from "@/server/session";

const MAX_PHOTO_BYTES = 300 * 1024; // เผื่อจากที่ฝั่งเว็บย่อไว้ไม่เกิน 150KB

/** ตรวจว่าเป็นรูปจริง (ดูหัวไฟล์ ไม่เชื่อนามสกุล/ชนิดที่ส่งมา) */
function sniffImage(b: Uint8Array): { type: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}

/** อัปโหลด/ลบรูปสินค้า — คืนรหัส error หรือ null */
async function applyPhoto(form: FormData, storeId: string, productId: string): Promise<string | null> {
  const storage = await getStorage();
  if (!storage) return null;
  const repos = await getRepositories();
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) return "photoTooBig";
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return "photoInvalid";
    // ชื่อไฟล์สุ่มใหม่ทุกครั้ง → เบราว์เซอร์/CDN ไม่ค้างรูปเก่า
    const path = `stores/${storeId}/products/${productId}-${randomCode(8).toLowerCase()}.${kind.ext}`;
    try {
      await storage.put(path, bytes, kind.type);
    } catch (e) {
      console.error("photo upload failed", e);
      return "photoFailed";
    }
    const old = await repos.products.setImage(storeId, productId, path);
    if (old) await storage.remove([old]).catch(() => {});
  } else if (form.get("removePhoto") === "1") {
    const old = await repos.products.setImage(storeId, productId, null);
    if (old) await storage.remove([old]).catch(() => {});
  }
  return null;
}

export async function saveProductAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const productId = str(form, "productId");
  const { store, user } = await requireStoreAccess(locale, storeId, productId ? "products.edit" : "products.create");
  const base = `/${locale}/store/${storeId}/inventory`;
  const back = productId ? `${base}/${productId}` : `${base}/new`;

  const name = str(form, "name").slice(0, 120);
  const price = parseMoney(str(form, "price"), store.currency);
  const cost = parseMoney(str(form, "cost"), store.currency);
  if (!name) redirect(`${back}?error=name`);
  if (price === null || cost === null) redirect(`${back}?error=price`);

  const expires = str(form, "expiresAt");
  const input: ProductInput = {
    name,
    sku: optStr(form, "sku", 60),
    barcode: optStr(form, "barcode", 60),
    category: optStr(form, "category", 60),
    unit: str(form, "unit").slice(0, 20) || "pcs",
    priceMinor: price,
    costMinor: cost,
    lowStockThreshold: int(form, "lowStockThreshold", 0, 1_000_000, store.lowStockThreshold),
    trackStock: form.get("trackStock") === "on",
    expiresAt: /^\d{4}-\d{2}-\d{2}$/.test(expires) ? new Date(`${expires}T00:00:00Z`) : null,
  };

  const repos = await getRepositories();
  let error: string | null = null;
  let savedId = productId;
  try {
    if (productId) await repos.products.update(storeId, productId, input);
    else savedId = (await repos.products.create(storeId, input, int(form, "initialQty", 0, 1_000_000, 0), user.id)).id;
  } catch (e) {
    if (!(e instanceof Error && e.message === "DUPLICATE_BARCODE")) throw e;
    error = "duplicate";
  }
  if (error) redirect(`${back}?error=${error}`);
  // รูปพัง ≠ สินค้าพัง: บันทึกสินค้าแล้ว แจ้งให้ถ่ายใหม่ในหน้าแก้ไข
  const photoError = await applyPhoto(form, storeId, savedId);
  redirect(photoError ? `${base}/${savedId}?error=${photoError}` : base);
}

export async function deleteProductAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  await requireStoreAccess(locale, storeId, "products.delete");
  const oldImage = await (await getRepositories()).products.deactivate(storeId, str(form, "productId"));
  if (oldImage) await (await getStorage())?.remove([oldImage]).catch(() => {});
  redirect(`/${locale}/store/${storeId}/inventory`);
}
