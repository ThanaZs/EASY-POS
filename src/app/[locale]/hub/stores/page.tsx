import Link from "next/link";
import { ChevronRight, Store } from "lucide-react";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireUser } from "@/server/session";

export default async function MyStoresPage({ params }: PageProps<"/[locale]/hub/stores">) {
  const { locale, t } = await loadLocale(params);
  const user = await requireUser(locale);
  const stores = await (await getRepositories()).stores.listForUser(user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">{t.hub.myStores}</h1>
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
                  <span className="block truncate font-semibold">{store.name}</span>
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
