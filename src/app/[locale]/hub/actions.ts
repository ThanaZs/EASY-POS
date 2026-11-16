"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { defaultLocale, defaultTimeZone, isLocale } from "@/i18n/config";
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
