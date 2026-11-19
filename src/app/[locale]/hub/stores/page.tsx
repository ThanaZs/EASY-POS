import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { Alert } from "@/components/Alert";
import { ChevronRight, KeyRound, PlusSquare, Store } from "lucide-react";
import { StoreDangerDialog } from "../../store/[storeId]/StoreDangerDialog";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireUser } from "@/server/session";

export default async function MyStoresPage({
  params,
  searchParams,
}: PageProps<"/[locale]/hub/stores">) {
  const { locale, t } = await loadLocale(params);
  const user = await requireUser(locale);
  const done = (await searchParams).done;
  const stores = await (await getRepositories()).stores.listForUser(user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={t.hub.myStores} className="mb-4" />
      {(done === "deleted" || done === "left") && (
        <div className="mb-4">
          <Alert kind="success">{t.danger[done]}</Alert>
        </div>
      )}
      {stores.length === 0 ? (
        // ยังไม่มีร้าน: ปุ่มใหญ่ 2 ปุ่ม (เหมือนในเมนู) ให้เริ่มได้ทันที
        <div className="space-y-3">
          <p className="text-muted">{t.stores.empty}</p>
          {(
            [
              ["create-store", t.hub.createStore, PlusSquare, "bg-amber-500"],
              ["join", t.hub.joinStore, KeyRound, "bg-sky-600"],
            ] as const
          ).map(([path, label, Icon, color]) => (
            <Link
              key={path}
              prefetch={false}
              href={`/${locale}/hub/${path}`}
              className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm pressable"
            >
              <span className={`grid size-12 shrink-0 place-items-center rounded-xl text-white ${color}`}>
                <Icon />
              </span>
              <span className="flex-1 font-semibold">{label}</span>
              <ChevronRight className="shrink-0 text-muted" />
            </Link>
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {stores.map(({ store, member }) => (
            <li key={store.id}>
              <Link
                prefetch={false}
                href={`/${locale}/store/${store.id}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm pressable"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-teal-600 text-white">
                  <Store />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {store.name}
                  </span>
                  <span className="text-sm text-muted">
                    {t.stores.role}: {t.roles[member.role]}
                  </span>
                </span>
                <ChevronRight className="shrink-0 text-muted" />
              </Link>
              {/* ออกจากร้าน (พนักงาน) — ย้ายมาจากหน้าหลักร้านเดิม; เจ้าของลบร้านได้ในตั้งค่าร้าน */}
              {member.role !== "owner" && (
                <div className="ml-auto mt-1.5 w-44">
                  <StoreDangerDialog
                    mode="leave"
                    locale={locale}
                    storeId={store.id}
                    storeName={store.name}
                    t={t.danger}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
