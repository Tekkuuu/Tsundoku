CREATE INDEX "order_userId_orderDate_idx" ON "order" USING btree ("user_id","order_date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "order_orderNumber_trgm_idx" ON "order" USING gin ("order_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "order_storeName_trgm_idx" ON "order" USING gin ("store_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "order_note_trgm_idx" ON "order" USING gin ("note" gin_trgm_ops);