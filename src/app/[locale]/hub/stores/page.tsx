import Link from "next/link";
import { ChevronRight, Store } from "lucide-react";
import { loadLocale } from "@/i18n/page";

export default async function MyStoresPage({ params }: PageProps<"/[locale]/hub/stores">) {
  const { locale, t } = await loadLocale(params);
  // TODO(phase 1): getRepositories().stores.listForUser(session.userId)
  const stores = [{ id: "demo", name: "Demo Store", role: "owner" }];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">{t.hub.myStores}</h1>
      {stores.length === 0 ? (
        <p className="text-muted">{t.stores.empty}</p>
      ) : (
        <ul className="space-y-3">
          {stores.map((s) => (
            <li key={s.id}>
              <Link
                href={`/${locale}/store/${s.id}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm hover:shadow-md"
              >
                <span className="grid size-12 place-items-center rounded-xl bg-teal-600 text-white">
                  <Store />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{s.name}</span>
                  <span className="text-sm text-muted">
                    {t.stores.role}: {s.role}
                  </span>
                </span>
                <ChevronRight className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
