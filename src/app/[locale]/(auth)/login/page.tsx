import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, pickMessage } from "@/components/Alert";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { loadLocale } from "@/i18n/page";
import { googleEnabled } from "@/server/auth";
import { getSessionUser } from "@/server/session";
import { googleAction, loginAction } from "../actions";

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale, t } = await loadLocale(params);
  if (await getSessionUser()) redirect(`/${locale}/hub`);
  const error = pickMessage(t.auth.errors, (await searchParams).error);

  return (
    <Card>
      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {error && <Alert>{error}</Alert>}
        <Field label={t.auth.email} name="email" type="email" autoComplete="email" required />
        <Field label={t.auth.password} name="password" type="password" autoComplete="current-password" required />
        <PrimaryButton type="submit">{t.auth.login}</PrimaryButton>
      </form>
      {googleEnabled() && (
        <form action={googleAction} className="mt-3">
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="w-full rounded-xl border border-line px-4 py-2.5 font-medium hover:bg-surface"
          >
            {t.auth.google}
          </button>
        </form>
      )}
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-muted">{t.auth.noAccount}</span>
        <Link href={`/${locale}/register`} className="font-semibold text-brand">
          {t.auth.register}
        </Link>
      </div>
    </Card>
  );
}
