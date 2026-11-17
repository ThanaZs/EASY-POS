import { BackLink } from "@/components/BackLink";
import { Alert, pickMessage } from "@/components/Alert";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { loadLocale } from "@/i18n/page";
import { requireUser } from "@/server/session";
import { joinStoreAction } from "../actions";

export default async function JoinStorePage({
  params,
  searchParams,
}: PageProps<"/[locale]/hub/join">) {
  const { locale, t } = await loadLocale(params);
  await requireUser(locale);
  const error = pickMessage(t.join.errors, (await searchParams).error);

  return (
    <div className="mx-auto max-w-lg">
      <BackLink href={`/${locale}/hub`} label={t.hub.back} />
      <h1 className="mb-4 mt-2 text-xl font-bold">{t.hub.joinStore}</h1>
      <Card>
        <form action={joinStoreAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          {error && <Alert>{error}</Alert>}
          <Field
            label={t.join.code}
            name="code"
            required
            autoCapitalize="characters"
            autoComplete="off"
            className="font-mono tracking-widest uppercase"
          />
          <PrimaryButton type="submit">{t.join.submit}</PrimaryButton>
          <p className="text-center text-sm text-muted">{t.join.hint}</p>
        </form>
      </Card>
    </div>
  );
}
