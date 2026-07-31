ALTER TABLE "products" ADD COLUMN "is_sellable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_purchasable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_role_required" CHECK ("products"."is_sellable" OR "products"."is_purchasable");