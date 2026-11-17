import "server-only";
import type { AuditChanges } from "@/core/ports/repositories";
import { getRepositories } from "@/server/container";

// ===== บันทึกการแก้ไข: ใคร ทำอะไร กับอะไร เปลี่ยนจากอะไรเป็นอะไร เมื่อไร =====
// action ที่ใช้: product.create/update/delete/import, stock.in/out/adjust, sale.void,
//               settings.update, invite.create/delete, member.remove, store.leave
// บันทึกไม่สำเร็จ ≠ งานหลักไม่สำเร็จ → กลืน error (แค่ log ฝั่ง server)

export async function audit(
  storeId: string,
  actor: { id: string; displayName: string },
  action: string,
  opts: {
    entityType: string;
    entityId?: string | null;
    entityName?: string;
    changes?: AuditChanges | null;
    note?: string;
  },
) {
  try {
    if (opts.changes && Object.keys(opts.changes).length === 0 && !opts.note)
      return; // ไม่มีอะไรเปลี่ยน
    await (
      await getRepositories()
    ).audit.log({
      storeId,
      actorId: actor.id,
      actorName: actor.displayName,
      action,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      entityName: opts.entityName ?? "",
      changes: opts.changes ?? null,
      note: opts.note ?? "",
    });
  } catch (e) {
    console.error("[audit] log failed", e);
  }
}

const norm = (v: unknown) =>
  v instanceof Date
    ? v.toISOString().slice(0, 10)
    : v === undefined || v === ""
      ? null
      : v;

/** เทียบค่าก่อน/หลัง เฉพาะ field ที่ระบุ → { field: [ก่อน, หลัง] } เฉพาะที่เปลี่ยน */
export function diff<T extends object>(
  before: T,
  after: Partial<T>,
  keys: Array<keyof T & string>,
): AuditChanges {
  const out: AuditChanges = {};
  for (const k of keys) {
    if (!(k in after)) continue;
    const a = norm(before[k]);
    const b = norm(after[k]);
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = [a, b];
  }
  return out;
}
