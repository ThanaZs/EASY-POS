// ===== Core domain =====
// ห้าม import Next.js / DB / framework ใดๆ ในโฟลเดอร์ core
// เพื่อให้ย้าย backend ไปที่ไหนก็ได้ (Next API, Hono, Express, Cloudflare Workers ...)

export type ID = string; // UUID — ไม่ใช้ auto-increment เพื่อรองรับหลาย DB/การ sync offline

/** เงินเก็บเป็นหน่วยย่อยที่สุด (สตางค์/เซนต์) เป็นจำนวนเต็ม — ห้ามใช้ float */
export type Money = { amountMinor: number; currency: string };

export type Role = "owner" | "manager" | "cashier" | "staff";

export const PERMISSIONS = [
  "pos.sell",
  "pos.refund",
  "pos.discount",
  "products.view",
  "products.create",
  "products.edit",
  "products.delete",
  "stock.receive",
  "stock.issue",
  "stock.history",
  "reports.view",
  "expenses.manage",
  "customers.manage",
  "staff.manage",
  "store.settings",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface User {
  id: ID;
  email: string;
  displayName: string;
  locale: string; // "th" | "en" | ...
  timeZone: string; // IANA เช่น "Asia/Bangkok"
  createdAt: Date;
}

export interface Store {
  id: ID;
  name: string;
  code: string; // รหัสร้านสำหรับเข้าร่วม
  ownerId: ID;
  currency: string; // ISO 4217 เช่น THB
  timeZone: string; // ทามโซนของร้าน ใช้ตัดรอบยอดขายรายวัน
  locale: string;
  taxRateBp: number; // 700 = 7%
  taxIncluded: boolean; // ราคาสินค้ารวม VAT แล้ว
  lowStockThreshold: number;
  receiptFooter: string; // ข้อความท้ายใบเสร็จ
  allowNegativeStock: boolean; // ขายได้แม้สต็อกไม่พอ
  createdAt: Date;
}

export type StoreSettings = Pick<
  Store,
  "name" | "timeZone" | "taxRateBp" | "taxIncluded" | "lowStockThreshold" | "receiptFooter" | "allowNegativeStock"
>;

export interface StoreMember {
  id: ID;
  storeId: ID;
  userId: ID;
  role: Role;
  permissions: Partial<Record<Permission, boolean>>; // override ค่าเริ่มต้นของ role
  status: "active" | "suspended";
  joinedAt: Date;
}

export interface StoreInvite {
  id: ID;
  storeId: ID;
  code: string;
  role: Exclude<Role, "owner">;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  createdBy: ID | null;
  createdAt: Date;
}

export type RedeemInviteResult =
  | { ok: true; storeId: ID }
  | { ok: false; reason: "not_found" | "expired" | "used_up" | "already_member" };

export interface Product {
  id: ID;
  storeId: ID;
  sku: string | null;
  barcode: string | null;
  name: string;
  category: string | null;
  unit: string; // ชิ้น, กล่อง, kg ...
  priceMinor: number;
  costMinor: number;
  stockQty: number; // จำนวนคงเหลือ (denormalized จาก stock_movements)
  lowStockThreshold: number;
  trackStock: boolean;
  expiresAt: Date | null;
  imagePath: string | null; // รูปสินค้าใน storage
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type StockMovementType = "in" | "out" | "sale" | "refund" | "adjust";

export interface StockMovement {
  id: ID;
  storeId: ID;
  productId: ID | null; // null = สินค้าถูกลบไปแล้ว
  productName: string; // snapshot
  type: StockMovementType;
  qty: number; // + หรือ -
  qtyBefore: number;
  qtyAfter: number;
  note: string;
  refSaleId: ID | null;
  actorId: ID | null;
  createdAt: Date;
}

export type PaymentMethod = "cash" | "qr" | "card" | "transfer" | "other";

export interface SaleItem {
  productId: ID | null;
  name: string; // snapshot ชื่อ ณ เวลาขาย
  qty: number;
  unitPriceMinor: number;
  costMinor: number; // ต้นทุนต่อหน่วย ณ เวลาขาย (ใช้คิดกำไร)
  discountMinor: number;
}

export interface Sale {
  id: ID;
  storeId: ID;
  receiptNo: string;
  items: SaleItem[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  changeMinor: number;
  paymentMethod: PaymentMethod;
  status: "completed" | "voided" | "refunded";
  cashierId: ID | null;
  customerId: ID | null;
  businessDate: string; // YYYY-MM-DD ตามทามโซนร้าน
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date; // UTC
}

/** บิลแบบไม่มีรายการสินค้า (ใช้ในหน้ารายการ) */
export type SaleHeader = Omit<Sale, "items">;

export type SaleLineInput = { productId: ID; qty: number };

export type CreateSaleResult =
  | { ok: true; sale: Sale }
  | {
      ok: false;
      reason: "empty" | "product_not_found" | "insufficient_stock" | "insufficient_payment";
      productName?: string;
    };

export type VoidSaleResult = { ok: true } | { ok: false; reason: "not_found" | "already_voided" };
