"use server";

import { isAPIError } from "better-auth/api";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { defaultLocale, defaultTimeZone, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionary";
import { getAuth } from "@/server/auth";
import { getRepositories } from "@/server/container";
import { requireUser } from "@/server/session";

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
const CURRENCY = /^[A-Z]{3}$/;

export async function createStoreAction(form: FormData) {
  const locale = localeOf(form);
  const user = await requireUser(locale);
  const name = str(form, "name").slice(0, 80);
  if (!name) redirect(`/${locale}/hub/create-store`);
  const currency = CURRENCY.test(str(form, "currency")) ? str(form, "currency") : "THB";

  const repos = await getRepositories();
  const store = await repos.stores.createWithOwner({
    name,
    currency,
    timeZone: validTimeZone(str(form, "timeZone")),
    locale,
    ownerId: user.id,
  });
  redirect(`/${locale}/store/${store.id}`);
}

export async function joinStoreAction(form: FormData) {
  const locale = localeOf(form);
  const user = await requireUser(locale);
  const repos = await getRepositories();
  const res = await repos.stores.redeemInvite(str(form, "code"), user.id);
  redirect(res.ok ? `/${locale}/store/${res.storeId}` : `/${locale}/hub/join?error=${res.reason}`);
}

export async function saveAccountAction(form: FormData) {
  const current = localeOf(form);
  const user = await requireUser(current);
  const nextLocale = isLocale(str(form, "newLocale")) ? str(form, "newLocale") : current;
  const displayName = str(form, "displayName").slice(0, 80) || user.displayName;

  const repos = await getRepositories();
  await repos.users.updateProfile(user.id, {
    displayName,
    locale: nextLocale,
    timeZone: validTimeZone(str(form, "timeZone")),
  });
  // อัปเดต session cookie ให้มีชื่อ/ภาษา/ทามโซนใหม่ทันที
  await getAuth().api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  (await cookies()).set("locale", nextLocale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(`/${nextLocale}/hub/account?saved=1`);
}

export async function changePasswordAction(form: FormData) {
  const locale = localeOf(form);
  await requireUser(locale);
  const back = `/${locale}/hub/account`;
  const currentPassword = String(form.get("currentPassword") ?? "");
  const newPassword = String(form.get("newPassword") ?? "");
  if (newPassword.length < 8) redirect(`${back}?pw=weak#password`);
  if (newPassword === currentPassword) redirect(`${back}?pw=same#password`);
  let code = "";
  try {
    // revokeOtherSessions: อุปกรณ์อื่นหลุด, เครื่องนี้ได้ session ใหม่ (nextCookies ตั้ง cookie ให้)
    await getAuth().api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (e) {
    if (!isAPIError(e)) throw e;
    const c = String((e.body as { code?: string } | undefined)?.code ?? "");
    code = c === "INVALID_PASSWORD" ? "wrongPassword" : c === "PASSWORD_TOO_SHORT" ? "weak" : "failed";
  }
  redirect(code ? `${back}?pw=${code}#password` : `${back}?pw=ok#password`);
}

/** ลบบัญชีถาวร — ต้องพิมพ์คำยืนยันให้ตรง (เช็กซ้ำฝั่ง server) */
export async function deleteAccountAction(form: FormData) {
  const locale = localeOf(form);
  const user = await requireUser(locale);
  const t = await getDictionary(locale);
  if (str(form, "confirm") !== t.account.deleteWord) redirect(`/${locale}/hub/account?del=mismatch`);
  // ออกจากระบบก่อน (ล้าง cookie + cookie cache) แล้วค่อยลบข้อมูล
  await getAuth().api.signOut({ headers: await headers() });
  await (await getRepositories()).users.deleteAccount(user.id);
  redirect(`/${locale}/login?deleted=1`);
}
