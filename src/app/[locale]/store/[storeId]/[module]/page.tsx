import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadLocale } from "@/i18n/page";
import { MODULES } from "../modules";

// placeholder ของแต่ละโมดูล — เมื่อทำจริงให้สร้างโฟลเดอร์เฉพาะ เช่น store/[storeId]/pos/page.tsx (จะ override route นี้)
export default async function ModulePage({ params }: PageProps<"/[locale]/store/[storeId]/[module]">) {
  const { locale, t } = await loadLocale(params);
  const { storeId, module } = await params;
  const mod = MODULES.find((m) => m.key === module);
  if (!mod) notFound();

  return (
    <div className="space-y-4">
      <Link href={`/${locale}/store/${storeId}`} className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft className="size-4" /> {t.store.back}
      </Link>
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-card p-10 text-center">
        <span className={`grid size-16 place-items-center rounded-2xl text-white ${mod.color}`}>
          <mod.Icon className="size-8" />
        </span>
        <h1 className="text-xl font-bold">{t.store.modules[mod.key]}</h1>
        <p className="text-muted">{t.store.comingSoon}</p>
      </div>
    </div>
  );
}
