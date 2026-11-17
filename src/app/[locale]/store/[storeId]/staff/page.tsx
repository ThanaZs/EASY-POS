import { Trash2 } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Card, Field, PrimaryButton } from "@/components/Field";
import { fill } from "@/core/lib/format";
import { Select } from "@/components/Select";
import { inviteState } from "@/core/domain/invite";
import { formatDateTime } from "@/core/lib/format";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../BackLink";
import {
  createInviteAction,
  deleteInviteAction,
  removeMemberAction,
} from "./actions";

// พนักงาน: ดูสมาชิก + สร้างรหัสเชิญ (ใช้ที่หน้า hub > เข้าร่วมร้านค้า)
export default async function StaffPage({
  params,
}: PageProps<"/[locale]/store/[storeId]/staff">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const {
    store,
    member: me,
    user,
  } = await requireStoreAccess(locale, storeId, "staff.manage");
  const repos = await getRepositories();
  const [members, invites] = await Promise.all([
    repos.stores.listMembers(storeId),
    repos.stores.listInvites(storeId),
  ]);
  const roleOptions = (
    me.role === "owner"
      ? (["staff", "cashier", "manager"] as const)
      : (["staff", "cashier"] as const)
  ).map((r) => ({ value: r, label: t.roles[r] }));
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="storeId" value={storeId} />
    </>
  );

  return (
    <div className="space-y-6">
      <BackLink href={`/${locale}/store/${storeId}`} label={t.store.back} />
      <h1 className="text-xl font-bold">{t.store.modules.staff}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-semibold">{t.staff.members}</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {members.map(({ member, user: u }) => {
              const removable =
                u.id !== user.id &&
                member.role !== "owner" &&
                (me.role === "owner" || member.role !== "manager");
              return (
                <li key={member.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.displayName}</p>
                    <p className="truncate text-sm text-muted">{u.email}</p>
                  </div>
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink">
                    {t.roles[member.role]}
                  </span>
                  {removable && (
                    <form action={removeMemberAction}>
                      {hidden}
                      <input type="hidden" name="userId" value={u.id} />
                      <button
                        type="submit"
                        className="text-sm text-rose-600 hover:underline"
                      >
                        {t.staff.remove}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">{t.staff.invites}</h2>
          <Card>
            <form
              action={createInviteAction}
              className="grid gap-3 sm:grid-cols-3 sm:items-end"
            >
              {hidden}
              <Select
                label={t.staff.role}
                name="role"
                options={roleOptions}
                defaultValue="staff"
              />
              <Field
                label={t.staff.maxUses}
                name="maxUses"
                type="number"
                min={1}
                max={100}
                defaultValue={1}
              />
              <Field
                label={t.staff.expiresInDays}
                name="days"
                type="number"
                min={0}
                max={365}
                defaultValue={7}
              />
              <div className="sm:col-span-3">
                <PrimaryButton type="submit">
                  {t.staff.createInvite}
                </PrimaryButton>
              </div>
            </form>
          </Card>
          <p className="text-sm text-muted">{t.staff.inviteHint}</p>
          {invites.length === 0 ? (
            <p className="text-muted">{t.staff.noInvites}</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
              {invites.map((inv) => {
                const dead = inviteState(inv) !== "active";
                const deletable =
                  inv.usedCount === 0 &&
                  (me.role === "owner" || inv.role !== "manager");
                return (
                  <li
                    key={inv.id}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-1 p-3 ${dead ? "opacity-50" : ""}`}
                  >
                    <code className="select-all font-mono text-lg font-bold tracking-widest">
                      {inv.code}
                    </code>
                    <span className="text-sm">{t.roles[inv.role]}</span>
                    <span className="text-sm text-muted">
                      {t.staff.used} {inv.usedCount}/{inv.maxUses}
                    </span>
                    <span className="text-sm text-muted">
                      {inv.expiresAt
                        ? `${t.staff.expires} ${formatDateTime(inv.expiresAt, locale, store.timeZone)}`
                        : t.staff.never}
                    </span>
                    {deletable && (
                      <span className="ml-auto">
                        <ConfirmSubmit
                          action={deleteInviteAction}
                          trigger={<Trash2 className="size-4" />}
                          triggerLabel={t.staff.deleteInvite}
                          title={fill(t.staff.deleteInviteTitle, {
                            code: inv.code,
                          })}
                          message={t.staff.deleteInviteWarn}
                          confirmLabel={t.staff.deleteInviteConfirm}
                          cancelLabel={t.danger.cancel}
                        >
                          {hidden}
                          <input type="hidden" name="inviteId" value={inv.id} />
                        </ConfirmSubmit>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
