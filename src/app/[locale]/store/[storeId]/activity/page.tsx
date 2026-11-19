import Link from "next/link";
import { Users } from "lucide-react";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { todayIn } from "@/core/lib/format";
import { redirect } from "next/navigation";
import { can } from "@/core/domain/permissions";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { AuditList } from "../AuditList";
import { SettingsTabs } from "../SettingsTabs";

// ประวัติการแก้ไขทั้งร้าน (เจ้าของ/ผู้จัดการ): ใคร ทำอะไร กับอะไร เปลี่ยนจากอะไรเป็นอะไร เมื่อไร
export default async function ActivityPage({
  params,
  searchParams,
}: PageProps<"/[locale]/store/[storeId]/activity">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store, member } = await requireStoreAccess(locale, storeId);
  if (!can(member, "store.settings") && !can(member, "staff.manage"))
    redirect(`/${locale}/store/${storeId}`);
  const sp = await searchParams;
  const one = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : "";
  const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const from = isDay(one("from")) ? one("from") : "";
  const to = isDay(one("to")) ? one("to") : "";
  const actor = /^[0-9a-f-]{36}$/i.test(one("actor")) ? one("actor") : "";
  const repos = await getRepositories();
  const [entries, actors] = await Promise.all([
    repos.audit.list(storeId, {
      limit: 300,
      actorId: actor || undefined,
      from: from || undefined,
      to: to || undefined,
      timeZone: store.timeZone,
    }),
    repos.audit.actors(storeId),
  ]);
  const base = `/${locale}/store/${storeId}/activity`;
  const actorHref = (id: string) => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (id) p.set("actor", id);
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">{t.store.modules.settings}</h1>
      <SettingsTabs
        locale={locale}
        storeId={storeId}
        member={member}
        t={t.store.tabs}
        active="activity"
      />
      <p className="text-sm text-muted">{t.audit.hint}</p>
      <DateRangeFilter
        from={from}
        to={to}
        today={todayIn(store.timeZone)}
        allowAll
        labels={t.range}
      />
      {actors.length > 1 && (
        <section className="space-y-1.5 rounded-2xl border border-line bg-card p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="size-4 text-muted" /> {t.audit.people}
          </p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {[{ id: "", name: t.audit.allPeople }, ...actors].map((a) => (
              <Link
                key={a.id || "*"}
                prefetch={false}
                href={actorHref(a.id)}
                className={`shrink-0 rounded-full border px-3 py-1 text-sm transition active:scale-95 ${
                  actor === a.id
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-card hover:border-brand"
                }`}
              >
                {a.name}
              </Link>
            ))}
          </div>
        </section>
      )}
      <p className="text-sm text-muted">
        {entries.length} {t.audit.entries}
      </p>
      <AuditList
        entries={entries}
        t={t.audit}
        locale={locale}
        timeZone={store.timeZone}
        currency={store.currency}
      />
    </div>
  );
}
