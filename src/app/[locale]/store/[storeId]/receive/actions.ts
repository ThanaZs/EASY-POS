"use server";

import { redirect } from "next/navigation";
import { can } from "@/core/domain/permissions";
import type { PurchaseInfo } from "@/core/domain/types";
import { parseMoney, todayIn } from "@/core/lib/format";
import { getRepositories } from "@/server/container";
import { int, storeCtx, str } from "@/server/form";
import { audit } from "@/server/audit";
import { requireStoreAccess } from "@/server/session";

/**
 * รับเข้า (+), เบิกออก (-), ปรับยอด (ตั้งเป็นจำนวนที่นับได้)
 * unit=pack → จำนวน × ชิ้นต่อลัง (สต็อกเก็บเป็นชิ้นเสมอ)
 */
export async function stockMoveAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { user, member, store } = await requireStoreAccess(locale, storeId);
  const back = `/${locale}/store/${storeId}/receive`;
  const mode = str(form, "mode");
  const productId = str(form, "productId");
  const entered = int(form, "qty", 0, 1_000_000, 0);
  const byPack = str(form, "unit") === "pack";
  const note = str(form, "note").slice(0, 200);
  const repos = await getRepositories();
  const p = await repos.products.findById(storeId, productId);
  if (!p) redirect(back);
  if (byPack && !p.packSize) redirect(`${back}?error=noPack&mode=${mode}`);
  const qty = byPack ? entered * p.packSize! : entered;
  const packNote = byPack ? `${entered} ${p.packUnit} × ${p.packSize}` : "";
  const fullNote = [packNote, note].filter(Boolean).join(" · ");

  let delta: number;
  if (mode === "in" && can(member, "stock.receive")) delta = qty;
  else if (mode === "out" && can(member, "stock.issue")) delta = -qty;
  else if (mode === "adjust" && can(member, "products.edit"))
    delta = qty - p.stockQty;
  else redirect(back);

  // วันที่ของรายการ (รับเข้าวันไหน / เบิกออกวันไหน) — เลือกย้อนหลังได้ ไม่เลือก = วันนี้ (เก็บในช่อง purchasedOn ของ movement)
  const dayIn = str(form, "movedOn") || str(form, "purchasedOn");
  const movedOn = /^\d{4}-\d{2}-\d{2}$/.test(dayIn) && dayIn <= todayIn(store.timeZone)
    ? dayIn
    : todayIn(store.timeZone);
  // ข้อมูลการซื้อ (เฉพาะรับเข้า): ราคาซื้อ (ต่อหน่วยที่เลือก หรือ รวมทั้งหมด), ซื้อจาก, ลอต
  const noPurchase: PurchaseInfo = {
    unitCostMinor: null,
    supplier: null,
    lotNo: null,
    purchasedOn: movedOn,
  };
  let purchase: PurchaseInfo = noPurchase;
  let newCost: number | null = null;
  if (mode === "in" && qty > 0) {
    const price = parseMoney(str(form, "buyPrice"), store.currency);
    let unitCostMinor: number | null = null;
    if (price !== null && price > 0) {
      unitCostMinor =
        str(form, "priceMode") === "total"
          ? Math.round(price / qty)
          : byPack
            ? Math.round(price / p.packSize!)
            : price;
    }
    purchase = {
      unitCostMinor,
      supplier: str(form, "supplier").slice(0, 80) || null,
      lotNo: str(form, "lotNo").slice(0, 60) || null,
      purchasedOn: movedOn,
    };
    if (
      unitCostMinor !== null &&
      form.get("updateCost") === "on" &&
      can(member, "products.edit") &&
      unitCostMinor !== p.costMinor
    )
      newCost = unitCostMinor;
  }

  if (delta !== 0 || mode === "adjust") {
    const mv = await repos.stock.move({
      purchase,
      storeId,
      productId,
      type: mode as "in" | "out" | "adjust",
      qty: delta,
      note: fullNote,
      actorId: user.id,
    });
    if (mv)
      await audit(storeId, user, `stock.${mode}`, {
        entityType: "product",
        entityId: productId,
        entityName: p.name,
        changes: { stockQty: [mv.qtyBefore, mv.qtyAfter] },
        note: [
          fullNote,
          purchase?.supplier,
          purchase?.lotNo && `lot ${purchase.lotNo}`,
          purchase?.unitCostMinor != null && `@${purchase.unitCostMinor / 100}`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    // อัปเดตต้นทุนสินค้าเป็นราคาซื้อล่าสุด (ติ๊กไว้ตอนรับเข้า)
    if (mv && newCost !== null) {
      await repos.products.update(storeId, productId, { costMinor: newCost });
      await audit(storeId, user, "product.update", {
        entityType: "product",
        entityId: productId,
        entityName: p.name,
        changes: { costMinor: [p.costMinor, newCost] },
        note: "receive",
      });
    }
  }
  redirect(`${back}?saved=1&mode=${mode}&unit=${byPack ? "pack" : "base"}`);
}
