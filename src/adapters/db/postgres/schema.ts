// Drizzle schema — ใช้ได้กับ Postgres ทุกเจ้า (Supabase, Neon, RDS, Cloud SQL, Docker local)
// กติกา: id = uuid, เวลา = timestamptz (UTC), เงิน = bigint หน่วยย่อย, ทุกตารางธุรกิจมี store_id (multi-tenant)
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: "number" }).notNull().default(0);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  displayName: text("display_name").notNull(),
  image: text("image"),
  locale: text("locale").notNull().default("th"),
  timeZone: text("time_zone").notNull().default("Asia/Bangkok"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ===== ตารางของ Better Auth (session / บัญชี OAuth / token ยืนยัน) =====
export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const accounts = pgTable("accounts", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(), // "credential" | "google" ...
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"), // hash
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const verifications = pgTable("verifications", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const stores = pgTable("stores", {
  id: id(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  currency: text("currency").notNull().default("THB"),
  timeZone: text("time_zone").notNull().default("Asia/Bangkok"),
  locale: text("locale").notNull().default("th"),
  taxRateBp: integer("tax_rate_bp").notNull().default(0), // 700 = 7%
  taxIncluded: boolean("tax_included").notNull().default(true),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  receiptFooter: text("receipt_footer").notNull().default(""),
  allowNegativeStock: boolean("allow_negative_stock").notNull().default(false),
  createdAt: createdAt(),
});

export const storeMembers = pgTable(
  "store_members",
  {
    id: id(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "manager", "cashier", "staff"] }).notNull(),
    permissions: jsonb("permissions").notNull().default({}),
    status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("store_members_store_user").on(t.storeId, t.userId)],
);

export const storeInvites = pgTable("store_invites", {
  id: id(),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  role: text("role", { enum: ["manager", "cashier", "staff"] }).notNull().default("staff"),
  permissions: jsonb("permissions").notNull().default({}),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: createdAt(),
});

export const products = pgTable(
  "products",
  {
    id: id(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    sku: text("sku"),
    barcode: text("barcode"),
    name: text("name").notNull(),
    category: text("category"),
    subcategory: text("subcategory"),
    unit: text("unit").notNull().default("pcs"), // หน่วยขายปลีก = หน่วยนับสต็อก (ชิ้น)
    // ขายยกแพ็ก/ลัง (ไม่บังคับ): 1 packUnit = packSize unit
    packUnit: text("pack_unit"),
    packSize: integer("pack_size"),
    packPriceMinor: bigint("pack_price_minor", { mode: "number" }), // null = ราคาชิ้น × packSize
    packBarcode: text("pack_barcode"),
    priceMinor: money("price_minor"),
    costMinor: money("cost_minor"),
    stockQty: integer("stock_qty").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    trackStock: boolean("track_stock").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    imagePath: text("image_path"), // path ใน storage (ไม่ใช่ URL — ย้ายผู้ให้บริการได้)
    isActive: boolean("is_active").notNull().default(true),
    note: text("note").notNull().default(""), // หมายเหตุสินค้า (ใช้ภายในร้าน)
    pinned: boolean("pinned").notNull().default(false), // ปักหมุด: แสดงก่อนในคลัง/หน้าขาย
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_store_barcode").on(t.storeId, t.barcode),
    uniqueIndex("products_store_pack_barcode").on(t.storeId, t.packBarcode),
    index("products_store_name").on(t.storeId, t.name),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: id(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(), // snapshot
    type: text("type", { enum: ["in", "out", "sale", "refund", "adjust"] }).notNull(),
    qty: integer("qty").notNull(),
    qtyBefore: integer("qty_before").notNull(),
    qtyAfter: integer("qty_after").notNull(),
    note: text("note").notNull().default(""),
    refSaleId: uuid("ref_sale_id"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    // ข้อมูลการซื้อ (เฉพาะรับเข้า — ใส่หรือไม่ใส่ก็ได้)
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }), // ราคาซื้อต่อหน่วยปลีก
    supplier: text("supplier"), // ซื้อจากไหน
    lotNo: text("lot_no"), // ลอต
    purchasedOn: date("purchased_on", { mode: "string" }), // วันที่ซื้อ (YYYY-MM-DD)
    createdAt: createdAt(),
  },
  (t) => [
    index("stock_movements_store_time").on(t.storeId, t.createdAt),
    index("stock_movements_product_time").on(t.storeId, t.productId, t.createdAt),
  ],
);

export const customers = pgTable("customers", {
  id: id(),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  points: integer("points").notNull().default(0),
  createdAt: createdAt(),
});

export const sales = pgTable(
  "sales",
  {
    id: id(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    receiptNo: text("receipt_no").notNull(),
    subtotalMinor: money("subtotal_minor"),
    discountMinor: money("discount_minor"),
    taxMinor: money("tax_minor"),
    totalMinor: money("total_minor"),
    paidMinor: money("paid_minor"),
    changeMinor: money("change_minor"),
    paymentMethod: text("payment_method", { enum: ["cash", "qr", "card", "transfer", "other"] }).notNull(),
    status: text("status", { enum: ["completed", "voided", "refunded"] }).notNull().default("completed"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id, { onDelete: "set null" }),
    voidReason: text("void_reason"),
    cashierId: uuid("cashier_id").references(() => users.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    businessDate: text("business_date").notNull(), // YYYY-MM-DD ตามทามโซนร้าน
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("sales_store_receipt").on(t.storeId, t.receiptNo),
    index("sales_store_date").on(t.storeId, t.businessDate),
  ],
);

export const saleItems = pgTable("sale_items", {
  id: id(),
  saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  qty: integer("qty").notNull(), // จำนวนตามหน่วยที่ขาย (ชิ้น หรือ ลัง)
  baseQty: integer("base_qty"), // จำนวนที่ตัดสต็อกจริง (ชิ้น) — null = เท่ากับ qty (บิลเก่า)
  unitPriceMinor: money("unit_price_minor"),
  costMinor: money("cost_minor"),
  discountMinor: money("discount_minor"),
});

export const expenses = pgTable("expenses", {
  id: id(),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  amountMinor: money("amount_minor"),
  note: text("note").notNull().default(""),
  spentAt: timestamp("spent_at", { withTimezone: true }).notNull().defaultNow(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// บันทึกการแก้ไข: ใคร ทำอะไร กับอะไร เปลี่ยนจากอะไรเป็นอะไร เมื่อไร
// details = { actorName, entityName, changes: { field: [ก่อน, หลัง] }, note }
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_store_time").on(t.storeId, t.createdAt)],
);

// ===== คลังข้อมูลสินค้ากลาง (ใช้ร่วมทุกร้าน) =====
// บาร์โค้ด → ชื่อ/หมวด/หน่วย/รูป สำหรับกรอกให้อัตโนมัติตอนเพิ่มสินค้า
// เก็บเฉพาะข้อมูลทั่วไปของสินค้า — ไม่มีราคา/ต้นทุน/สต็อก/ร้านไหนเพิ่ม (ไม่ผูก store_id โดยตั้งใจ)
export const catalogItems = pgTable("catalog_items", {
  barcode: text("barcode").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand"),
  category: text("category"),
  subcategory: text("subcategory"),
  unit: text("unit"),
  imagePath: text("image_path"), // รูปใน storage ของเรา (catalog/...)
  imageUrl: text("image_url"), // รูปต้นทางภายนอก (Open Food Facts) — ยังไม่ได้คัดลอกมา
  source: text("source").notNull(), // "store" | "off" | "obf"
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
