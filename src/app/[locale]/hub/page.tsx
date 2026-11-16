import { LogOut, PlusSquare, Store, UserCog, UserPlus } from "lucide-react";
import { Tile } from "@/components/Tile";
import { loadLocale } from "@/i18n/page";

// หน้าที่ 2: เลือกว่าจะทำอะไร
export default async function HubPage({ params }: PageProps<"/[locale]/hub">) {
  const { locale, t } = await loadLocale(params);
  const base = `/${locale}/hub`;
  const items = [
    { href: `${base}/create-store`, label: t.hub.createStore, Icon: PlusSquare, color: "bg-amber-500" },
    { href: `${base}/stores`, label: t.hub.myStores, Icon: Store, color: "bg-teal-600" },
    { href: `${base}/join`, label: t.hub.joinStore, Icon: UserPlus, color: "bg-sky-600" },
    { href: `${base}/account`, label: t.hub.account, Icon: UserCog, color: "bg-violet-600" },
    { href: `/${locale}/login`, label: t.hub.logout, Icon: LogOut, color: "bg-rose-500" },
  ];
  return (
    <>
      <h1 className="mb-5 text-xl font-bold">{t.hub.title}</h1>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {items.map((i) => (
          <Tile key={i.href + i.label} {...i} />
        ))}
      </div>
    </>
  );
}
