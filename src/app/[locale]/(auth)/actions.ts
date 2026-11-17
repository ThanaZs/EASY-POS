"use server";

import { isAPIError } from "better-auth/api";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { defaultLocale, defaultTimeZone, isLocale } from "@/i18n/config";
import { getAuth, isGmail } from "@/server/auth";
import { otpRecentlySent } from "@/server/otp-throttle";
import { PENDING_EMAIL_COOKIE } from "./pending";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const emailOf = (f: FormData) => str(f, "email").toLowerCase();
const localeOf = (f: FormData) => {
  const l = str(f, "locale");
  return isLocale(l) ? l : defaultLocale;
};
const validTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return defaultTimeZone;
  }
};

/** จำอีเมลที่กำลังยืนยัน/รีเซ็ตไว้ใน cookie (httpOnly) แทนการใส่ใน URL */
async function setPendingEmail(email: string) {
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });
}
async function getPendingEmail(): Promise<string> {
  return (await cookies()).get(PENDING_EMAIL_COOKIE)?.value ?? "";
}
async function clearPendingEmail() {
  (await cookies()).delete(PENDING_EMAIL_COOKIE);
}

/** รหัส error ของ Better Auth (ไม่ใช่ APIError → โยนต่อ) */
function apiCode(e: unknown): string {
  if (!isAPIError(e)) throw e;
  return String((e.body as { code?: string } | undefined)?.code ?? "");
}

function mapError(code: string): string {
  if (code.startsWith("USER_ALREADY_EXISTS")) return "exists";
  if (code === "PASSWORD_TOO_SHORT") return "weak";
  if (code === "INVALID_EMAIL_OR_PASSWORD") return "invalid";
  if (code === "GMAIL_ONLY") return "gmailOnly";
  if (code === "INVALID_OTP") return "otpInvalid";
  if (code === "OTP_EXPIRED") return "otpExpired";
  if (code === "TOO_MANY_ATTEMPTS") return "tooMany";
  return "failed";
}

async function sendVerification(email: string) {
  if (await otpRecentlySent("email-verification", email)) return;
  await getAuth().api.sendVerificationOTP({ body: { email, type: "email-verification" } });
}

export async function loginAction(form: FormData) {
  const locale = localeOf(form);
  const email = emailOf(form);
  let code = "";
  try {
    await getAuth().api.signInEmail({
      body: { email, password: String(form.get("password") ?? "") },
      headers: await headers(),
    });
  } catch (e) {
    code = apiCode(e);
  }
  if (!code) {
    await clearPendingEmail();
    redirect(`/${locale}/hub?welcome=1`);
  }
  await setPendingEmail(email);
  // รหัสผ่านถูกแต่ยังไม่ยืนยันอีเมล → ส่ง OTP แล้วไปหน้ายืนยัน
  if (code === "EMAIL_NOT_VERIFIED") {
    await sendVerification(email);
    redirect(`/${locale}/verify`);
  }
  redirect(`/${locale}/login?error=${mapError(code)}`);
}

export async function registerAction(form: FormData) {
  const locale = localeOf(form);
  const email = emailOf(form);
  if (!isGmail(email)) redirect(`/${locale}/register?error=gmailOnly`);
  let code = "";
  try {
    // requireEmailVerification: ยังไม่ได้ session — ระบบส่ง OTP ให้อัตโนมัติ (sendVerificationOnSignUp)
    await getAuth().api.signUpEmail({
      body: {
        name: str(form, "displayName").slice(0, 80) || email.split("@")[0],
        email,
        password: String(form.get("password") ?? ""),
        locale,
        timeZone: validTimeZone(str(form, "timeZone")),
      },
      headers: await headers(),
    });
  } catch (e) {
    code = apiCode(e);
  }
  if (code) redirect(`/${locale}/register?error=${mapError(code)}`);
  await setPendingEmail(email);
  redirect(`/${locale}/verify`);
}

export async function verifyEmailAction(form: FormData) {
  const locale = localeOf(form);
  const email = await getPendingEmail();
  if (!email) redirect(`/${locale}/login`);
  let code = "";
  try {
    // autoSignInAfterVerification → ได้ session cookie ทันที
    await getAuth().api.verifyEmailOTP({ body: { email, otp: str(form, "otp") }, headers: await headers() });
  } catch (e) {
    code = apiCode(e);
  }
  if (code) redirect(`/${locale}/verify?error=${mapError(code)}`);
  await clearPendingEmail();
  redirect(`/${locale}/hub?welcome=1`);
}

export async function resendOtpAction(form: FormData) {
  const locale = localeOf(form);
  const purpose = str(form, "purpose") === "reset" ? "reset" : "verify";
  const email = await getPendingEmail();
  if (!email) redirect(`/${locale}/login`);
  const type = purpose === "reset" ? "forget-password" : "email-verification";
  if (await otpRecentlySent(type, email)) redirect(`/${locale}/${purpose}?error=cooldown`);
  try {
    if (type === "forget-password") await getAuth().api.requestPasswordResetEmailOTP({ body: { email } });
    else await getAuth().api.sendVerificationOTP({ body: { email, type } });
  } catch (e) {
    console.error("resend otp failed", e);
    redirect(`/${locale}/${purpose}?error=mailFailed`);
  }
  redirect(`/${locale}/${purpose}?sent=1`);
}

/** ลืมรหัสผ่าน: ส่ง OTP ไปที่อีเมล (ไม่บอกว่ามีบัญชีหรือไม่ — กันคนสุ่มหาอีเมล) */
export async function forgotPasswordAction(form: FormData) {
  const locale = localeOf(form);
  const email = emailOf(form) || (await getPendingEmail());
  if (!email) redirect(`/${locale}/login`);
  await setPendingEmail(email);
  if (!(await otpRecentlySent("forget-password", email))) {
    try {
      await getAuth().api.requestPasswordResetEmailOTP({ body: { email } });
    } catch (e) {
      console.error("forgot password otp failed", e);
      redirect(`/${locale}/reset?error=mailFailed`);
    }
  }
  redirect(`/${locale}/reset`);
}

export async function resetPasswordAction(form: FormData) {
  const locale = localeOf(form);
  const email = await getPendingEmail();
  if (!email) redirect(`/${locale}/login`);
  let code = "";
  try {
    await getAuth().api.resetPasswordEmailOTP({
      body: { email, otp: str(form, "otp"), password: String(form.get("password") ?? "") },
    });
  } catch (e) {
    code = apiCode(e);
  }
  if (code) redirect(`/${locale}/reset?error=${mapError(code)}`);
  await clearPendingEmail();
  redirect(`/${locale}/login?reset=1`);
}

export async function googleAction(form: FormData) {
  const locale = localeOf(form);
  const res = await getAuth().api.signInSocial({
    body: { provider: "google", callbackURL: `/${locale}/hub?welcome=1`, errorCallbackURL: `/${locale}/login?error=failed` },
    headers: await headers(),
  });
  if (!res.url) redirect(`/${locale}/login?error=failed`);
  redirect(res.url);
}

export async function logoutAction(form: FormData) {
  const locale = localeOf(form);
  await getAuth().api.signOut({ headers: await headers() });
  redirect(`/${locale}/login`);
}
