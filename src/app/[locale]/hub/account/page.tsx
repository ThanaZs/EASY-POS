import { Card, PrimaryButton } from "@/components/Field";
import { Select, timeZoneOptions } from "@/components/Select";
import { defaultTimeZone, localeLabels, locales } from "@/i18n/config";
import { loadLocale } from "@/i18n/page";

export default async function AccountPage({ params }: PageProps<"/[locale]/hub/account">) {
  const { locale, t } = await loadLocale(params);
  // TODO(phase 1): โหลด/บันทึก users.locale, users.time_zone ผ่าน UserRepo
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">{t.hub.account}</h1>
      <Card>
        <form className="space-y-4">
          <Select
            label={t.account.language}
            name="locale"
            defaultValue={locale}
            options={locales.map((l) => ({ value: l, label: localeLabels[l] }))}
          />
          <Select label={t.account.timezone} name="timeZone" options={timeZoneOptions()} defaultValue={defaultTimeZone} />
          <PrimaryButton type="submit" disabled>
            {t.account.save}
          </PrimaryButton>
        </form>
      </Card>
      <button disabled className="w-full rounded-xl border border-rose-300 px-4 py-2.5 font-medium text-rose-600 disabled:opacity-60">
        {t.account.deleteAccount}
      </button>
    </div>
  );
}
