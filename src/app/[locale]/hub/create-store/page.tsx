import { Card, Field, PrimaryButton } from "@/components/Field";
import { PageTitle } from "@/components/PageTitle";
import { currencyOptions, Select, timeZoneOptions } from "@/components/Select";
import { loadLocale } from "@/i18n/page";
import { requireUser } from "@/server/session";
import { createStoreAction } from "../actions";

export default async function CreateStorePage({
  params,
}: PageProps<"/[locale]/hub/create-store">) {
  const { locale, t } = await loadLocale(params);
  const user = await requireUser(locale);

  return (
    <div className="mx-auto max-w-lg">
      <PageTitle title={t.hub.createStore} className="mb-4" />
      <Card>
        <form action={createStoreAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <Field
            label={t.createStore.storeName}
            name="name"
            maxLength={80}
            required
          />
          <Select
            label={t.createStore.currency}
            name="currency"
            options={currencyOptions}
            defaultValue="THB"
          />
          <Select
            label={t.createStore.timezone}
            name="timeZone"
            options={timeZoneOptions()}
            defaultValue={user.timeZone}
          />
          <PrimaryButton type="submit">{t.createStore.submit}</PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
