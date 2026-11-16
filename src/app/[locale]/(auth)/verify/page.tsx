import { redirect } from "next/navigation";
import { pickMessage } from "@/components/Alert";
import { Card, PrimaryButton } from "@/components/Field";
import { loadLocale } from "@/i18n/page";
import { verifyEmailAction } from "../actions";
import { OtpFooter, OtpHeader, OtpInput } from "../OtpParts";
import { readPendingEmail } from "../pending";

// ยืนยันอีเมลด้วย OTP (หลังสมัคร หรือ ล็อกอินบัญชีที่ยังไม่ยืนยัน)
export default async function VerifyPage({ params, searchParams }: PageProps<"/[locale]/verify">) {
  const { locale, t } = await loadLocale(params);
  const email = await readPendingEmail();
  if (!email) redirect(`/${locale}/login`);
  const sp = await searchParams;
  return (
    <Card>
      <OtpHeader title={t.auth.verifyTitle} email={email} t={t.auth} error={pickMessage(t.auth.errors, sp.error)} sent={sp.sent === "1"} />
      <form action={verifyEmailAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <OtpInput label={t.auth.otp} />
        <PrimaryButton type="submit">{t.auth.verify}</PrimaryButton>
      </form>
      <OtpFooter locale={locale} purpose="verify" t={t.auth} />
    </Card>
  );
}
