CREATE TYPE "public"."macro_direction" AS ENUM('up', 'down', 'same');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"carbs" "macro_direction" NOT NULL,
	"days_before" smallint NOT NULL,
	"fat" "macro_direction" NOT NULL,
	"name" text NOT NULL,
	"on" date NOT NULL,
	"protein" "macro_direction" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_days" ADD COLUMN "loaded_for" text;--> statement-breakpoint
ALTER TABLE "plan_days" ADD COLUMN "targets" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "events_user_id_idx" ON "events" USING btree ("user_id");