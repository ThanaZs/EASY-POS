# สถาปัตยกรรม EASY-POS

## เป้าหมาย
1. **ตอนนี้ใช้ฟรี**: Vercel (Hobby) + Supabase (Free)
2. **ย้ายได้ทุกเมื่อ**: เปลี่ยนที่ deploy / ฐานข้อมูล / backend โดยแก้น้อยที่สุด
3. หลายภาษา, หลายทามโซน, หลายสกุลเงิน, หลายร้านต่อหนึ่งบัญชี
4. ใช้ได้ทั้งมือถือและคอม (responsive; อนาคตทำ PWA สำหรับใช้ offline)

## โครงสร้างแบบชั้น (Ports & Adapters)

```
src/
├─ core/                 ← ธุรกิจล้วน ไม่ผูกกับ framework/DB ใดๆ
│  ├─ domain/            types, สิทธิ์ (permissions), คำนวณบิล (sale)
│  ├─ ports/             interface ของ repository (สัญญาว่า DB ต้องทำอะไรได้)
│  └─ lib/               format เงิน/วันที่ตามภาษาและทามโซน
├─ adapters/             ← ตัวเชื่อมกับของภายนอก (เปลี่ยนได้)
│  └─ db/postgres/       Drizzle schema + client + repositories
├─ server/               ← ฝั่ง server ของแอป
│  ├─ env.ts             อ่าน/ตรวจ environment variables
│  └─ container.ts       ★ จุดเดียวที่เลือก adapter (DB_DRIVER)
├─ i18n/                 ภาษา: config.ts + messages/<lang>.json
├─ components/           UI ที่ใช้ซ้ำ
├─ proxy.ts              (Next 16 เรียก middleware ว่า proxy) เลือกภาษา + redirect
└─ app/
   ├─ [locale]/(auth)/login, register     หน้า 1: เข้าสู่ระบบ/สมัคร
   ├─ [locale]/hub/...                    หน้า 2: สร้างร้าน / ร้านของฉัน / เข้าร่วมร้าน / บัญชี / ออก
   ├─ [locale]/store/[storeId]/           หน้า 3: เมนูในร้าน (ระบบขาย, คลังสินค้า, ภาพรวม ...)
   │   └─ [module]/                       placeholder ของแต่ละเมนู
   └─ api/                                REST endpoints (เช่น /api/health)
```

**กฎสำคัญ**
- `core/` ห้าม import จาก `next`, `drizzle`, `@/adapters` — ทำให้ย้าย logic ไป backend แยก (Hono/Express/Workers) ได้ทั้งก้อน
- UI/route เรียกข้อมูลผ่าน `getRepositories()` เท่านั้น ไม่เรียก DB ตรง
- จะย้ายจาก Next.js API ไปเป็น backend แยก: สร้าง adapter `http-api` ที่ implement `Repositories` แล้วยิง REST ไป backend ใหม่ — UI ไม่ต้องแก้

## ฐานข้อมูล — ทำไมเลือก PostgreSQL (Supabase)

| ตัวเลือก | ข้อดี | ข้อเสีย | สรุป |
|---|---|---|---|
| **Supabase (Postgres)** | ฟรี 500MB, มี Auth/Storage, SQL มาตรฐาน, SmartStock เดิมก็ Postgres | โปรเจกต์ฟรีถูก pause ถ้าไม่มีการใช้งาน 7 วัน (กด resume ได้) | ✅ **แนะนำ** |
| Neon (Postgres) | ฟรี, ไม่ถูก pause (scale-to-zero), branch DB ได้ | ไม่มี Auth/Storage ในตัว | สำรองที่ดี — เปลี่ยนแค่ `DATABASE_URL` |
| Firebase Firestore | realtime, offline ดี | NoSQL — รายงานยอดขาย/JOIN/transaction ตัดสต็อกทำยาก, lock-in สูง | ❌ ไม่เหมาะกับ POS ที่ต้องทำรายงาน |

