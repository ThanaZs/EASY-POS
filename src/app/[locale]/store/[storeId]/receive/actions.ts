"use server";

import { redirect } from "next/navigation";
import { can } from "@/core/domain/permissions";
import { getRepositories } from "@/server/container";
import { int, storeCtx, str } from "@/server/form";
import { requireStoreAccess } from "@/server/session";

/**
 * รับเข้า (+), เบิกออก (-), ปรับยอด (ตั้งเป็นจำนวนที่นับได้)
 * unit=pack → จำนวน × ชิ้นต่อลัง (สต็อกเก็บเป็นชิ้นเสมอ)
 */
export async function stockMoveAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { user, member } = await requireStoreAccess(locale, storeId);
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
  else if (mode === "adjust" && can(member, "products.edit")) delta = qty - p.stockQty;
  else redirect(back);

  if (delta !== 0 || mode === "adjust") {
    await repos.stock.move({ storeId, productId, type: mode as "in" | "out" | "adjust", qty: delta, note: fullNote, actorId: user.id });
  }
  redirect(`${back}?saved=1&mode=${mode}&unit=${byPack ? "pack" : "base"}`);
}
