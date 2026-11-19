import { ChevronDown } from "lucide-react";
import { Alert, pickMessage } from "@/components/Alert";
import { Field, PrimaryButton } from "@/components/Field";
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
import { UnitField } from "./UnitField";

const BASE_UNITS = ["ชิ้น", "อัน", "ขวด", "กล่อง", "ถุง", "ซอง", "แพ็ก", "เส้น", "เมตร", "กก."];
const PACK_UNITS = ["ลัง", "แพ็ก", "โหล", "กล่อง", "มัด", "ถุง"];
const merge = (base: string[], used: string[]) => [...new Set([...base, ...used])];

/**
 * ฟอร์มเดียวใช้ทั้งเพิ่มและแก้ไขสินค้า — ออกแบบให้มือถือเห็นช่องหลักครบในจอเดียว:
 * รูป+ชื่อ / บาร์โค้ด-รหัส / ราคา-ทุน / หมวด / จำนวน-แจ้งเตือน / [ตัวเลือกเพิ่มเติม ▾] / บันทึก (ติดล่างจอ)
 * ช่องที่ใช้น้อย (หน่วย, ขายยกลัง, วันหมดอายุ, หมายเหตุ, นับสต็อก) พับไว้ใน "ตัวเลือกเพิ่มเติม"
 * SKU รวมกับช่องบาร์โค้ดแล้ว (ค่า SKU เดิมเก็บไว้ใน hidden ไม่หาย)
 */
export function ProductForm({
  locale,
  t,
  store,
  product,
  categoryTree,
  units,
  error,
  photoEnabled,
  photoUrl,
}: {
  locale: Locale;
  t: Dictionary;
  store: Store;
  product?: Product;
  categoryTree: CategoryNode[];
  units: { units: string[]; packUnits: string[] };
  error?: unknown;
  photoEnabled: boolean;
  photoUrl: string | null;
}) {
  const msg = pickMessage(t.inventory.errors, error);
  const money = (v?: number | null) =>
    v === undefined || v === null ? "" : minorToInput(v, store.currency);
  const inv = t.inventory;
  // เปิด "ตัวเลือกเพิ่มเติม" ไว้เลยถ้าสินค้านี้ใช้ค่าในนั้นอยู่
  const moreOpen =
    !!product &&
    (!!product.packSize ||
      !!product.expiresAt ||
      !!product.note ||
      product.unit !== "ชิ้น" ||
      !product.trackStock);
  return (
    <form
      action={saveProductAction}
      className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm sm:gap-4 sm:p-6"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="storeId" value={store.id} />
      {product && <input type="hidden" name="productId" value={product.id} />}
      <input type="hidden" name="sku" value={product?.sku ?? ""} />
      {msg && (
        <div className="col-span-2">
          <Alert>{msg}</Alert>
        </div>
      )}
      {/* รูป + ชื่อ (บนสุด) */}
      <div className="col-span-2 flex items-center gap-3">
        {photoEnabled && (
          <ProductPhotoField
            currentUrl={photoUrl}
            t={t.photo}
            noCamera={t.scan.noCamera}
          />
        )}
        <div className="min-w-0 flex-1">
          <Field
            label={inv.name}
            name="name"
            defaultValue={product?.name}
            maxLength={120}
            required
          />
        </div>
      </div>
      <BarcodeField
        label={inv.codeLabel}
        genLabel={inv.genCode}
        defaultValue={product?.barcode ?? product?.sku ?? ""}
        scan={t.scan}
        devices={t.devices}
        lookup={
          product ? undefined : { locale, storeId: store.id, t: t.catalog }
        }
      />
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
      {product ? (
        <Field
          label={inv.currentStock}
          name="stockQty"
          type="number"
          defaultValue={product.stockQty}
          inputMode="numeric"
          title={inv.currentStockHint}
        />
      ) : (
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

      {/* ตัวเลือกเพิ่มเติม (พับไว้) — ช่องข้างในยังส่งไปกับฟอร์มแม้พับอยู่ */}
      <details
        open={moreOpen}
        className="group col-span-2 rounded-xl border border-line"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5">
          <span className="font-medium">{inv.more}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted">
            {inv.moreHint}
          </span>
          <ChevronDown className="size-5 shrink-0 text-muted transition group-open:rotate-180" />
        </summary>
        <div className="grid grid-cols-2 gap-3 border-t border-line p-3">
          <UnitField
            name="unit"
            label={inv.unit}
            defaultValue={product?.unit ?? "ชิ้น"}
            options={merge(BASE_UNITS, units.units)}
            addNew={inv.addUnit}
            newPlaceholder={inv.newUnitPlaceholder}
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
          <PackFields
            baseUnit={product?.unit ?? "ชิ้น"}
            currency={store.currency}
            unitOptions={merge(PACK_UNITS, units.packUnits)}
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
              packPriceAuto: inv.packPriceAuto,
              packBarcode: inv.packBarcode,
              addUnit: inv.addUnit,
              newUnitPlaceholder: inv.newUnitPlaceholder,
            }}
          />
          <div className="col-span-2">
            <Field
              label={inv.note}
              name="note"
              defaultValue={product?.note ?? ""}
              maxLength={500}
              placeholder={inv.notePlaceholder}
              autoComplete="off"
            />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="trackStock"
              defaultChecked={product?.trackStock ?? true}
              className="size-4"
            />
            {inv.trackStock}
          </label>
        </div>
      </details>

      {/* ปุ่มบันทึกติดล่างจอเสมอ (มือถือไม่ต้องเลื่อนหา) */}
      <div className="sticky bottom-0 col-span-2 -mx-4 -mb-4 rounded-b-2xl border-t border-line bg-card/95 p-3 backdrop-blur sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0">
        <PrimaryButton type="submit">{inv.save}</PrimaryButton>
      </div>
    </form>
  );
}
