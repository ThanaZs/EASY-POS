import { ImageOff, RotateCcw, Trash2 } from "lucide-react";
import { Alert } from "@/components/Alert";
import { BackLink } from "@/components/BackLink";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { PageTitle } from "@/components/PageTitle";
import { fill, formatDateTime, formatMoney } from "@/core/lib/format";
import { loadLocale } from "@/i18n/page";
import { getRepositories, getStorage } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { purgeProductAction, restoreProductAction } from "../actions";

/** เก็บในถังขยะกี่วันก่อนลบถาวรอัตโนมัติ */
const KEEP_DAYS = 30;
/** เหลืออีกกี่วันก่อนลบถาวร */
function daysLeft(deletedAt: Date): number {
  const age = Math.floor((Date.now() - deletedAt.getTime()) / 86_400_000);
  return Math.max(0, KEEP_DAYS - age);
}

/**
 * ถังขยะสินค้า: สินค้าที่ลบ / ถูกแทนที่ (บาร์โค้ดซ้ำตอนเพิ่มสินค้า) — กู้คืนได้ภายใน 30 วัน
 * กู้คืน = กลับมาพร้อมบาร์โค้ด/รูป/ประวัติ; ลบถาวร = ซ่อนแบบเดิม (บิลเก่ายังอ้างถึงชื่อได้)
 */
export default async function TrashPage({
  params,
  searchParams,
}: PageProps<"/[locale]/store/[storeId]/inventory/trash">) {
  const { locale, t } = await loadLocale(params);
  const { storeId } = await params;
  const { store } = await requireStoreAccess(locale, storeId, "products.delete");
  const sp = await searchParams;
  const repos = await getRepositories();
  const storage = await getStorage();
  // ครบ 30 วัน → ลบถาวรอัตโนมัติ (ทำตอนเปิดหน้านี้ + ลบไฟล์รูป)
  const expired = await repos.products.purgeOlderThan(storeId, KEEP_DAYS);
  if (expired.length) await storage?.remove(expired).catch(() => {});
  const items = await repos.products.listTrash(storeId);
  const tt = t.inventory.trash;
  const base = `/${locale}/store/${storeId}/inventory`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink mobileHidden href={base} label={t.store.modules.inventory} />
      <PageTitle title={tt.title} back={base} />
      <p className="text-sm text-muted">{fill(tt.hint, { days: KEEP_DAYS })}</p>
      {typeof sp.restored === "string" && (
        <Alert kind="success">
          {fill(tt.restored, { name: sp.restored })}
          {sp.nobarcode === "1" ? ` ${tt.noBarcode}` : ""}
        </Alert>
      )}
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card p-10 text-center text-muted">
          <Trash2 className="mx-auto mb-2 size-8 opacity-50" />
          {tt.empty}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {items.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 border-b border-line p-3 last:border-b-0"
            >
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface opacity-80">
                {p.imagePath && storage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- รูปจาก storage
                  <img
                    src={storage.publicUrl(p.imagePath)}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <ImageOff className="size-4 text-muted" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium leading-snug">{p.name}</p>
                <p className="truncate text-xs text-muted">
                  {[
                    formatMoney(p.priceMinor, store.currency, locale),
                    `${p.stockQty} ${p.unit}`,
                    p.barcode,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-xs text-muted">
                  {p.deletedAt &&
                    fill(tt.deletedInfo, {
                      when: formatDateTime(p.deletedAt, locale, store.timeZone),
                      who: p.deletedBy ?? "—",
                    })}
                  {p.deletedReason ? ` · ${p.deletedReason}` : ""}
                  {p.deletedAt && (
                    <span className="text-rose-600">
                      {" "}
                      · {fill(tt.daysLeft, { n: daysLeft(p.deletedAt) })}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <form action={restoreProductAction} className="flex-1 sm:flex-none">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="storeId" value={storeId} />
                  <input type="hidden" name="productId" value={p.id} />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white transition active:scale-95"
                  >
                    <RotateCcw className="size-4" /> {tt.restore}
                  </button>
                </form>
                <ConfirmSubmit
                  action={purgeProductAction}
                  triggerLabel={tt.purge}
                  title={tt.purgeTitle}
                  message={fill(tt.purgeMessage, { name: p.name })}
                  confirmLabel={tt.purge}
                  cancelLabel={t.pos.cancel}
                  trigger={
                    <span className="flex items-center gap-1 px-1 text-sm font-medium">
                      <Trash2 className="size-4" /> {tt.purge}
                    </span>
                  }
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="storeId" value={storeId} />
                  <input type="hidden" name="productId" value={p.id} />
                </ConfirmSubmit>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
