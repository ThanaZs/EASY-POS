import { Alert, pickMessage } from "@/components/Alert";
import { Card, Field, PrimaryButton } from "@/components/Field";
import type { Product, Store } from "@/core/domain/types";
import { minorToInput } from "@/core/lib/format";
import type { CategoryNode } from "@/core/ports/repositories";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { saveProductAction } from "./actions";
import { BarcodeField } from "./BarcodeField";
import { CategoryPicker } from "./CategoryPicker";
import { PackFields } from "./PackFields";
import { ProductPhotoField } from "./ProductPhotoField";

/** ฟอร์มเดียวใช้ทั้งเพิ่มและแก้ไขสินค้า */
export function ProductForm({
  locale,
  t,
  store,
  product,
  categoryTree,
  error,
  photoEnabled,
  photoUrl,
}: {
  locale: Locale;
  t: Dictionary;
  store: Store;
  product?: Product;
  categoryTree: CategoryNode[];
  error?: unknown;
  photoEnabled: boolean;
  photoUrl: string | null;
}) {
  const msg = pickMessage(t.inventory.errors, error);
  const money = (v?: number | null) =>
    v === undefined || v === null ? "" : minorToInput(v, store.currency);
  const inv = t.inventory;
  return (
    <Card>
      <form action={saveProductAction} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="storeId" value={store.id} />
        {product && <input type="hidden" name="productId" value={product.id} />}
        {msg && (
          <div className="sm:col-span-2">
            <Alert>{msg}</Alert>
          </div>
        )}
        {/* บาร์โค้ดอยู่บนสุด: ยิงเครื่องสแกนได้ทันทีที่เปิดฟอร์ม */}
        <BarcodeField
          label={inv.barcode}
          defaultValue={product?.barcode ?? ""}
          scan={t.scan}
          devices={t.devices}
          lookup={
            product ? undefined : { locale, storeId: store.id, t: t.catalog }
          }
        />
        <div className="sm:col-span-2">
          <Field
            label={inv.name}
            name="name"
            defaultValue={product?.name}
            maxLength={120}
            required
          />
        </div>
        {photoEnabled && (
          <ProductPhotoField
            currentUrl={photoUrl}
            t={t.photo}
            noCamera={t.scan.noCamera}
          />
        )}
        <Field
          label={`${inv.price} (${store.currency})`}
          name="price"
          inputMode="decimal"
          defaultValue={money(product?.priceMinor)}
          placeholder="0"
          required
        />
        <Field
          label={`${inv.cost} (${store.currency})`}
          name="cost"
          inputMode="decimal"
          defaultValue={money(product?.costMinor)}
          placeholder="0"
        />
        <CategoryPicker
          tree={categoryTree}
          defaultCategory={product?.category ?? null}
          defaultSubcategory={product?.subcategory ?? null}
          labels={{
            category: inv.category,
            subcategory: inv.subcategory,
            none: inv.noCategory,
            addNew: inv.addCategory,
            newPlaceholder: inv.newCategoryPlaceholder,
          }}
        />
        <Field
          label={inv.unit}
          name="unit"
          defaultValue={product?.unit ?? "ชิ้น"}
          maxLength={20}
        />
        <Field
          label={inv.sku}
          name="sku"
          defaultValue={product?.sku ?? ""}
          maxLength={60}
          autoComplete="off"
        />
        <PackFields
          baseUnit={product?.unit ?? "ชิ้น"}
          currency={store.currency}
          defaults={{
            packUnit: product?.packUnit ?? null,
            packSize: product?.packSize ?? null,
            packPrice: money(product?.packPriceMinor),
            packBarcode: product?.packBarcode ?? null,
          }}
          labels={{
            enable: inv.packEnable,
            hint: inv.packHint,
            packUnit: inv.packUnit,
            packSize: inv.packSize,
            packPrice: inv.packPrice,
            packPriceHint: inv.packPriceHint,
            packBarcode: inv.packBarcode,
          }}
        />
        {!product && (
          <Field
            label={inv.initialStock}
            name="initialQty"
            type="number"
            min={0}
            defaultValue={0}
            inputMode="numeric"
          />
        )}
        <Field
          label={inv.lowThreshold}
          name="lowStockThreshold"
          type="number"
          min={0}
          defaultValue={product?.lowStockThreshold ?? store.lowStockThreshold}
          inputMode="numeric"
        />
        <Field
          label={inv.expiresAt}
          name="expiresAt"
          type="date"
          defaultValue={
            product?.expiresAt
              ? product.expiresAt.toISOString().slice(0, 10)
              : ""
          }
        />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="trackStock"
            defaultChecked={product?.trackStock ?? true}
            className="size-4"
          />
          {inv.trackStock}
        </label>
        <div className="sm:col-span-2">
          <PrimaryButton type="submit">{inv.save}</PrimaryButton>
        </div>
      </form>
    </Card>
  );
}
