ALTER TABLE "stock_movements" ADD COLUMN "unit_cost_minor" bigint;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "supplier" text;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "lot_no" text;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "purchased_on" date;--> statement-breakpoint
CREATE INDEX "stock_movements_product_time" ON "stock_movements" USING btree ("store_id","product_id","created_at");