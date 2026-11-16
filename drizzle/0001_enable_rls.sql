-- ปิดการเข้าถึงผ่าน Supabase Data API (anon/authenticated key)
-- แอปต่อด้วย role postgres (เจ้าของตาราง) ซึ่งไม่ติด RLS จึงทำงานได้ปกติ
-- เปิด RLS โดยไม่มี policy = role อื่นอ่าน/เขียนไม่ได้เลย (ใช้กับ Postgres เจ้าอื่นได้ ไม่มีผลเสีย)
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "store_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "store_invites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
