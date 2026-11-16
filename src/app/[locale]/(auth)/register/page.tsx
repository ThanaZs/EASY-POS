import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { loadLocale } from "@/i18n/page";

export default async function RegisterPage({ params }: PageProps<"/[locale]/register">) {
  const { locale, t } = await loadLocale(params);

  // TODO(phase 1): สมัครจริง + ยืนยันอีเมล OTP (แบบ SmartStock เดิม)
  async function register() {
    "use server";
    redirect(`/${locale}/hub`);
  }

  return (
    <Card>
      <form action={register} className="space-y-4">
        <Field label={t.auth.displayName} name="displayName" autoComplete="name" />
        <Field label={t.auth.email} name="email" type="email" autoComplete="email" />
        <Field label={t.auth.password} name="password" type="password" autoComplete="new-password" />
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
