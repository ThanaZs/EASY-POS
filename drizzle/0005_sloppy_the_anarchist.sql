CREATE TABLE "catalog_items" (
	"barcode" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"category" text,
	"subcategory" text,
	"unit" text,
	"image_path" text,
	"image_url" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- ตารางใหม่ต้องเปิด RLS (กัน Supabase Data API)
ALTER TABLE "catalog_items" ENABLE ROW LEVEL SECURITY;
