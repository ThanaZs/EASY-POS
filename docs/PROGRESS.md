# บันทึกความคืบหน้า (Handoff log)

> ไฟล์นี้คือ "สมุดส่งงาน" — ทุกครั้งที่ทำงานเสร็จหนึ่งรอบ ให้เพิ่มรายการใหม่ **ไว้บนสุด**
> เครื่องใหม่ / Claude session ใหม่: อ่านไฟล์นี้ + ROADMAP.md ก่อนเริ่มงาน

## สถานะปัจจุบัน
- Phase 0 (โครงสร้าง) เสร็จ — UI เดินได้ทุกหน้า แต่ **ยังไม่ต่อฐานข้อมูลและยังไม่มีระบบล็อกอินจริง**
- งานถัดไป: Phase 1 ข้อแรก — สร้าง Supabase แล้วรัน migration (ดู docs/DEPLOY.md)

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
