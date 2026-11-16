import { Alert } from "@/components/Alert";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { Select, timeZoneOptions } from "@/components/Select";
import { localeLabels, locales } from "@/i18n/config";
import { loadLocale } from "@/i18n/page";
import { requireUser } from "@/server/session";
import { saveAccountAction } from "../actions";

export default async function AccountPage({ params, searchParams }: PageProps<"/[locale]/hub/account">) {
  const { locale, t } = await loadLocale(params);
  const user = await requireUser(locale);
  const saved = (await searchParams).saved === "1";

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">{t.hub.account}</h1>
      <Card>
        <form action={saveAccountAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          {saved && <Alert kind="success">{t.account.saved}</Alert>}
          <p className="text-sm text-muted">{user.email}</p>
          <Field label={t.account.displayName} name="displayName" defaultValue={user.displayName} maxLength={80} required />
          <Select
            label={t.account.language}
            name="newLocale"
            defaultValue={locale}
            options={locales.map((l) => ({ value: l, label: localeLabels[l] }))}
          />
          <Select label={t.account.timezone} name="timeZone" options={timeZoneOptions()} defaultValue={user.timeZone} />
          <PrimaryButton type="submit">{t.account.save}</PrimaryButton>
        </form>
      </Card>
      {/* TODO(phase 3): ลบบัญชี — ต้องจัดการร้านที่เป็นเจ้าของก่อน */}
      <button
        disabled
        title={t.account.deleteSoon}
        className="w-full rounded-xl border border-rose-300 px-4 py-2.5 font-medium text-rose-600 disabled:opacity-60"
      >
        {t.account.deleteAccount}
      </button>
    </div>
  );
}
