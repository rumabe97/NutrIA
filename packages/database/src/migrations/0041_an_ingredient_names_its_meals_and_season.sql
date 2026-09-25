ALTER TABLE "ingredients" ADD COLUMN "meal_slots" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "season_months" smallint[] DEFAULT '{}' NOT NULL;