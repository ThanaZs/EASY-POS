"use server";

import { redirect } from "next/navigation";
import { can } from "@/core/domain/permissions";
import { getRepositories } from "@/server/container";
import { int, storeCtx, str } from "@/server/form";
import { requireStoreAccess } from "@/server/session";

/** รับเข้า (+), เบิกออก (-), ปรับยอด (ตั้งเป็นจำนวนที่นับได้) */
export async function stockMoveAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { user, member } = await requireStoreAccess(locale, storeId);
  const back = `/${locale}/store/${storeId}/receive`;
  const mode = str(form, "mode");
  const productId = str(form, "productId");
  const qty = int(form, "qty", 0, 1_000_000, 0);
  const note = str(form, "note").slice(0, 200);
  const repos = await getRepositories();

  let delta: number;
  if (mode === "in" && can(member, "stock.receive")) delta = qty;
  else if (mode === "out" && can(member, "stock.issue")) delta = -qty;
  else if (mode === "adjust" && can(member, "products.edit")) {
    const p = await repos.products.findById(storeId, productId);
    if (!p) redirect(back);
    delta = qty - p.stockQty;
  } else redirect(back);

  if (delta !== 0 || mode === "adjust") {
    await repos.stock.move({ storeId, productId, type: mode as "in" | "out" | "adjust", qty: delta, note, actorId: user.id });
  }
  redirect(`${back}?saved=1&mode=${mode}`);
}
