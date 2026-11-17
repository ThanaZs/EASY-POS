"use server";

import { redirect } from "next/navigation";
import { getRepositories } from "@/server/container";
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
