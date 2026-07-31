CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'archive', 'post', 'reverse', 'login', 'logout', 'restore');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('draft', 'issued', 'partial', 'paid', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."bill_type" AS ENUM('invoice', 'quotation');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type" AS ENUM('opening', 'purchase', 'sale', 'return_in', 'return_out', 'adjustment_in', 'adjustment_out', 'production_issue', 'production_output', 'transfer_in', 'transfer_out');--> statement-breakpoint
CREATE TYPE "public"."journal_side" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."journal_status" AS ENUM('posted', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bank', 'cheque', 'credit');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('draft', 'posted', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('sale', 'purchase', 'bank_deposit', 'bank_withdrawal', 'customer_receipt', 'supplier_payment', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'accounts', 'inventory', 'production', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('planned', 'released', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."worker_payment_status" AS ENUM('pending', 'partial', 'paid');--> statement-breakpoint
CREATE TYPE "public"."worker_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"bank_name" varchar(160),
	"account_number" varchar(120),
	"iban" varchar(64),
	"opening_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"is_cash_account" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"product_id" uuid,
	"description" varchar(300) NOT NULL,
	"quantity" numeric(18, 3) NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"line_total" numeric(18, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bill_items_valid_values" CHECK ("bill_items"."quantity" > 0 AND "bill_items"."unit_price" >= 0 AND "bill_items"."line_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bill_of_material_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bom_id" uuid NOT NULL,
	"material_product_id" uuid NOT NULL,
	"quantity" numeric(18, 3) NOT NULL,
	"expected_waste_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	CONSTRAINT "bom_items_quantity_positive" CHECK ("bill_of_material_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_number" varchar(64) NOT NULL,
	"type" "bill_type" NOT NULL,
	"status" "bill_status" DEFAULT 'draft' NOT NULL,
	"party_id" uuid NOT NULL,
	"bill_date" date NOT NULL,
	"due_date" date,
	"subtotal" numeric(18, 2) NOT NULL,
	"tax_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"shipping_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"notes" text,
	"terms" text,
	"created_by" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bills_amounts_nonnegative" CHECK ("bills"."subtotal" >= 0 AND "bills"."tax_amount" >= 0 AND "bills"."shipping_amount" >= 0 AND "bills"."discount_amount" >= 0 AND "bills"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bills_of_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"finished_product_id" uuid NOT NULL,
	"output_quantity" numeric(18, 3) DEFAULT '1' NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"transaction_id" uuid,
	"movement_type" "inventory_movement_type" NOT NULL,
	"quantity_delta" numeric(18, 3) NOT NULL,
	"unit_cost" numeric(18, 4),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference" varchar(120),
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_movement_not_zero" CHECK ("inventory_movements"."quantity_delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" varchar(64) NOT NULL,
	"entry_date" date NOT NULL,
	"description" text NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" uuid,
	"status" "journal_status" DEFAULT 'posted' NOT NULL,
	"reversal_of_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"party_id" uuid,
	"bank_account_id" uuid,
	"side" "journal_side" NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"memo" text,
	CONSTRAINT "journal_lines_amount_positive" CHECK ("journal_lines"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(160) NOT NULL,
	"type" "account_type" NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(80) NOT NULL,
	"succeeded" boolean NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" varchar(180) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(40) DEFAULT 'info' NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_person" varchar(160),
	"phone" varchar(40),
	"email" varchar(255),
	"address" text,
	"tax_number" varchar(80),
	"is_customer" boolean DEFAULT false NOT NULL,
	"is_supplier" boolean DEFAULT false NOT NULL,
	"opening_receivable" numeric(18, 2) DEFAULT '0' NOT NULL,
	"opening_payable" numeric(18, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parties_must_have_role" CHECK ("parties"."is_customer" = true OR "parties"."is_supplier" = true),
	CONSTRAINT "parties_opening_balances_nonnegative" CHECK ("parties"."opening_receivable" >= 0 AND "parties"."opening_payable" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(120),
	"brand" varchar(120) DEFAULT 'Crown' NOT NULL,
	"unit" varchar(40) DEFAULT 'Pieces' NOT NULL,
	"description" text,
	"sale_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"purchase_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"reorder_level" numeric(18, 3) DEFAULT '0' NOT NULL,
	"is_raw_material" boolean DEFAULT false NOT NULL,
	"is_finished_good" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_prices_nonnegative" CHECK ("products"."sale_price" >= 0 AND "products"."purchase_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quality_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"check_name" varchar(160) NOT NULL,
	"result" varchar(80) NOT NULL,
	"measured_value" varchar(120),
	"notes" text,
	"checked_by" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_number" varchar(64) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'posted' NOT NULL,
	"party_id" uuid,
	"product_id" uuid,
	"bank_account_id" uuid,
	"warehouse_id" uuid,
	"quantity" numeric(18, 3),
	"unit_price" numeric(18, 2),
	"total_amount" numeric(18, 2) NOT NULL,
	"payment_method" "payment_method" DEFAULT 'cash' NOT NULL,
	"description" text NOT NULL,
	"reference" varchar(120),
	"transaction_date" date NOT NULL,
	"reversed_transaction_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_positive" CHECK ("transactions"."total_amount" > 0),
	CONSTRAINT "transactions_quantity_nonnegative" CHECK ("transactions"."quantity" IS NULL OR "transactions"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(80) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(160) NOT NULL,
	"address" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(64) NOT NULL,
	"bom_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"planned_quantity" numeric(18, 3) NOT NULL,
	"completed_quantity" numeric(18, 3) DEFAULT '0' NOT NULL,
	"rejected_quantity" numeric(18, 3) DEFAULT '0' NOT NULL,
	"status" "work_order_status" DEFAULT 'planned' NOT NULL,
	"planned_start_date" date NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" uuid NOT NULL,
	"salary_month" date NOT NULL,
	"gross_amount" numeric(18, 2) NOT NULL,
	"advance_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"deduction_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"status" "worker_payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_code" varchar(40) NOT NULL,
	"name" varchar(160) NOT NULL,
	"phone" varchar(40),
	"address" text,
	"national_id" varchar(40),
	"designation" varchar(120),
	"monthly_salary" numeric(18, 2) DEFAULT '0' NOT NULL,
	"joining_date" date NOT NULL,
	"status" "worker_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_of_material_items" ADD CONSTRAINT "bill_of_material_items_bom_id_bills_of_materials_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bills_of_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_of_material_items" ADD CONSTRAINT "bill_of_material_items_material_product_id_products_id_fk" FOREIGN KEY ("material_product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_finished_product_id_products_id_fk" FOREIGN KEY ("finished_product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_bom_id_bills_of_materials_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bills_of_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_payments" ADD CONSTRAINT "worker_payments_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_payments" ADD CONSTRAINT "worker_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_name_unique" ON "bank_accounts" USING btree ("name");--> statement-breakpoint
CREATE INDEX "bill_items_bill_idx" ON "bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bom_items_material_unique" ON "bill_of_material_items" USING btree ("bom_id","material_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_number_unique" ON "bills" USING btree ("bill_number");--> statement-breakpoint
CREATE INDEX "bills_party_idx" ON "bills" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "bills_date_idx" ON "bills" USING btree ("bill_date");--> statement-breakpoint
CREATE UNIQUE INDEX "boms_code_unique" ON "bills_of_materials" USING btree ("code");--> statement-breakpoint
CREATE INDEX "inventory_movements_product_warehouse_idx" ON "inventory_movements" USING btree ("product_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_occurred_at_idx" ON "inventory_movements" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_number_unique" ON "journal_entries" USING btree ("entry_number");--> statement-breakpoint
CREATE INDEX "journal_entries_source_idx" ON "journal_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_idx" ON "journal_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_party_idx" ON "journal_lines" USING btree ("party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_code_unique" ON "ledger_accounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "login_attempts_username_time_idx" ON "login_attempts" USING btree ("username","attempted_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "parties_name_idx" ON "parties" USING btree ("name");--> statement-breakpoint
CREATE INDEX "parties_roles_idx" ON "parties" USING btree ("is_customer","is_supplier");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_unique" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_name_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "quality_checks_work_order_idx" ON "quality_checks" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_number_unique" ON "transactions" USING btree ("transaction_number");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "transactions_party_idx" ON "transactions" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "transactions_product_idx" ON "transactions" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_code_unique" ON "warehouses" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_number_unique" ON "work_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "work_orders_status_idx" ON "work_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "worker_payments_worker_month_unique" ON "worker_payments" USING btree ("worker_id","salary_month");--> statement-breakpoint
CREATE UNIQUE INDEX "workers_code_unique" ON "workers" USING btree ("worker_code");--> statement-breakpoint
CREATE INDEX "workers_name_idx" ON "workers" USING btree ("name");