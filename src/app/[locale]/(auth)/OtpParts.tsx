import Link from "next/link";
import { Alert } from "@/components/Alert";
import { fill } from "@/core/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { resendOtpAction } from "./actions";

/** ส่วนหัวของหน้า OTP: ชื่อหน้า + ส่งไปที่อีเมลไหน + ข้อความผลลัพธ์ */
export function OtpHeader({
  title,
  email,
  t,
  error,
  sent,
}: {
  title: string;
  email: string;
  t: Dictionary["auth"];
  error: string | null;
  sent: boolean;
}) {
  return (
    <div className="mb-4 space-y-3">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted">{fill(t.otpSentTo, { email })}</p>
      {sent && <Alert kind="success">{t.resent}</Alert>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

/** ช่องกรอก OTP 6 หลัก (มือถือขึ้นแป้นตัวเลข + เติมจาก SMS/อีเมลอัตโนมัติ) */
export function OtpInput({ label }: { label: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-muted">{label}</span>
      <input
        name="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        className="w-full rounded-xl border border-line bg-card px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
      />
    </label>
  );
}

/** ส่งรหัสอีกครั้ง + กลับไปใช้อีเมลอื่น */
export function OtpFooter({ locale, purpose, t }: { locale: Locale; purpose: "verify" | "reset"; t: Dictionary["auth"] }) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <Link href={`/${locale}/login`} className="text-muted hover:text-ink">
        {t.useOtherEmail}
      </Link>
      <form action={resendOtpAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="purpose" value={purpose} />
        <button type="submit" className="font-semibold text-brand-ink">
          {t.resend}
        </button>
      </form>
    </div>
  );
}
