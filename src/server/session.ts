import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { can } from "@/core/domain/permissions";
import type { Permission, User } from "@/core/domain/types";
import { getAuth } from "./auth";
import { getRepositories } from "./container";

export type SessionUser = Pick<User, "id" | "email" | "displayName" | "locale" | "timeZone">;

/** ผู้ใช้ที่ล็อกอินอยู่ (หรือ null) — cache ต่อ request */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const h = await headers(); // อ่าน headers ก่อน = บอก Next ว่าหน้านี้ dynamic (ไม่ prerender ตอน build)
  const s = await getAuth().api.getSession({ headers: h });
  if (!s) return null;
  return {
    id: s.user.id,
    email: s.user.email,
    displayName: s.user.name,
    locale: s.user.locale ?? "th",
    timeZone: s.user.timeZone ?? "Asia/Bangkok",
  };
});

/** ใช้ในหน้า/แอคชันที่ต้องล็อกอิน */
export async function requireUser(locale: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ใช้ในทุกหน้าใต้ /store/[storeId] — ต้องเป็นสมาชิกที่ active และ (ถ้าระบุ) มีสิทธิ์ */
export const requireStoreAccess = cache(async (locale: string, storeId: string, permission?: Permission) => {
  const user = await requireUser(locale);
  if (!UUID.test(storeId)) notFound();
  const repos = await getRepositories();
  const [store, member] = await Promise.all([repos.stores.findById(storeId), repos.stores.getMember(storeId, user.id)]);
  if (!store) notFound();
  if (!member || member.status !== "active") redirect(`/${locale}/hub/stores`);
  if (permission && !can(member, permission)) redirect(`/${locale}/store/${storeId}`);
  return { user, store, member };
});
