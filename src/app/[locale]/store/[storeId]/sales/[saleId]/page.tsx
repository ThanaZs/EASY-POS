import { notFound } from "next/navigation";
import { Alert } from "@/components/Alert";
import { can } from "@/core/domain/permissions";
import { formatDateTime } from "@/core/lib/format";
import { loadLocale } from "@/i18n/page";
import { getRepositories } from "@/server/container";
import { requireStoreAccess } from "@/server/session";
import { BackLink } from "../../BackLink";
import { Receipt } from "../../pos/Receipt";
import { PrintButton } from "../PrintButton";
import { VoidForm } from "../VoidForm";

export default async function SaleDetailPage({ params, searchParams }: PageProps<"/[locale]/store/[storeId]/sales/[saleId]">) {
  const { locale, t } = await loadLocale(params);
  const { storeId, saleId } = await params;
  const { store, member } = await requireStoreAccess(locale, storeId, "reports.view");
  if (!/^[0-9a-f-]{36}$/i.test(saleId)) notFound();
  const repos = await getRepositories();
  const sale = await repos.sales.get(storeId, saleId);
  if (!sale) notFound();
  const cashier = sale.cashierId ? await repos.users.findById(sale.cashierId) : null;
  const voided = sale.status !== "completed";

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <div className="print:hidden">
        <BackLink href={`/${locale}/store/${storeId}/sales?date=${sale.businessDate}`} label={t.store.modules.sales} />
      </div>
      {(await searchParams).voided === "1" && (
        <div className="print:hidden">
          <Alert kind="success">{t.sales.voidDone}</Alert>
        </div>
      )}
      <div className="rounded-2xl bg-white p-5 shadow-sm print:p-0 print:shadow-none">
        <Receipt
          r={{ ...sale, createdAt: sale.createdAt.toISOString() }}
          t={t.pos}
          locale={locale}
          currency={store.currency}
          timeZone={store.timeZone}
          storeName={store.name}
          cashierName={cashier?.displayName}
          footer={store.receiptFooter}
          voidedLabel={voided ? t.sales.voided : null}
        />
      </div>
      {voided && sale.voidedAt && (
        <p className="text-sm text-muted print:hidden">
          {t.sales.voidedAt} {formatDateTime(sale.voidedAt, locale, store.timeZone)}
          {sale.voidReason ? ` · ${sale.voidReason}` : ""}
        </p>
      )}
      <div className="space-y-2 print:hidden">
        <PrintButton label={t.pos.print} />
        {!voided && can(member, "pos.refund") && (
          <VoidForm
            locale={locale}
            storeId={storeId}
            saleId={sale.id}
            labels={{ void: t.sales.void, reason: t.sales.voidReason, confirm: t.sales.voidConfirm, cancel: t.pos.cancel }}
          />
        )}
      </div>
    </div>
  );
}
