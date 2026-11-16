"use server";

import { redirect } from "next/navigation";
import { parseMoney } from "@/core/lib/format";
import type { ProductInput } from "@/core/ports/repositories";
import { getRepositories } from "@/server/container";
import { int, optStr, storeCtx, str } from "@/server/form";
import { requireStoreAccess } from "@/server/session";

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
  try {
    if (productId) await repos.products.update(storeId, productId, input);
    else await repos.products.create(storeId, input, int(form, "initialQty", 0, 1_000_000, 0), user.id);
  } catch (e) {
    if (!(e instanceof Error && e.message === "DUPLICATE_BARCODE")) throw e;
    error = "duplicate";
  }
  redirect(error ? `${back}?error=${error}` : base);
}

export async function deleteProductAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  await requireStoreAccess(locale, storeId, "products.delete");
  await (await getRepositories()).products.deactivate(storeId, str(form, "productId"));
  redirect(`/${locale}/store/${storeId}/inventory`);
}
