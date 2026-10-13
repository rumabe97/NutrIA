-- A meal somebody fixed to one day of the week, for ever (`0098`, `0099`).
--
-- Additive and alone: a new table, no column added to one in use, no data moved,
-- nothing locked that the API serving the old build is reading. The deploy that
-- runs this is safe with the previous build still up — it reads a table nothing
-- yet writes, and the table is empty on the day it is created.
--
-- `fixed_meals_user_weekday_unique` is the structure's own assumption, written
-- down: the scheduler takes its pins as a map keyed by the day of the fortnight
-- (`SchedulerInput.pinned`), so a second rule on the same weekday is not a thing
-- it can hold — one of the two would be dropped silently, by whichever order the
-- rows came back in. Enforcing it here rather than in whoever writes next means
-- the invariant cannot be forgotten by a later writer.
--
-- The dish is a foreign key and not a slug, cascading: a rule naming a recipe
-- that no longer exists would be a rule the generator drops once a fortnight, in
-- silence, for ever. `weekday` is 0-6 from Monday.

CREATE TABLE "fixed_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recipe_id" uuid NOT NULL,
	"slot" "meal_slot" NOT NULL,
	"weekday" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fixed_meals_user_weekday_unique" UNIQUE("user_id","weekday")
);
--> statement-breakpoint
ALTER TABLE "fixed_meals" ADD CONSTRAINT "fixed_meals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "fixed_meals" ADD CONSTRAINT "fixed_meals_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixed_meals_user_id_idx" ON "fixed_meals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fixed_meals_recipe_idx" ON "fixed_meals" USING btree ("recipe_id");