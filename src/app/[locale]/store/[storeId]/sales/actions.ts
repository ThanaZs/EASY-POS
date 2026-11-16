"use server";

import { redirect } from "next/navigation";
import { getRepositories } from "@/server/container";
import { storeCtx, str } from "@/server/form";
import { requireStoreAccess } from "@/server/session";

export async function voidSaleAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { user } = await requireStoreAccess(locale, storeId, "pos.refund");
  const saleId = str(form, "saleId");
  const res = await (await getRepositories()).sales.void(storeId, saleId, user.id, str(form, "reason").slice(0, 200));
  redirect(`/${locale}/store/${storeId}/sales/${saleId}${res.ok ? "?voided=1" : ""}`);
}
