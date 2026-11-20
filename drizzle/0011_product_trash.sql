DROP INDEX "products_store_barcode";--> statement-breakpoint
DROP INDEX "products_store_pack_barcode";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deleted_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_barcode" ON "products" USING btree ("store_id","barcode") WHERE "products"."is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_pack_barcode" ON "products" USING btree ("store_id","pack_barcode") WHERE "products"."is_active";