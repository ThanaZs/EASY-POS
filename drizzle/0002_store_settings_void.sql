ALTER TABLE "sales" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "receipt_footer" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "allow_negative_stock" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;