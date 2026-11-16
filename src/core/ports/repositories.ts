// ===== Ports (interface) =====
// business logic คุยกับ interface เหล่านี้เท่านั้น
// เปลี่ยน DB = เขียน adapter ใหม่ใน src/adapters/** แล้วแก้ src/server/container.ts จุดเดียว

import type { ID, Product, Sale, StockMovement, Store, StoreMember, User } from "../domain/types";

export interface UserRepo {
  findById(id: ID): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  updateProfile(id: ID, patch: Partial<Pick<User, "displayName" | "locale" | "timeZone">>): Promise<User>;
  delete(id: ID): Promise<void>;
}

export interface StoreRepo {
  create(input: Omit<Store, "id" | "code" | "createdAt">): Promise<Store>;
  findById(id: ID): Promise<Store | null>;
  findByCode(code: string): Promise<Store | null>;
  listForUser(userId: ID): Promise<Array<{ store: Store; member: StoreMember }>>;
  getMember(storeId: ID, userId: ID): Promise<StoreMember | null>;
  addMember(input: Omit<StoreMember, "id" | "joinedAt">): Promise<StoreMember>;
  removeMember(storeId: ID, userId: ID): Promise<void>;
}

export interface ProductRepo {
  list(storeId: ID, q?: { search?: string; category?: string; lowStockOnly?: boolean }): Promise<Product[]>;
  findByBarcode(storeId: ID, barcode: string): Promise<Product | null>;
  create(input: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product>;
  update(storeId: ID, id: ID, patch: Partial<Product>): Promise<Product>;
  delete(storeId: ID, id: ID): Promise<void>;
}

export interface StockRepo {
  /** ต้องทำใน transaction: บันทึก movement + อัปเดต stockQty พร้อมกัน */
  move(input: Omit<StockMovement, "id" | "qtyBefore" | "qtyAfter" | "createdAt">): Promise<StockMovement>;
  history(storeId: ID, q?: { productId?: ID; from?: Date; to?: Date }): Promise<StockMovement[]>;
}

export interface SaleRepo {
  /** ต้องทำใน transaction: บันทึกบิล + ตัดสต็อกทุกรายการ */
  create(input: Omit<Sale, "id" | "receiptNo" | "createdAt">): Promise<Sale>;
  list(storeId: ID, q: { from: Date; to: Date }): Promise<Sale[]>;
  void(storeId: ID, id: ID, actorId: ID): Promise<Sale>;
}

export interface Repositories {
  users: UserRepo;
  stores: StoreRepo;
  products: ProductRepo;
  stock: StockRepo;
  sales: SaleRepo;
}
