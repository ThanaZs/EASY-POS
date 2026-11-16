# แผนงาน

## Phase 0 — โครงสร้าง ✅ (2026-11-16)
- [x] Next.js 16 + TypeScript + Tailwind, `output: standalone`
- [x] หลายภาษา (th/en) + ตัวเลือกภาษา + redirect ตามภาษา
- [x] หน้า: login / register / hub (5 เมนู) / สร้างร้าน / ร้านของฉัน / เข้าร่วมร้าน / บัญชี / เมนูร้าน 12 โมดูล
- [x] Domain types, permissions, คำนวณบิล, format เงิน/เวลา
- [x] Drizzle schema Postgres ครบทุกตารางหลัก
- [x] เอกสาร

## Phase 1 — ใช้งานได้จริงขั้นต่ำ
- [ ] สร้าง Supabase project + `npm run db:generate && npm run db:migrate`
- [ ] Auth ด้วย Better Auth (email+password, Google) + ป้องกันหน้า hub/store
- [ ] Implement `adapters/db/postgres/repositories.ts` (users, stores, products, stock, sales)
- [ ] สร้างร้าน / ร้านของฉัน / เข้าร่วมร้าน (รหัสเชิญ) ใช้งานจริง
- [ ] บันทึกภาษา/ทามโซนของผู้ใช้
- [ ] Deploy Vercel ครั้งแรก

## Phase 2 — POS + คลังสินค้า
- [ ] คลังสินค้า: CRUD สินค้า, หมวดหมู่, สร้างบาร์โค้ด, ค้นหา
- [ ] สแกนบาร์โค้ดด้วยกล้อง (เดิมใช้ jsQR/ZXing — พิจารณา `BarcodeDetector` API + fallback)
- [ ] ระบบขาย: ตะกร้า, ส่วนลด, รับเงิน/ทอน, วิธีชำระ, ใบเสร็จ (พิมพ์ 58/80mm)
- [ ] รับเข้าสินค้า, ประวัติสต็อก, แจ้งเตือนสต็อกต่ำ
- [ ] ภาพรวม (ยอดขายวันนี้/สัปดาห์/เดือน ตามทามโซนร้าน)

## Phase 3 — ต่อยอด
- [ ] รายงาน (กำไร, สินค้าขายดี/ขายไม่ออก), export CSV
- [ ] พนักงาน + สิทธิ์ละเอียด, บันทึกเวลาทำงาน
- [ ] สมาชิก/ลูกค้า + แต้มสะสม
- [ ] ป้ายราคา, สินค้าใกล้หมดอายุ, บันทึกค่าใช้จ่าย, เบิกใช้ในร้าน
- [ ] PWA + ขายแบบ offline แล้ว sync
- [ ] ภาษาเพิ่ม (ลาว, พม่า, เขมร, จีน ...)
- [ ] สคริปต์ย้ายข้อมูลจาก SmartStock
