import { Alert, pickMessage } from "@/components/Alert";
import { Card, Field, PrimaryButton } from "@/components/Field";
import type { Product, Store } from "@/core/domain/types";
import { minorToInput } from "@/core/lib/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { saveProductAction } from "./actions";
import { BarcodeField } from "./BarcodeField";
import { ProductPhotoField } from "./ProductPhotoField";

/** ฟอร์มเดียวใช้ทั้งเพิ่มและแก้ไขสินค้า */
export function ProductForm({
  locale,
  t,
  store,
  product,
  categories,
  error,
  photoEnabled,
  photoUrl,
}: {
  locale: Locale;
  t: Dictionary;
  store: Store;
  product?: Product;
  categories: string[];
  error?: unknown;
  photoEnabled: boolean;
  photoUrl: string | null;
}) {
  const msg = pickMessage(t.inventory.errors, error);
  const money = (v?: number) => (v === undefined ? "" : minorToInput(v, store.currency));
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
        <BarcodeField label={t.inventory.barcode} defaultValue={product?.barcode ?? ""} scan={t.scan} devices={t.devices} />
        <div className="sm:col-span-2">
          <Field label={t.inventory.name} name="name" defaultValue={product?.name} maxLength={120} required />
        </div>
        {photoEnabled && <ProductPhotoField currentUrl={photoUrl} t={t.photo} noCamera={t.scan.noCamera} />}
        <Field
          label={`${t.inventory.price} (${store.currency})`}
          name="price"
          inputMode="decimal"
          defaultValue={money(product?.priceMinor)}
          placeholder="0"
          required
        />
        <Field
          label={`${t.inventory.cost} (${store.currency})`}
          name="cost"
          inputMode="decimal"
          defaultValue={money(product?.costMinor)}
          placeholder="0"
        />
        <Field label={t.inventory.sku} name="sku" defaultValue={product?.sku ?? ""} maxLength={60} autoComplete="off" />
        <Field
          label={t.inventory.category}
          name="category"
          defaultValue={product?.category ?? ""}
          list="categories"
          maxLength={60}
          autoComplete="off"
        />
        <datalist id="categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Field label={t.inventory.unit} name="unit" defaultValue={product?.unit ?? "pcs"} maxLength={20} />
        {!product && (
          <Field label={t.inventory.initialStock} name="initialQty" type="number" min={0} defaultValue={0} inputMode="numeric" />
        )}
        <Field
          label={t.inventory.lowThreshold}
          name="lowStockThreshold"
          type="number"
          min={0}
          defaultValue={product?.lowStockThreshold ?? store.lowStockThreshold}
          inputMode="numeric"
        />
        <Field
          label={t.inventory.expiresAt}
          name="expiresAt"
          type="date"
          defaultValue={product?.expiresAt ? product.expiresAt.toISOString().slice(0, 10) : ""}
        />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="trackStock" defaultChecked={product?.trackStock ?? true} className="size-4" />
          {t.inventory.trackStock}
        </label>
        <div className="sm:col-span-2">
          <PrimaryButton type="submit">{t.inventory.save}</PrimaryButton>
        </div>
      </form>
    </Card>
  );
}
