CREATE TABLE "recipe_image_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"outcome" text,
	"recipe_id" uuid NOT NULL,
	CONSTRAINT "recipe_image_calls_kind" CHECK ("recipe_image_calls"."kind" in ('image', 'judge'))
);
--> statement-breakpoint
ALTER TABLE "recipe_images" ALTER COLUMN "bytes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_images" ALTER COLUMN "content_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_images" ALTER COLUMN "height" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_images" ALTER COLUMN "model" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_images" ALTER COLUMN "prompt_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_images" ALTER COLUMN "width" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_images" ADD COLUMN "attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_images" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recipe_images" ADD COLUMN "provenance" jsonb;--> statement-breakpoint
ALTER TABLE "recipe_images" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_images" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "recipe_image_calls" ADD CONSTRAINT "recipe_image_calls_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_image_calls_created_at_idx" ON "recipe_image_calls" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "recipe_images" ADD CONSTRAINT "recipe_images_status" CHECK ("recipe_images"."status" in ('drawing', 'ready', 'failed'));--> statement-breakpoint
--
-- Hand-added (0066): pictures stop living in Postgres. Every row stored so far
-- is a `0010` illustration held as bytes — never shown in production, where
-- the illustrator was never switched on, and 3 rows of unknown origin in
-- development. Nothing reads `bytes` once 0066 ships, and a dish without a row
-- is simply drawn again on its first view, so this empties the table.
--
-- reviewed-destructive: deletes every recipe_images row that holds bytes, which today is every row. They are 0010 illustrations: in production the illustrator was never on, in development they are 3 rows of unknown origin. Nothing references recipe_images; the API still running during the deploy only reads it, finds no row and answers as for a dish without a picture.
DELETE FROM "recipe_images" WHERE "bytes" IS NOT NULL;
