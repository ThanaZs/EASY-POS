import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, pickMessage } from "@/components/Alert";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { TimeZoneInput } from "@/components/TimeZoneInput";
import { defaultTimeZone } from "@/i18n/config";
import { loadLocale } from "@/i18n/page";
import { googleEnabled } from "@/server/auth";
import { getSessionUser } from "@/server/session";
import { registerAction } from "../actions";
import { GoogleButton } from "../GoogleButton";

// สมัคร: ปุ่ม Google หรือ อีเมล @gmail.com + รหัสผ่าน แล้วยืนยัน OTP ทางอีเมล
export default async function RegisterPage({
  params,
  searchParams,
}: PageProps<"/[locale]/register">) {
  const { locale, t } = await loadLocale(params);
  if (await getSessionUser()) redirect(`/${locale}/hub`);
  const error = pickMessage(t.auth.errors, (await searchParams).error);

  return (
    <Card>
      {googleEnabled() && (
        <GoogleButton locale={locale} label={t.auth.google} or={t.auth.or} />
      )}
      <form action={registerAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <TimeZoneInput fallback={defaultTimeZone} />
        {error && <Alert>{error}</Alert>}
        <Field
          label={t.auth.displayName}
          name="displayName"
          autoComplete="name"
          required
        />
        <div className="space-y-1">
          <Field
            label={t.auth.email}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@gmail.com"
            pattern="[^@\s]+@(gmail|googlemail)\.com"
            title={t.auth.errors.gmailOnly}
            required
          />
          <p className="text-xs text-muted">{t.auth.gmailHint}</p>
        </div>
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
        <Link
          prefetch={false}
          href={`/${locale}/login`}
          className="font-semibold text-brand-ink"
        >
          {t.auth.login}
        </Link>
      </p>
    </Card>
  );
}
