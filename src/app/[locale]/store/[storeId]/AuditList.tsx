import { formatDateTime, formatMoney } from "@/core/lib/format";
import type { AuditEntry } from "@/core/ports/repositories";
import type { Dictionary } from "@/i18n/dictionary";

/** รายการบันทึกการแก้ไข: เวลา · ใคร · ทำอะไร · กับอะไร · เปลี่ยนจาก → เป็น */
export function AuditList({
  entries,
  t,
  locale,
  timeZone,
  currency,
  showEntity = true,
}: {
  entries: AuditEntry[];
  t: Dictionary["audit"];
  locale: string;
  timeZone: string;
  currency: string;
  showEntity?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-card p-6 text-center text-muted">
        {t.empty}
      </p>
    );
  }
  const fields = t.fields as Record<string, string>;
  const actions = t.actions as Record<string, string>;
  const show = (field: string, v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (field === "photo") return v === "new" ? t.photoNew : t.photoOld;
    if (typeof v === "boolean") return v ? t.yes : t.no;
    if (typeof v === "number" && field.endsWith("Minor"))
      return formatMoney(v, currency, locale);
    if (typeof v === "number" && field === "taxRateBp") return `${v / 100}%`;
    return String(v);
  };
  return (
    <ul className="scroll-box divide-y divide-line rounded-2xl border border-line bg-card">
      {entries.map((e) => (
        <li key={e.id} className="space-y-1 p-3 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">
              {actions[e.action] ?? e.action}
            </span>
            {showEntity && e.entityName && (
              <span className="font-medium text-brand-ink">{e.entityName}</span>
            )}
            <span className="ml-auto text-xs text-muted tabular-nums">
              {formatDateTime(e.at, locale, timeZone)}
            </span>
          </div>
          <p className="text-xs text-muted">
            {t.by} {e.actorName || "—"}
            {e.note ? ` · ${e.note}` : ""}
          </p>
          {e.changes && Object.keys(e.changes).length > 0 && (
            <ul className="space-y-0.5 rounded-lg bg-surface px-2 py-1.5 text-xs">
              {Object.entries(e.changes).map(([field, [before, after]]) => (
                <li key={field} className="flex flex-wrap gap-x-1.5">
                  <span className="text-muted">{fields[field] ?? field}:</span>
                  <span className="line-through decoration-rose-400/70">
                    {show(field, before)}
                  </span>
                  <span className="text-muted">→</span>
                  <span className="font-semibold">{show(field, after)}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
