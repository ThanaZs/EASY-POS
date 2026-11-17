"use server";

import { redirect } from "next/navigation";
import { getRepositories } from "@/server/container";
import { storeCtx, str } from "@/server/form";
import { audit } from "@/server/audit";
import { requireStoreAccess } from "@/server/session";

export async function voidSaleAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { user } = await requireStoreAccess(locale, storeId, "pos.refund");
  const saleId = str(form, "saleId");
  const repos = await getRepositories();
  const reason = str(form, "reason").slice(0, 200);
  const res = await repos.sales.void(storeId, saleId, user.id, reason);
  if (res.ok) {
    const sale = await repos.sales.get(storeId, saleId);
    await audit(storeId, user, "sale.void", {
      entityType: "sale",
      entityId: saleId,
      entityName: sale?.receiptNo ?? "",
      changes: { totalMinor: [sale?.totalMinor ?? null, null] },
      note: reason,
    });
  }
  redirect(
    `/${locale}/store/${storeId}/sales/${saleId}${res.ok ? "?voided=1" : ""}`,
  );
}
