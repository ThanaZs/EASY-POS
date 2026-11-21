"use server";

import { redirect } from "next/navigation";
import { randomCode } from "@/core/lib/code";
import { MAX_IMAGE_BYTES, sniffImage } from "@/server/catalog";
import { getRepositories, getStorage } from "@/server/container";
import { int, storeCtx, str } from "@/server/form";
import { audit, diff } from "@/server/audit";
import { requireStoreAccess } from "@/server/session";

const validTimeZone = (tz: string, fallback: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return fallback;
  }
};

export async function saveSettingsAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { store, user } = await requireStoreAccess(
    locale,
    storeId,
    "store.settings",
  );
  // "7" หรือ "7.5" (%) → basis point (700, 750), จำกัด 0–30%
  const pct = Number.parseFloat(str(form, "taxRate").replace(",", "."));
  const taxRateBp = Number.isFinite(pct)
    ? Math.round(Math.min(30, Math.max(0, pct)) * 100)
    : store.taxRateBp;

  const patch = {
    name: str(form, "name").slice(0, 80) || store.name,
    timeZone: validTimeZone(str(form, "timeZone"), store.timeZone),
    taxRateBp,
    taxIncluded: form.get("taxIncluded") === "on",
    lowStockThreshold: int(
      form,
      "lowStockThreshold",
      0,
      1_000_000,
      store.lowStockThreshold,
    ),
    receiptFooter: str(form, "receiptFooter").slice(0, 300),
    allowNegativeStock: form.get("allowNegativeStock") === "on",
  };
  await (await getRepositories()).stores.updateSettings(storeId, patch);
  await audit(storeId, user, "settings.update", {
    entityType: "store",
    entityId: storeId,
    entityName: patch.name,
    changes: diff(store, patch, [
      "name",
      "timeZone",
      "taxRateBp",
      "taxIncluded",
      "lowStockThreshold",
      "receiptFooter",
      "allowNegativeStock",
    ]),
  });
  redirect(`/${locale}/store/${storeId}/settings?saved=1`);
}

/**
 * รูป QR รับเงิน (พร้อมเพย์จากแอปธนาคาร) — เบราว์เซอร์ย่อขนาดให้ก่อนส่ง (ดู PayQrField)
 * remove=1 = ลบรูป; ชื่อไฟล์สุ่มใหม่ทุกครั้ง กันเบราว์เซอร์ค้างรูปเก่า
 */
export async function savePayQrAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { user, store } = await requireStoreAccess(locale, storeId, "store.settings");
  const back = `/${locale}/store/${storeId}/settings`;
  const storage = await getStorage();
  if (!storage) redirect(`${back}?qr=failed`);
  const repos = await getRepositories();
  let path: string | null = null;
  if (form.get("remove") !== "1") {
    const file = form.get("qr");
    if (!(file instanceof File) || file.size === 0) redirect(back);
    if (file.size > MAX_IMAGE_BYTES) redirect(`${back}?qr=big`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) redirect(`${back}?qr=invalid`);
    path = `stores/${storeId}/pay-qr-${randomCode(8).toLowerCase()}.${kind.ext}`;
    try {
      await storage.put(path, bytes, kind.type);
    } catch (e) {
      console.error("pay qr upload failed", e);
      redirect(`${back}?qr=failed`);
    }
  }
  const old = await repos.stores.setPayQr(storeId, path);
  if (old) await storage.remove([old]).catch(() => {});
  await audit(storeId, user, "settings.update", {
    entityType: "store",
    entityId: storeId,
    entityName: store.name,
    note: path ? "ตั้งรูป QR รับเงิน" : "ลบรูป QR รับเงิน",
  });
  redirect(`${back}?qr=${path ? "saved" : "removed"}#pay-qr`);
}
