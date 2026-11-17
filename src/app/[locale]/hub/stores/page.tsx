import { BackLink } from "@/components/BackLink";
import Link from "next/link";
import { Alert } from "@/components/Alert";
import { ChevronRight, Store } from "lucide-react";
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
      <BackLink href={`/${locale}/hub`} label={t.hub.back} />
      <h1 className="mb-4 mt-2 text-xl font-bold">{t.hub.myStores}</h1>
      {(done === "deleted" || done === "left") && (
        <div className="mb-4">
          <Alert kind="success">{t.danger[done]}</Alert>
        </div>
      )}
      {stores.length === 0 ? (
        <p className="text-muted">{t.stores.empty}</p>
      ) : (
        <ul className="space-y-3">
          {stores.map(({ store, member }) => (
            <li key={store.id}>
              <Link
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
