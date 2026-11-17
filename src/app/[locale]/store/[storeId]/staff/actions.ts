"use server";

import { redirect } from "next/navigation";
import type { StoreInvite } from "@/core/domain/types";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRepositories } from "@/server/container";
import { audit } from "@/server/audit";
import { requireStoreAccess } from "@/server/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ctx = (f: FormData) => {
  const l = str(f, "locale");
  return {
    locale: isLocale(l) ? l : defaultLocale,
    storeId: str(f, "storeId"),
  };
};
const INVITE_ROLES: StoreInvite["role"][] = ["manager", "cashier", "staff"];
const clampInt = (v: string, min: number, max: number, fallback: number) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export async function createInviteAction(form: FormData) {
  const { locale, storeId } = ctx(form);
  const { user, member } = await requireStoreAccess(
    locale,
    storeId,
    "staff.manage",
  );
  let role = str(form, "role") as StoreInvite["role"];
  if (!INVITE_ROLES.includes(role)) role = "staff";
  // ผู้จัดการเชิญผู้จัดการคนอื่นไม่ได้ — เฉพาะเจ้าของ
  if (role === "manager" && member.role !== "owner") role = "staff";
  const days = clampInt(str(form, "days"), 0, 365, 7);

  const repos = await getRepositories();
  const inv = await repos.stores.createInvite({
    storeId,
    role,
    maxUses: clampInt(str(form, "maxUses"), 1, 100, 1),
    expiresAt: days > 0 ? new Date(Date.now() + days * 86_400_000) : null,
    createdBy: user.id,
  });
  await audit(storeId, user, "invite.create", {
    entityType: "invite",
    entityId: inv.id,
    entityName: inv.code,
    note: `${role} · ${inv.maxUses}`,
  });
  redirect(`/${locale}/store/${storeId}/staff`);
}

/** ลบรหัสเชิญที่ยังไม่มีใครใช้ (กดสร้างผิด) — ผู้จัดการลบรหัสระดับผู้จัดการไม่ได้ */
export async function deleteInviteAction(form: FormData) {
  const { locale, storeId } = ctx(form);
  const { member, user } = await requireStoreAccess(
    locale,
    storeId,
    "staff.manage",
  );
  const repos = await getRepositories();
  const inv = (await repos.stores.listInvites(storeId)).find(
    (i) => i.id === str(form, "inviteId"),
  );
  if (
    inv &&
    (member.role === "owner" || inv.role !== "manager") &&
    (await repos.stores.deleteUnusedInvite(storeId, inv.id))
  )
    await audit(storeId, user, "invite.delete", {
      entityType: "invite",
      entityId: inv.id,
      entityName: inv.code,
      note: inv.role,
    });
  redirect(`/${locale}/store/${storeId}/staff`);
}

export async function removeMemberAction(form: FormData) {
  const { locale, storeId } = ctx(form);
  const { user, member } = await requireStoreAccess(
    locale,
    storeId,
    "staff.manage",
  );
  const targetId = str(form, "userId");
  const repos = await getRepositories();
  const target = await repos.stores.getMember(storeId, targetId);
  // ห้ามเอาตัวเอง/เจ้าของออก; ผู้จัดการเอาผู้จัดการคนอื่นออกไม่ได้
  const allowed =
    target &&
    target.userId !== user.id &&
    target.role !== "owner" &&
    (member.role === "owner" || target.role !== "manager");
  if (allowed) {
    const who = (await repos.stores.listMembers(storeId)).find(
      (m) => m.user.id === targetId,
    );
    await repos.stores.removeMember(storeId, targetId);
    await audit(storeId, user, "member.remove", {
      entityType: "member",
      entityId: targetId,
      entityName: who ? `${who.user.displayName} (${who.user.email})` : "",
      note: target.role,
    });
  }
  redirect(`/${locale}/store/${storeId}/staff`);
}
