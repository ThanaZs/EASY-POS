import { redirect } from "next/navigation";
import { pickMessage } from "@/components/Alert";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { loadLocale } from "@/i18n/page";
import { resetPasswordAction } from "../actions";
import { OtpFooter, OtpHeader, OtpInput } from "../OtpParts";
import { readPendingEmail } from "../pending";

// ลืมรหัสผ่าน: ใส่ OTP ที่ส่งไปทางอีเมล + รหัสผ่านใหม่
export default async function ResetPage({ params, searchParams }: PageProps<"/[locale]/reset">) {
  const { locale, t } = await loadLocale(params);
  const email = await readPendingEmail();
  if (!email) redirect(`/${locale}/login`);
  const sp = await searchParams;
  return (
    <Card>
      <OtpHeader title={t.auth.resetTitle} email={email} t={t.auth} error={pickMessage(t.auth.errors, sp.error)} sent={sp.sent === "1"} />
      <form action={resetPasswordAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <OtpInput label={t.auth.otp} />
        <Field
          label={t.auth.newPassword}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <PrimaryButton type="submit">{t.auth.resetSubmit}</PrimaryButton>
      </form>
      <OtpFooter locale={locale} purpose="reset" t={t.auth} />
    </Card>
  );
}
