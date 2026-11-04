CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "series_title_trgm_idx" ON "series" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "series_author_trgm_idx" ON "series" USING gin ("author" gin_trgm_ops);