เพราะใช้ **Postgres มาตรฐาน + Drizzle** ไม่ใช้ฟีเจอร์เฉพาะของ Supabase ในโค้ดธุรกิจ → ย้ายไป Neon/RDS/Cloud SQL/Docker ได้ด้วยการ `pg_dump` แล้วเปลี่ยน `DATABASE_URL`

### กติกาข้อมูล
- `id` เป็น UUID (ไม่ใช้เลขรันนิ่ง) → รองรับการ merge/sync และ offline ในอนาคต
- เวลาเก็บเป็น `timestamptz` (UTC) เสมอ แสดงผลด้วยทามโซนของร้าน/ผู้ใช้ (`core/lib/format.ts`)
- ยอดขายรายวันใช้ `sales.business_date` ที่คำนวณจากทามโซนของร้าน (ร้านที่ญี่ปุ่นตัดรอบตามเวลาญี่ปุ่น)
- เงินเก็บเป็นจำนวนเต็มหน่วยย่อย (`*_minor`, สตางค์) ห้ามใช้ float
- ทุกตารางธุรกิจมี `store_id` (multi-tenant) และทุก query ต้องกรองด้วย `store_id`
- ตัดสต็อกทุกครั้งต้องบันทึก `stock_movements` ใน transaction เดียวกัน (สืบทอดจาก SmartStock)

ตารางทั้งหมด: `src/adapters/db/postgres/schema.ts`

## Auth {#auth}
ใช้ **Better Auth** — เก็บ user/session ใน Postgres ของเราเอง (ตาราง `users`, `sessions`, `accounts`, `verifications`) จึงไม่ผูกกับผู้ให้บริการ
- `src/server/auth.ts` — ตั้งค่า Better Auth (email+password, Google ถ้าใส่ env ครบ, id เป็น uuid)
- `src/server/session.ts` — **หน้าเว็บเรียกผ่านไฟล์นี้เท่านั้น**: `getSessionUser()`, `requireUser(locale)`, `requireStoreAccess(locale, storeId, permission?)`
- `src/app/api/auth/[...all]` — endpoint ของ Better Auth (callback Google)
- ล็อกอิน/สมัคร/ออก ทำผ่าน server action ใน `src/app/[locale]/(auth)/actions.ts`
- ทุกหน้าใต้ `/hub` และ `/store/[storeId]` เช็กสิทธิ์ฝั่ง server (ไม่ใช่แค่ซ่อนปุ่ม) — พิมพ์ URL ตรงก็เข้าไม่ได้
- เปลี่ยนผู้ให้บริการ auth (เช่น Supabase Auth/Clerk): แก้ `auth.ts` + `session.ts` + `actions.ts`

## เข้าร่วมร้าน
เจ้าของ/ผู้จัดการสร้าง **รหัสเชิญ** (8 ตัว, กำหนดบทบาท/จำนวนครั้ง/วันหมดอายุ) ที่เมนู **พนักงาน** → คนที่ได้รหัสไปที่ hub > เข้าร่วมร้านค้า
`redeemInvite` ทำใน transaction + `SELECT ... FOR UPDATE` กันใช้รหัสเกินจำนวน; ผู้จัดการเชิญ/ลบผู้จัดการคนอื่นไม่ได้

## สิทธิ์ผู้ใช้ในร้าน
บทบาท `owner / manager / cashier / staff` + override รายสิทธิ์ได้ (ดู `core/domain/permissions.ts`)
ต่อยอดจากระบบ owner/manager/employee + permissions jsonb ของ SmartStock

## หลายภาษา
- URL มีภาษานำหน้า: `/th/...`, `/en/...`
- `proxy.ts` เลือกภาษาจาก cookie `locale` → `Accept-Language` → ค่าเริ่มต้น `th`
- เพิ่มภาษา: เพิ่มโค้ดใน `src/i18n/config.ts` + คัดลอก `messages/en.json` เป็น `messages/<code>.json` + เพิ่มใน `dictionary.ts`
