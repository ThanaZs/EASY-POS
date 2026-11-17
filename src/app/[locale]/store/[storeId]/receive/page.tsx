import { Alert } from "@/components/Alert";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { Select } from "@/components/Select";
import { can } from "@/core/domain/permissions";
import { loadLocale } from "@/i18n/page";
import { getRepositories, getStorage } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../BackLink";
import { MovementList } from "../history/MovementList";
import { stockMoveAction } from "./actions";
import { ProductPicker } from "./ProductPicker";

export default async function ReceivePage({
  params,
  searchParams,
}: PageProps<"/[locale]/store/[storeId]/receive">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store, member } = await requireStoreAccess(
    locale,
    storeId,
    "stock.receive",
  );
  const sp = await searchParams;
  const repos = await getRepositories();
  const [products, recent, storage] = await Promise.all([
    repos.products.list(storeId),
    repos.stock.history(storeId, { limit: 15 }),
    getStorage(),
  ]);
  const tracked = products.filter((p) => p.trackStock);
  const modes = [
    { value: "in", label: t.stock.in, ok: true },
    { value: "out", label: t.stock.outIssue, ok: can(member, "stock.issue") },
    {
      value: "adjust",
      label: t.stock.adjust,
      ok: can(member, "products.edit"),
    },
  ].filter((m) => m.ok);
  const lastMode =
    typeof sp.mode === "string" && modes.some((m) => m.value === sp.mode)
      ? sp.mode
      : "in";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink href={`/${locale}/store/${storeId}`} label={t.store.back} />
      <h1 className="text-xl font-bold">{t.store.modules.receive}</h1>
      {tracked.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card p-8 text-center text-muted">
          {t.stock.noProducts}
        </p>
      ) : (
        <Card>
          <form action={stockMoveAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="storeId" value={storeId} />
            {sp.error === "noPack" && (
              <div className="sm:col-span-2">
                <Alert>{t.stock.noPack}</Alert>
              </div>
            )}
            {sp.saved === "1" && (
              <div className="sm:col-span-2">
                <Alert kind="success">{t.stock.saved}</Alert>
              </div>
            )}
            <fieldset className="flex flex-wrap gap-2 sm:col-span-2">
              {modes.map((m) => (
                <label
                  key={m.value}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand-ink"
                >
                  <input
                    type="radio"
                    name="mode"
                    value={m.value}
                    defaultChecked={m.value === lastMode}
                    className="sr-only"
                  />
                  {m.label}
                </label>
              ))}
            </fieldset>
            <ProductPicker
              t={t.stock}
              devices={t.devices}
              scan={t.scan}
              products={tracked.map((p) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                subcategory: p.subcategory,
                barcode: p.barcode,
                sku: p.sku,
                packBarcode: p.packBarcode,
                packSize: p.packSize,
                packUnit: p.packUnit,
                unit: p.unit,
                stockQty: p.stockQty,
                imageUrl:
                  p.imagePath && storage
                    ? storage.publicUrl(p.imagePath)
                    : null,
                pinned: p.pinned,
              }))}
            />
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <Field
                label={t.stock.qty}
                name="qty"
                type="number"
                min={0}
                required
                inputMode="numeric"
              />
              <Select
                label={t.stock.unit}
                name="unit"
                defaultValue={sp.unit === "pack" ? "pack" : "base"}
                options={[
                  { value: "base", label: t.stock.unitBase },
                  { value: "pack", label: t.stock.unitPack },
                ]}
              />
            </div>
            <Field label={t.stock.note} name="note" maxLength={200} />
            <div className="sm:col-span-2">
              <PrimaryButton type="submit">{t.stock.submit}</PrimaryButton>
            </div>
          </form>
        </Card>
      )}
      <h2 className="font-semibold">{t.stock.recent}</h2>
      <MovementList
        items={recent}
        t={t}
        locale={locale}
        timeZone={store.timeZone}
      />
    </div>
  );
}
