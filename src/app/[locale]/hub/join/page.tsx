import { Card, Field, PrimaryButton } from "@/components/Field";
import { loadLocale } from "@/i18n/page";

export default async function JoinStorePage({ params }: PageProps<"/[locale]/hub/join">) {
  const { t } = await loadLocale(params);
  // TODO(phase 1): ตรวจ store_invites (max_uses, expires_at) แล้ว addMember — ตรรกะเดียวกับ SmartStock เดิม
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-bold">{t.hub.joinStore}</h1>
      <Card>
        <form className="space-y-4">
          <Field label={t.join.code} name="code" required autoCapitalize="characters" />
          <PrimaryButton type="submit" disabled>
            {t.join.submit}
          </PrimaryButton>
          <p className="text-center text-sm text-muted">{t.common.comingSoon}</p>
        </form>
      </Card>
    </div>
  );
}
