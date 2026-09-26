ALTER TABLE "products" ALTER COLUMN "brand" SET DEFAULT 'SOLO';--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "posted_transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_posted_transaction_id_transactions_id_fk" FOREIGN KEY ("posted_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bills_posted_transaction_unique" ON "bills" USING btree ("posted_transaction_id");