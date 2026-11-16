import { redirect } from "next/navigation";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { currencyOptions, Select, timeZoneOptions } from "@/components/Select";
import { defaultTimeZone } from "@/i18n/config";
import { loadLocale } from "@/i18n/page";

export default async function CreateStorePage({ params }: PageProps<"/[locale]/hub/create-store">) {
  const { locale, t } = await loadLocale(params);

  // TODO(phase 1): getRepositories().stores.create(...) + addMember(role: owner)
  async function create() {
    "use server";
    redirect(`/${locale}/store/demo`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold">{t.hub.createStore}</h1>
      <Card>
        <form action={create} className="space-y-4">
          <Field label={t.createStore.storeName} name="name" required />
          <Select label={t.createStore.currency} name="currency" options={currencyOptions} defaultValue="THB" />
          <Select
            label={t.createStore.timezone}
            name="timeZone"
            options={timeZoneOptions()}
            defaultValue={defaultTimeZone}
          />
          <PrimaryButton type="submit">{t.createStore.submit}</PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
