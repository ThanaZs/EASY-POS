# บันทึกความคืบหน้า (Handoff log)

> ไฟล์นี้คือ "สมุดส่งงาน" — ทุกครั้งที่ทำงานเสร็จหนึ่งรอบ ให้เพิ่มรายการใหม่ **ไว้บนสุด**
> เครื่องใหม่ / Claude session ใหม่: อ่านไฟล์นี้ + ROADMAP.md ก่อนเริ่มงาน

## สถานะปัจจุบัน
- Phase 1 เสร็จ — ใช้งานจริงที่ **https://easy-pos-beta.vercel.app** (Vercel + Supabase Tokyo)
- งานถัดไป: Phase 2 (คลังสินค้า + POS)

---

## 2026-11-16 — Deploy Vercel
- Vercel project `easy-pos` → https://easy-pos-beta.vercel.app (push `main` = deploy อัตโนมัติ)
- Env บน Vercel: `DATABASE_URL` (pooler), `DATABASE_POOL_MAX=2`, `DB_DRIVER`, `AUTH_PROVIDER`, `AUTH_SECRET` (คนละค่ากับในเครื่อง)
- ไม่ต้องตั้ง `APP_URL` บน Vercel — `src/server/env.ts` ใช้ `VERCEL_PROJECT_PRODUCTION_URL` + `VERCEL_URL` (preview) เป็น trustedOrigins
  - ถ้าผูกโดเมนของตัวเอง: ตั้ง `APP_URL=https://โดเมน`
- ตรวจแล้ว: `/api/health` 200, `/th/login` 200, `/th/hub` (ไม่ล็อกอิน) → 307 ไป login (อ่าน session จาก Supabase ได้)

---

## 2026-11-16 — ต่อ Supabase
- Project `easy-pos` อยู่ region **Tokyo** (ap-northeast-1); ใช้ Transaction pooler
  `postgres.<ref>@aws-1-ap-northeast-1.pooler.supabase.com:6543` (เป็น **aws-1** ไม่ใช่ aws-0)
- ลิงก์ Direct `db.<ref>.supabase.co:5432` เป็น IPv6 อย่างเดียว — เครื่องนี้และ Vercel ต่อไม่ได้ ห้ามใช้
- รัน migration 0000 + **0001_enable_rls** (เปิด RLS ทุกตาราง ไม่มี policy) — กันไม่ให้ Supabase Data API
  (anon key) อ่าน/เขียนตารางได้ เพราะแอปต่อด้วย role postgres ซึ่งข้าม RLS อยู่แล้ว
  - **ตารางใหม่ทุกตารางต้องเพิ่ม `ENABLE ROW LEVEL SECURITY` ใน migration ด้วย**
- ทดสอบกับ Supabase: สมัคร → สร้างร้าน → หน้า พนักงาน → สร้างรหัสเชิญ ✅ แล้วลบข้อมูลทดสอบออก (DB ว่าง)

---

## 2026-11-16 — Phase 1: Auth + ร้านค้า + รหัสเชิญ
**ทำอะไรไปบ้าง**
- ติดตั้ง Better Auth 1.7 (`src/server/auth.ts`) ใช้ตาราง `users` เดิม + เพิ่ม `sessions`, `accounts`, `verifications`; id เป็น uuid
- `src/server/session.ts`: `getSessionUser`, `requireUser`, `requireStoreAccess` (เช็กสมาชิก + สิทธิ์ฝั่ง server)
- Repositories จริง: `users`, `stores` (createWithOwner ใน transaction, redeemInvite ใน transaction + FOR UPDATE)
- หน้า login/register/logout จริง (server actions), แสดง error ตาม `?error=`; ปุ่ม Google แสดงเมื่อมี env
- hub: สร้างร้าน, ร้านของฉัน, เข้าร่วมร้าน (รหัสเชิญ), บัญชี (ชื่อ/ภาษา/ทามโซน)
- ร้าน: เมนูกรองตามสิทธิ์, หน้า **พนักงาน** (`store/[storeId]/staff`) สร้างรหัสเชิญ + เอาสมาชิกออก
- Migration แรก `drizzle/0000_init.sql`; env ใหม่ `DATABASE_POOL_MAX`
- ตรวจแล้ว: lint ✅ build ✅ และทดสอบในเบราว์เซอร์กับ PGlite: สมัคร 2 บัญชี → สร้างร้าน → สร้างรหัสเชิญ (cashier) →
  บัญชีที่ 2 เข้าร่วม (รหัสผิดขึ้น error, พิมพ์ตัวเล็ก/มีขีดก็ได้) → เห็นเฉพาะเมนู cashier → เข้า /staff, /reports ตรงๆ ถูกเด้งกลับ →
  ร้านที่ไม่มีอยู่ได้ 404 → บันทึกบัญชีเปลี่ยนภาษา/ทามโซนได้ → รหัสผ่านผิดขึ้น error → ออกจากระบบได้

