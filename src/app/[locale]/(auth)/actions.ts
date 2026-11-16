"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { defaultLocale, defaultTimeZone, isLocale } from "@/i18n/config";
import { getAuth } from "@/server/auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
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

function errorCode(e: unknown): string {
  if (!isAPIError(e)) throw e;
  const code = String((e.body as { code?: string } | undefined)?.code ?? "");
  if (code.startsWith("USER_ALREADY_EXISTS")) return "exists";
  if (code === "PASSWORD_TOO_SHORT") return "weak";
  if (code === "INVALID_EMAIL_OR_PASSWORD") return "invalid";
  return "failed";
}

export async function loginAction(form: FormData) {
  const locale = localeOf(form);
  let error: string | null = null;
  try {
    await getAuth().api.signInEmail({
      body: { email: str(form, "email"), password: String(form.get("password") ?? "") },
      headers: await headers(),
    });
  } catch (e) {
    error = errorCode(e);
  }
  redirect(error ? `/${locale}/login?error=${error}` : `/${locale}/hub`);
}

export async function registerAction(form: FormData) {
  const locale = localeOf(form);
  let error: string | null = null;
  try {
    await getAuth().api.signUpEmail({
      body: {
        name: str(form, "displayName") || str(form, "email").split("@")[0],
        email: str(form, "email"),
        password: String(form.get("password") ?? ""),
        locale,
        timeZone: validTimeZone(str(form, "timeZone")),
      },
      headers: await headers(),
    });
  } catch (e) {
    error = errorCode(e);
  }
  redirect(error ? `/${locale}/register?error=${error}` : `/${locale}/hub`);
}

export async function googleAction(form: FormData) {
  const locale = localeOf(form);
  const res = await getAuth().api.signInSocial({
    body: { provider: "google", callbackURL: `/${locale}/hub`, errorCallbackURL: `/${locale}/login?error=failed` },
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
