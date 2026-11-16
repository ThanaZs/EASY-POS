import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, pickMessage } from "@/components/Alert";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { loadLocale } from "@/i18n/page";
import { googleEnabled } from "@/server/auth";
import { getSessionUser } from "@/server/session";
import { forgotPasswordAction, loginAction } from "../actions";
import { GoogleButton } from "../GoogleButton";
import { readPendingEmail } from "../pending";

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale, t } = await loadLocale(params);
  if (await getSessionUser()) redirect(`/${locale}/hub`);
  const sp = await searchParams;
  const error = pickMessage(t.auth.errors, sp.error);
  const lastEmail = await readPendingEmail();

  return (
    <Card>
      {googleEnabled() && <GoogleButton locale={locale} label={t.auth.google} or={t.auth.or} />}
      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {sp.reset === "1" && <Alert kind="success">{t.auth.resetDone}</Alert>}
        {error && <Alert>{error}</Alert>}
        <Field label={t.auth.email} name="email" type="email" autoComplete="email" defaultValue={lastEmail} required />
        <Field label={t.auth.password} name="password" type="password" autoComplete="current-password" required />
        <PrimaryButton type="submit">{t.auth.login}</PrimaryButton>
      </form>
      {/* รหัสผ่านผิด → แสดงปุ่มลืมรหัสผ่าน ส่ง OTP ไปที่อีเมลที่เพิ่งพิมพ์ */}
      {sp.error === "invalid" && lastEmail && (
        <form action={forgotPasswordAction} className="mt-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="email" value={lastEmail} />
          <button
            type="submit"
            className="w-full rounded-xl border border-brand px-4 py-2.5 font-medium text-brand-ink hover:bg-brand-soft"
          >
            {t.auth.forgotButton}
          </button>
        </form>
      )}
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-muted">{t.auth.noAccount}</span>
        <Link href={`/${locale}/register`} className="font-semibold text-brand-ink">
          {t.auth.register}
        </Link>
      </div>
    </Card>
  );
}
