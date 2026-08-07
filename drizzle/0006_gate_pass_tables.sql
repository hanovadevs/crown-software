CREATE TYPE "public"."gate_pass_direction" AS ENUM('inward', 'outward');--> statement-breakpoint
CREATE TYPE "public"."gate_pass_status" AS ENUM('draft', 'issued', 'received', 'cancelled');--> statement-breakpoint
CREATE TABLE "gate_pass_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gate_pass_id" uuid NOT NULL,
	"product_id" uuid,
	"description" varchar(300) NOT NULL,
	"quantity" numeric(18, 3) NOT NULL,
	"unit" varchar(30) DEFAULT 'pcs' NOT NULL,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "gate_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gate_pass_number" varchar(64) NOT NULL,
	"direction" "gate_pass_direction" NOT NULL,
	"status" "gate_pass_status" DEFAULT 'issued' NOT NULL,
	"party_id" uuid,
	"vehicle_number" varchar(40),
	"driver_name" varchar(160),
	"driver_phone" varchar(30),
	"gate_pass_date" date NOT NULL,
	"remarks" text,
	"is_returnable" boolean DEFAULT false NOT NULL,
	"expected_return_date" date,
	"authorized_by" varchar(160),
	"received_by" varchar(160),
	"gate_keeper_name" varchar(160),
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gate_pass_items" ADD CONSTRAINT "gate_pass_items_gate_pass_id_gate_passes_id_fk" FOREIGN KEY ("gate_pass_id") REFERENCES "public"."gate_passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_pass_items" ADD CONSTRAINT "gate_pass_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gate_pass_items_pass_idx" ON "gate_pass_items" USING btree ("gate_pass_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gate_passes_number_unique" ON "gate_passes" USING btree ("gate_pass_number");--> statement-breakpoint
CREATE INDEX "gate_passes_date_idx" ON "gate_passes" USING btree ("gate_pass_date");--> statement-breakpoint
CREATE INDEX "gate_passes_direction_idx" ON "gate_passes" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "gate_passes_party_idx" ON "gate_passes" USING btree ("party_id");