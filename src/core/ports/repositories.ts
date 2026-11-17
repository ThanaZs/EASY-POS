// ===== Ports (interface) =====
// business logic คุยกับ interface เหล่านี้เท่านั้น
// เปลี่ยน DB = เขียน adapter ใหม่ใน src/adapters/** แล้วแก้ src/server/container.ts จุดเดียว

import type {
  CreateSaleResult,
  ID,
  ImportResult,
  ImportRow,
  PaymentMethod,
  Product,
  RedeemInviteResult,
  Sale,
  SaleHeader,
  SaleLineInput,
  StockMovement,
  Store,
  StoreInvite,
  StoreMember,
  StoreSettings,
  User,
  VoidSaleResult,
} from "../domain/types";

export interface UserRepo {
  findById(id: ID): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  updateProfile(id: ID, patch: Partial<Pick<User, "displayName" | "locale" | "timeZone">>): Promise<User>;
  /** มีรหัสผ่านไหม (สมัครด้วย Google อย่างเดียว = ไม่มี) */
  hasPassword(id: ID): Promise<boolean>;
  /**
   * ลบบัญชีถาวร — ใน transaction: ลบร้านที่เป็นเจ้าของ (พร้อมข้อมูลทั้งหมดของร้าน),
   * ล้างการอ้างอิงในร้านอื่น, แล้วลบผู้ใช้ (session/บัญชี login/การเป็นสมาชิก ลบตาม)
   */
  deleteAccount(id: ID): Promise<void>;
}

export type MemberWithUser = { member: StoreMember; user: Pick<User, "id" | "email" | "displayName"> };

export interface StoreRepo {
  /** ต้องทำใน transaction: สร้างร้าน + เพิ่มเจ้าของเป็นสมาชิก role=owner */
  createWithOwner(input: Pick<Store, "name" | "currency" | "timeZone" | "locale" | "ownerId">): Promise<Store>;
  findById(id: ID): Promise<Store | null>;
  findByCode(code: string): Promise<Store | null>;
  listForUser(userId: ID): Promise<Array<{ store: Store; member: StoreMember }>>;
  getMember(storeId: ID, userId: ID): Promise<StoreMember | null>;
  listMembers(storeId: ID): Promise<MemberWithUser[]>;
  removeMember(storeId: ID, userId: ID): Promise<void>;
  /** ลบร้านถาวร (เฉพาะเจ้าของ) — cascade: สินค้า, บิล, สต็อก, สมาชิก, รหัสเชิญ; คืน false ถ้าไม่ใช่เจ้าของ/ไม่พบ */
  deleteStore(storeId: ID, ownerId: ID): Promise<boolean>;
  createInvite(
    input: Pick<StoreInvite, "storeId" | "role" | "maxUses" | "expiresAt" | "createdBy">,
  ): Promise<StoreInvite>;
  listInvites(storeId: ID): Promise<StoreInvite[]>;
  /** ลบรหัสเชิญที่ยังไม่มีใครใช้ — คืน false ถ้าใช้ไปแล้ว/ไม่พบ */
  deleteUnusedInvite(storeId: ID, inviteId: ID): Promise<boolean>;
  updateSettings(storeId: ID, patch: StoreSettings): Promise<Store>;
  /** ต้องทำใน transaction: ตรวจรหัสเชิญ (หมดอายุ/ใช้ครบ) + เพิ่มสมาชิก + นับการใช้ */
  redeemInvite(code: string, userId: ID): Promise<RedeemInviteResult>;
}

export type ProductInput = Pick<
  Product,
  | "sku"
  | "barcode"
  | "name"
  | "category"
  | "subcategory"
  | "unit"
  | "packUnit"
  | "packSize"
  | "packPriceMinor"
  | "packBarcode"
  | "priceMinor"
  | "costMinor"
  | "lowStockThreshold"
  | "trackStock"
  | "expiresAt"
  | "note"
>;

/** hasNoSub = มีสินค้าในหมวดนี้ที่ไม่ได้ใส่หมวดย่อย */
export type CategoryNode = { category: string; subcategories: string[]; hasNoSub?: boolean };