**ข้อสังเกต / สิ่งที่ต้องรู้**
- หน้าใช้ session ต้องเรียก `headers()` ก่อน (ทำใน `getSessionUser` แล้ว) ไม่งั้น build จะพยายาม prerender แล้วต่อ DB
- PGlite ต้องใช้ `DATABASE_POOL_MAX=1` (ไม่งั้น error `bind message supplies 2 parameters...`) — Postgres จริงไม่มีปัญหานี้
- ยังไม่มี: ยืนยันอีเมล, ลืมรหัสผ่าน, ลบบัญชี (ต้องมีบริการส่งอีเมล — Phase 3)
- `.env.local` ในเครื่องนี้ชี้ไป PGlite — ห้าม commit

---

## 2026-11-16 — เริ่มโปรเจกต์ EASY-POS
**ทำอะไรไปบ้าง**
- วิเคราะห์ SmartStock เดิม (FastAPI + Postgres + HTML ไฟล์เดียว) → สรุปไว้ที่ `docs/LEGACY-SMARTSTOCK.md`
  - ไม่ได้นำโค้ด/ข้อมูลเดิมขึ้น repo เพราะมีรหัสลับและข้อมูลจริง
- ตัดสินใจ stack: Next.js 16 + TypeScript + Tailwind 4 + Drizzle + Postgres (Supabase) + Vercel
  - ไม่เลือก Firebase เพราะ POS ต้องทำรายงาน/transaction ตัดสต็อก ซึ่ง SQL เหมาะกว่า
  - ใช้ i18n แบบ dictionary ของ Next เอง (ไม่ใช้ next-intl) เพื่อลด dependency
- วางสถาปัตยกรรม ports & adapters (`src/core` ไม่ผูก framework) → ดู `docs/ARCHITECTURE.md`
- สร้างหน้า: `/[locale]/login`, `/register`, `/hub` (สร้างร้าน, ร้านของฉัน, เข้าร่วมร้าน, จัดการบัญชี, ออกจากระบบ),
  `/hub/create-store|stores|join|account`, `/store/[storeId]` (12 เมนู), `/store/[storeId]/[module]` (placeholder)
- สร้าง Drizzle schema: users, stores, store_members, store_invites, products, stock_movements,
  customers, sales, sale_items, expenses, audit_logs
- ตรวจแล้ว: `npm run build` ผ่าน, `npm run lint` ผ่าน, เปิดดูในเบราว์เซอร์ได้ทั้ง th/en

**ข้อสังเกต / สิ่งที่ต้องรู้**
- Next.js 16: `middleware.ts` เปลี่ยนชื่อเป็น `src/proxy.ts`; `params` ของ page เป็น Promise ต้อง `await`
- ปุ่มล็อกอิน/สมัคร/สร้างร้าน ตอนนี้แค่ redirect ไปหน้าถัดไป (เพื่อดู UI) — ค้นหา `TODO(phase 1)` เพื่อดูจุดที่ต้องต่อของจริง
- ร้าน `demo` เป็นข้อมูลปลอมใน `hub/stores/page.tsx`
- `drizzle-kit` บน Windows ติดตั้งด้วย `--ignore-scripts` ได้ ถ้า esbuild postinstall error
