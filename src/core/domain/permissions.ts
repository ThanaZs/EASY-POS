import { PERMISSIONS, type Permission, type Role, type StoreMember } from "./types";

const all = Object.fromEntries(PERMISSIONS.map((p) => [p, true])) as Record<Permission, boolean>;
const none = Object.fromEntries(PERMISSIONS.map((p) => [p, false])) as Record<Permission, boolean>;

// ค่าเริ่มต้นของแต่ละบทบาท (สืบทอดแนวคิดจาก SmartStock: owner/manager/employee)
export const ROLE_DEFAULTS: Record<Role, Record<Permission, boolean>> = {
  owner: all,
  manager: { ...all, "store.settings": false },
  cashier: {
    ...none,
    "pos.sell": true,
    "products.view": true,
    "stock.history": true,
  },
  staff: {
    ...none,
    "products.view": true,
    "stock.receive": true,
    "stock.issue": true,
  },
};

export function effectivePermissions(
  member: Pick<StoreMember, "role" | "permissions" | "status">,
): Record<Permission, boolean> {
  if (member.status !== "active") return { ...none };
  if (member.role === "owner") return { ...all };
  return { ...ROLE_DEFAULTS[member.role], ...member.permissions };
}

export function can(
  member: Pick<StoreMember, "role" | "permissions" | "status">,
  permission: Permission,
): boolean {
  return effectivePermissions(member)[permission] === true;
}
