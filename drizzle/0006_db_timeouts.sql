-- กันหน้าเว็บค้างนาน: คำสั่งที่ค้าง (เช่นรอล็อก / connection ใน pooler ค้าง) ถูกยกเลิกเร็ว แทนค่าเริ่มต้นของ Supabase (2 นาที)
-- ตั้งที่ role (pooler แบบ transaction ไม่รับการตั้งค่าจาก connection) — มีผลกับ connection ใหม่
-- คำสั่งของแอปทุกตัวใช้ < 1 วินาที; ถ้าต้องรันงานหนัก (เช่น backfill) ให้ SET statement_timeout ในเซสชันนั้นเอง
ALTER ROLE CURRENT_USER SET statement_timeout = '20s';
--> statement-breakpoint
ALTER ROLE CURRENT_USER SET lock_timeout = '10s';
--> statement-breakpoint
ALTER ROLE CURRENT_USER SET idle_in_transaction_session_timeout = '30s';
