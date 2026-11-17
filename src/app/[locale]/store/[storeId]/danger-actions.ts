"use server";

import { redirect } from "next/navigation";
import { getRepositories, getStorage } from "@/server/container";
import { storeCtx, str } from "@/server/form";
import { audit } from "@/server/audit";
import { requireStoreAccess } from "@/server/session";

/** เจ้าของลบร้าน — ต้องพิมพ์ชื่อร้านให้ตรง */
export async function deleteStoreAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { store, member } = await requireStoreAccess(locale, storeId);
  if (member.role !== "owner") redirect(`/${locale}/store/${storeId}`);
  if (str(form, "confirm").trim() !== store.name.trim())
    redirect(`/${locale}/store/${storeId}/settings?del=mismatch`);
  const repos = await getRepositories();
  const ok = await repos.stores.deleteStore(storeId, member.userId);
  if (ok) {
    const storage = await getStorage();
    if (storage)
      await storage
        .removePrefix(`stores/${storeId}`)
        .catch((e) => console.error(e));
  }
  redirect(`/${locale}/hub/stores?done=deleted`);
}

/** พนักงานออกจากร้าน (เจ้าของออกไม่ได้ — ต้องลบร้านแทน) */
export async function leaveStoreAction(form: FormData) {
  const { locale, storeId } = storeCtx(form);
  const { member, user } = await requireStoreAccess(locale, storeId);
  if (member.role === "owner") redirect(`/${locale}/store/${storeId}`);
  await audit(storeId, user, "member.leave", {
    entityType: "member",
    entityId: user.id,
    entityName: user.displayName,
    note: member.role,
  });
  await (await getRepositories()).stores.removeMember(storeId, member.userId);
  redirect(`/${locale}/hub/stores?done=left`);
}
