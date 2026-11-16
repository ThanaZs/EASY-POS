import { LogOut, PlusSquare, Store, UserCog, UserPlus } from "lucide-react";
import { Tile, TileButton } from "@/components/Tile";
import { loadLocale } from "@/i18n/page";
import { requireUser } from "@/server/session";
import { logoutAction } from "../(auth)/actions";

// หน้าที่ 2: เลือกว่าจะทำอะไร
export default async function HubPage({ params }: PageProps<"/[locale]/hub">) {
  const { locale, t } = await loadLocale(params);
  await requireUser(locale);
  const base = `/${locale}/hub`;
  const items = [
    { href: `${base}/create-store`, label: t.hub.createStore, Icon: PlusSquare, color: "bg-amber-500" },
    { href: `${base}/stores`, label: t.hub.myStores, Icon: Store, color: "bg-teal-600" },
    { href: `${base}/join`, label: t.hub.joinStore, Icon: UserPlus, color: "bg-sky-600" },
    { href: `${base}/account`, label: t.hub.account, Icon: UserCog, color: "bg-violet-600" },
  ];
  return (
    <>
      <h1 className="mb-5 text-xl font-bold">{t.hub.title}</h1>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {items.map((i) => (
          <Tile key={i.href} {...i} />
        ))}
        <form action={logoutAction} className="flex">
          <input type="hidden" name="locale" value={locale} />
          <TileButton label={t.hub.logout} Icon={LogOut} color="bg-rose-500" />
        </form>
      </div>
    </>
  );
}
