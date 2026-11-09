CREATE TABLE "genre" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series_genre" (
	"genre_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	CONSTRAINT "series_genre_series_id_genre_id_pk" PRIMARY KEY("series_id","genre_id")
);
--> statement-breakpoint
ALTER TABLE "genre" ADD CONSTRAINT "genre_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_genre" ADD CONSTRAINT "series_genre_genre_id_genre_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genre"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_genre" ADD CONSTRAINT "series_genre_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_genre" ON "genre" USING btree ("user_id",lower(btrim("name")));--> statement-breakpoint
CREATE INDEX "seriesGenre_genreId_idx" ON "series_genre" USING btree ("genre_id");