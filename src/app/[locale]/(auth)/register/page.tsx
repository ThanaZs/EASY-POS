import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, pickMessage } from "@/components/Alert";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { TimeZoneInput } from "@/components/TimeZoneInput";
import { defaultTimeZone } from "@/i18n/config";
import { loadLocale } from "@/i18n/page";
import { getSessionUser } from "@/server/session";
import { registerAction } from "../actions";

// TODO(phase 3): ยืนยันอีเมลด้วย OTP (แบบ SmartStock เดิม) — ต้องมีบริการส่งอีเมล
export default async function RegisterPage({ params, searchParams }: PageProps<"/[locale]/register">) {
  const { locale, t } = await loadLocale(params);
  if (await getSessionUser()) redirect(`/${locale}/hub`);
  const error = pickMessage(t.auth.errors, (await searchParams).error);

  return (
    <Card>
      <form action={registerAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <TimeZoneInput fallback={defaultTimeZone} />
        {error && <Alert>{error}</Alert>}
        <Field label={t.auth.displayName} name="displayName" autoComplete="name" required />
        <Field label={t.auth.email} name="email" type="email" autoComplete="email" required />
        <Field
          label={t.auth.password}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <PrimaryButton type="submit">{t.auth.register}</PrimaryButton>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {t.auth.haveAccount}{" "}
        <Link href={`/${locale}/login`} className="font-semibold text-brand">
          {t.auth.login}
        </Link>
      </p>
    </Card>
  );
}
