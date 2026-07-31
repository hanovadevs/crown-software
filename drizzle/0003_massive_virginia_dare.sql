ALTER TYPE "public"."bill_type" ADD VALUE 'tax_invoice';--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "sales_tax_rate" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "sales_tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "sed_rate" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "sed_amount" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "supplier_ntn" varchar(80);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "buyer_ntn" varchar(80);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "time_of_supply" varchar(80);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "terms_of_sales" varchar(160);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "sed_rate" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "sed_amount" numeric(18, 2) DEFAULT '0' NOT NULL;