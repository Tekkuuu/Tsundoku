CREATE TABLE "reading_plan_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"book_id" uuid NOT NULL,
	"planned_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_user_planned_book" UNIQUE("user_id","book_id")
);
--> statement-breakpoint
ALTER TABLE "reading_plan_item" ADD CONSTRAINT "reading_plan_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_plan_item" ADD CONSTRAINT "reading_plan_item_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "readingPlanItem_userId_idx" ON "reading_plan_item" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "readingPlanItem_bookId_idx" ON "reading_plan_item" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "readingPlanItem_user_date_idx" ON "reading_plan_item" USING btree ("user_id","planned_date");