export interface ProductRepo {
  /** subcategory: null = เฉพาะที่ไม่มีหมวดย่อย */
  list(
    storeId: ID,
    q?: { search?: string; category?: string; subcategory?: string | null; lowStockOnly?: boolean; pinnedOnly?: boolean },
  ): Promise<Product[]>;
  findById(storeId: ID, id: ID): Promise<Product | null>;
  categories(storeId: ID): Promise<string[]>;
  /** หมวดหลัก + หมวดย่อยที่เคยใช้ (ให้เลือกในฟอร์ม/กรองหน้าขาย) */
  categoryTree(storeId: ID): Promise<CategoryNode[]>;
  /** นำเข้าจากไฟล์ — บาร์โค้ดซ้ำ = อัปเดต, ไม่ซ้ำ/ไม่มีบาร์โค้ด = สร้างใหม่ (ใน transaction) */
  importRows(storeId: ID, rows: ImportRow[], actorId: ID, opts: { updateStock: boolean }): Promise<ImportResult>;
  /** สร้างสินค้า + (ถ้า initialQty > 0) บันทึกรับเข้าครั้งแรก — ใน transaction */
  create(storeId: ID, input: ProductInput, initialQty: number, actorId: ID): Promise<Product>;
  update(storeId: ID, id: ID, patch: Partial<ProductInput>): Promise<Product | null>;
  /** ลบแบบซ่อน (is_active=false) เพราะบิลเก่ายังอ้างถึง — คืน path รูปเดิม (ให้ลบไฟล์) */
  deactivate(storeId: ID, id: ID): Promise<string | null>;
  /** ตั้ง/ลบรูป — คืน path รูปเดิม (ให้ลบไฟล์) */
  setImage(storeId: ID, id: ID, path: string | null): Promise<string | null>;
  /** ปักหมุด/เลิกปักหมุด — คืนสินค้า (null = ไม่พบ) */
  setPinned(storeId: ID, id: ID, pinned: boolean): Promise<Product | null>;
}

export interface StockRepo {
  /** ต้องทำใน transaction: ล็อกแถวสินค้า + อัปเดต stockQty + บันทึก movement; qty เป็น +/- */
  move(input: {
    storeId: ID;
    productId: ID;
    type: "in" | "out" | "adjust";
    qty: number;
    note: string;
    actorId: ID;
  }): Promise<StockMovement | null>;
  history(storeId: ID, q?: { productId?: ID; limit?: number }): Promise<StockMovement[]>;
}

export interface DailySales {
  businessDate: string;
  count: number;
  totalMinor: number;
  costMinor: number;
}

export interface SaleRepo {
  /**
   * ต้องทำใน transaction: ล็อกสินค้า, ใช้ราคาจาก DB (ไม่เชื่อราคาจาก client), ตัดสต็อก,
   * ออกเลขใบเสร็จต่อวันของร้าน, บันทึกบิล + รายการ + movement
   */
  create(input: {
    storeId: ID;
    lines: SaleLineInput[];
    billDiscountMinor: number;
    paymentMethod: PaymentMethod;
    paidMinor: number | null; // null = จ่ายพอดี (QR/บัตร)
    cashierId: ID;
    timeZone: string;
    taxRateBp: number;
    taxIncluded: boolean;
    allowNegativeStock: boolean;
  }): Promise<CreateSaleResult>;
  get(storeId: ID, id: ID): Promise<Sale | null>;
  list(storeId: ID, q?: { limit?: number; businessDate?: string }): Promise<SaleHeader[]>;
  /** ต้องทำใน transaction: ล็อกบิล → status=voided → คืนสต็อกสินค้าที่นับสต็อก + movement "refund" */
  void(storeId: ID, id: ID, actorId: ID, reason: string): Promise<VoidSaleResult>;
  dailyTotals(storeId: ID, from: string, to: string): Promise<DailySales[]>;
}

/** คลังข้อมูลสินค้ากลาง (ทุกร้านใช้ร่วม) — ไม่มีราคา/สต็อก */
export type CatalogItem = {
  barcode: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  unit: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  source: "store" | "off" | "obf";
};

export interface CatalogRepo {
  get(barcode: string): Promise<CatalogItem | null>;
  /**
   * เพิ่ม/อัปเดตจากร้าน: ยังไม่มี → เพิ่ม; มีจากแหล่งภายนอก → แทนด้วยข้อมูลร้าน; มีจากร้านแล้ว → คงชื่อเดิม
   * รูป: เติมเฉพาะเมื่อยังไม่มีรูปในคลัง
   */
  contribute(items: Array<Pick<CatalogItem, "barcode" | "name" | "category" | "subcategory" | "unit">>): Promise<void>;
  /** เก็บผลจากแหล่งภายนอก (ไม่ทับข้อมูลที่มีอยู่) */
  saveExternal(item: CatalogItem): Promise<void>;
  /** ใส่รูปให้รายการที่ยังไม่มีรูป — คืน true ถ้าใส่ */
  setImageIfMissing(barcode: string, imagePath: string): Promise<boolean>;
}

/** { field: [ก่อน, หลัง] } */
export type AuditChanges = Record<string, [unknown, unknown]>;

export type AuditEntry = {
  id: ID;
  at: Date;
  actorId: ID | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string;
  changes: AuditChanges | null;
  note: string;
};

export interface AuditRepo {
  log(e: Omit<AuditEntry, "id" | "at"> & { storeId: ID }): Promise<void>;
  list(storeId: ID, q?: { limit?: number; entityId?: string; before?: Date }): Promise<AuditEntry[]>;
}

export interface Repositories {
  audit: AuditRepo;
  catalog: CatalogRepo;
  users: UserRepo;
  stores: StoreRepo;
  products: ProductRepo;
  stock: StockRepo;
  sales: SaleRepo;
}
