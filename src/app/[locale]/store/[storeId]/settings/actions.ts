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

/** จำนวนรูป QR สูงสุดต่อร้าน */
const MAX_QRS = 6;

/**
 * รูป QR รับเงิน (พร้อมเพย์จากแอปธนาคาร) — มีได้หลายอัน (หลายธนาคาร/หลายบัญชี)
 * op=add: ไฟล์ "qr" (เบราว์เซอร์ย่อให้แล้ว ดู PayQrField) + label; op=rename: path + label; op=remove: path
 */
export async function savePayQrAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { user, store } = await requireStoreAccess(locale, storeId, "store.settings");
  const back = `/${locale}/store/${storeId}/settings`;
  const storage = await getStorage();
  if (!storage) redirect(`${back}?qr=failed#pay-qr`);
  const repos = await getRepositories();
  const op = str(form, "op");
  const label = str(form, "label").trim().slice(0, 40);
  const list = [...store.payQrs];
  let note = "";
  if (op === "add") {
    if (list.length >= MAX_QRS) redirect(`${back}?qr=full#pay-qr`);
    const file = form.get("qr");
    if (!(file instanceof File) || file.size === 0) redirect(back);
    if (file.size > MAX_IMAGE_BYTES) redirect(`${back}?qr=big#pay-qr`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) redirect(`${back}?qr=invalid#pay-qr`);
    const path = `stores/${storeId}/pay-qr-${randomCode(8).toLowerCase()}.${kind.ext}`;
    try {
      await storage.put(path, bytes, kind.type);
    } catch (e) {
      console.error("pay qr upload failed", e);
      redirect(`${back}?qr=failed#pay-qr`);
    }
    const name = label || `QR ${list.length + 1}`;
    list.push({ path, label: name });
    note = `เพิ่มรูป QR รับเงิน “${name}”`;
  } else {
    const path = str(form, "path");
    const at = list.findIndex((q) => q.path === path);
    if (at < 0) redirect(back);
    if (op === "rename") {
      if (!label) redirect(back);
      note = `เปลี่ยนชื่อ QR “${list[at].label}” → “${label}”`;
      list[at] = { ...list[at], label };
    } else {
      note = `ลบรูป QR รับเงิน “${list[at].label}”`;
      list.splice(at, 1);
      await storage.remove([path]).catch(() => {});
    }
  }
  await repos.stores.setPayQrs(storeId, list);
  await audit(storeId, user, "settings.update", {
    entityType: "store",
    entityId: storeId,
    entityName: store.name,
    note,
  });
  redirect(`${back}?qr=${op === "add" ? "saved" : op === "rename" ? "renamed" : "removed"}#pay-qr`);
}
