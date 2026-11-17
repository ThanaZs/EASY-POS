ALTER TABLE "products" ADD COLUMN "subcategory" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pack_unit" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pack_size" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pack_price_minor" bigint;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pack_barcode" text;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "base_qty" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_pack_barcode" ON "products" USING btree ("store_id","pack_barcode");