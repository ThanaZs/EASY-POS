import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { loadLocale } from "@/i18n/page";

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale, t } = await loadLocale(params);

  // TODO(phase 1): เชื่อม auth จริง (ดู docs/ARCHITECTURE.md#auth) — ตอนนี้กดแล้วเข้า hub ได้เลยเพื่อดู UI
  async function login() {
    "use server";
    redirect(`/${locale}/hub`);
  }

  return (
    <Card>
      <form action={login} className="space-y-4">
        <Field label={t.auth.email} name="email" type="email" autoComplete="email" />
        <Field label={t.auth.password} name="password" type="password" autoComplete="current-password" />
        <PrimaryButton type="submit">{t.auth.login}</PrimaryButton>
        <button
          type="submit"
          className="w-full rounded-xl border border-line px-4 py-2.5 font-medium hover:bg-surface"
        >
          {t.auth.google}
        </button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-muted">{t.auth.forgot}</span>
        <Link href={`/${locale}/register`} className="font-semibold text-brand">
          {t.auth.register}
        </Link>
      </div>
    </Card>
  );
}
