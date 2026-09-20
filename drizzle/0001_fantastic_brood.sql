CREATE TYPE "public"."file_kind" AS ENUM('cover', 'receipt');--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "file_kind" NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book" ADD COLUMN "cover_file_id" uuid;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "receipt_file_id" uuid;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_userId_idx" ON "file" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "book" ADD CONSTRAINT "book_cover_file_id_file_id_fk" FOREIGN KEY ("cover_file_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_receipt_file_id_file_id_fk" FOREIGN KEY ("receipt_file_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;