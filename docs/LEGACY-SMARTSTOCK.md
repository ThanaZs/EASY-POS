# โปรเจกต์เดิม: SmartStock (ใช้อ้างอิง)

ที่มา: ไฟล์สำรอง `SmartStock-Full-Backup-2026-10-17_155618.zip` (อยู่ในเครื่องของเจ้าของเท่านั้น)

> 🔒 **ห้ามนำไฟล์ zip / `.env` / `smartstock.sql` ขึ้น GitHub** — มีรหัสผ่าน DB, JWT secret, SMTP password และข้อมูลจริง
> ถ้าเคยมีไฟล์เหล่านี้หลุดออกไป ควรเปลี่ยนรหัสทั้งหมด (DB password, JWT_SECRET, Gmail App Password)

## Stack เดิม
- Backend: Python 3.12 + FastAPI ไฟล์เดียว `main.py` (~2,400 บรรทัด) รันด้วย uvicorn + supervisor
- Frontend: HTML ไฟล์เดียว `index.html` (~3,000 บรรทัด) + jsQR / ZXing สแกนบาร์โค้ดด้วยกล้อง
- DB: PostgreSQL, รันใน Docker หลัง Nginx

## ฟีเจอร์ที่มีแล้วใน SmartStock (นำมาทำใหม่ใน EASY-POS)
- สมัคร/ล็อกอินด้วยอีเมล + OTP ยืนยันอีเมล, ลืมรหัสผ่านด้วย OTP, ล็อกอินด้วย Google
- เปลี่ยนอีเมล (OTP ไปอีเมลใหม่), เปลี่ยนรหัสผ่าน, ลบบัญชี, โอนความเป็นเจ้าของร้าน
- ร้านค้า + สมาชิก: role `owner/manager/employee`, permissions แบบ jsonb, ระงับพนักงาน (suspended)
- เชิญพนักงานด้วยรหัสเชิญ (max_uses, expires_at) หรือรหัสร้าน (`STORE-XXXX`), ออกจากร้าน
- สินค้า: ชื่อ, บาร์โค้ด EAN-13 (มีปุ่มสร้างบาร์โค้ด), หมวดหมู่, ราคาขาย, ราคาทุน, จุดแจ้งเตือนสต็อกต่ำ
- รับเข้า/เบิกออก/แก้ไข → บันทึก `stock_movements` (ก่อน/หลัง, ผู้ทำ, หมายเหตุ) + ตัวกรองประวัติ
- แจ้งเตือนสินค้าใกล้หมด, audit log
- ตั้งค่าภาษา (th/en), region, ทามโซน, onboarding

## API เดิม (สรุป)
`/auth/email/*`, `/auth/password/*`, `/auth/google*`, `/auth/login`, `/auth/me`,
`/account/*` (settings, password, email, employees, employee-invites, transfer-ownership, leave-store),
`/products` (CRUD, `/generate-barcode`, `/{id}/stock`), `/stock-movements`, `/alerts/low-stock`

## ตารางเดิม → ตารางใหม่
| SmartStock | EASY-POS | หมายเหตุ |
|---|---|---|
| users (int id) | users (uuid) | ย้าย locale/timezone มาเหมือนเดิม; auth แยกไปตารางของ Better Auth |
| stores | stores | เพิ่ม currency, time_zone, tax |
| store_members | store_members | role: employee → staff / cashier |
| employee_invites | store_invites | |
| products (barcode 13 หลักบังคับ) | products | barcode ไม่บังคับ, เงินเป็นสตางค์ (bigint), เพิ่ม unit / expires_at |
| stock_movements (in/out/edt) | stock_movements | เพิ่ม sale / refund / adjust + ref_sale_id |
| audit_logs | audit_logs | |
| *(ไม่มี)* | sales, sale_items, customers, expenses | ใหม่สำหรับ POS |

การย้ายข้อมูลจริงจาก SmartStock (ถ้าต้องการ): เขียนสคริปต์อ่าน `smartstock.sql` → map id เป็น uuid → แปลงราคาเป็นสตางค์ (×100) — ยังไม่ได้ทำ (ดู ROADMAP)
