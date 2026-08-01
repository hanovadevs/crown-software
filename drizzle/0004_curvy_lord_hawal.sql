CREATE INDEX IF NOT EXISTS "inventory_movements_product_id_idx" ON "inventory_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_status_type_idx" ON "transactions" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_party_status_idx" ON "transactions" USING btree ("party_id","status");