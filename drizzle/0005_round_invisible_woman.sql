ALTER TABLE "book" ADD COLUMN "started_at" date;--> statement-breakpoint
ALTER TABLE "book" ADD COLUMN "completed_at" date;--> statement-breakpoint
ALTER TABLE "book" ADD COLUMN "read_count" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "book" SET "read_count" = 1 WHERE "read_status" = 'Completed' AND "read_count" = 0;--> statement-breakpoint
UPDATE "book" SET "started_at" = CURRENT_DATE WHERE "read_status" = 'Reading' AND "started_at" IS NULL;--> statement-breakpoint
ALTER TABLE "book" ADD CONSTRAINT "read_count_is_nonnegative_check" CHECK ("book"."read_count" >= 0);--> statement-breakpoint
ALTER TABLE "book" ADD CONSTRAINT "started_at_before_completed_at" CHECK ("book"."completed_at" IS NULL OR "book"."started_at" <= "book"."completed_at");
