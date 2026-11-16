import type { StoreInvite } from "./types";

/** สถานะรหัสเชิญ ณ เวลาที่กำหนด */
export function inviteState(
  inv: Pick<StoreInvite, "usedCount" | "maxUses" | "expiresAt">,
  now: number = Date.now(),
): "active" | "expired" | "used_up" {
  if (inv.expiresAt && inv.expiresAt.getTime() < now) return "expired";
  if (inv.usedCount >= inv.maxUses) return "used_up";
  return "active";
}
