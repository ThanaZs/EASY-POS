import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LAST_STORE_COOKIE } from "@/core/lib/last-store";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireUser } from "@/server/session";

// หน้าแรกหลังล็อกอิน: ไม่มีหน้าปุ่มแล้ว (ทุกอย่างอยู่ในเมนู) → พาเข้าร้านล่าสุดเลย
// ร้านล่าสุด (cookie) → ร้านแรก → ยังไม่มีร้าน = หน้าร้านค้าของฉัน (มีปุ่มสร้าง/เข้าร่วม)
export default async function HubPage({ params, searchParams }: PageProps<"/[locale]/hub">) {
  const { locale } = await loadLocale(params);
  const user = await requireUser(locale);
  const stores = await (await getRepositories()).stores.listForUser(user.id);
  const last = (await cookies()).get(LAST_STORE_COOKIE)?.value;
  const pick = stores.find(({ store }) => store.id === last) ?? stores[0];
  const welcome = (await searchParams).welcome === "1" ? "?welcome=1" : ""; // หน้าต่างแนะนำติดตั้งแอปหลังสมัคร
  redirect(`${pick ? `/${locale}/store/${pick.store.id}` : `/${locale}/hub/stores`}${welcome}`);
}
