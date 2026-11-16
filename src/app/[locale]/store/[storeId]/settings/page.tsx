import { Alert } from "@/components/Alert";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { Select, timeZoneOptions } from "@/components/Select";
import { loadLocale } from "@/i18n/page";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../BackLink";
import { saveSettingsAction } from "./actions";

export default async function SettingsPage({ params, searchParams }: PageProps<"/[locale]/store/[storeId]/settings">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store } = await requireStoreAccess(locale, storeId, "store.settings");
  const s = t.settings;
  const section = "space-y-4 border-t border-line pt-4 first:border-0 first:pt-0";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <BackLink href={`/${locale}/store/${storeId}`} label={t.store.back} />
      <h1 className="text-xl font-bold">{t.store.modules.settings}</h1>
      <Card>
        <form action={saveSettingsAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="storeId" value={storeId} />
          {(await searchParams).saved === "1" && <Alert kind="success">{s.saved}</Alert>}

          <fieldset className={section}>
            <legend className="mb-2 font-semibold">{s.general}</legend>
            <Field label={s.storeName} name="name" defaultValue={store.name} maxLength={80} required />
            <Select label={s.timezone} name="timeZone" options={timeZoneOptions()} defaultValue={store.timeZone} />
            <p className="text-sm text-muted">
              {s.currency}: <b className="text-ink">{store.currency}</b> — {s.currencyFixed}
            </p>
          </fieldset>

          <fieldset className={section}>
            <legend className="mb-2 font-semibold">{s.tax}</legend>
            <Field
              label={s.taxRate}
              name="taxRate"
              inputMode="decimal"
              defaultValue={String(store.taxRateBp / 100)}
              placeholder="0"
            />
            <p className="text-xs text-muted">{s.taxHint}</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="taxIncluded" defaultChecked={store.taxIncluded} className="size-4" />
              {s.taxIncluded}
            </label>
          </fieldset>

          <fieldset className={section}>
            <legend className="mb-2 font-semibold">{s.stock}</legend>
            <Field
              label={s.lowDefault}
              name="lowStockThreshold"
              type="number"
              min={0}
              defaultValue={store.lowStockThreshold}
              inputMode="numeric"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="allowNegativeStock" defaultChecked={store.allowNegativeStock} className="size-4" />
              {s.allowNegative}
            </label>
          </fieldset>

          <fieldset className={section}>
            <legend className="mb-2 font-semibold">{s.receipt}</legend>
            <label className="block space-y-1">
              <span className="text-sm text-muted">{s.footer}</span>
              <textarea
                name="receiptFooter"
                defaultValue={store.receiptFooter}
                placeholder={s.footerPlaceholder}
                maxLength={300}
                rows={3}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-brand"
              />
            </label>
          </fieldset>

          <PrimaryButton type="submit">{s.save}</PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
