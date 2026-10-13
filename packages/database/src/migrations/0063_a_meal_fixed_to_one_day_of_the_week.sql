-- A meal somebody fixed to one day of the week, for ever (`0098`, `0099`).
--
-- Additive and alone: a new table, no column added to one in use, no data moved,
-- nothing locked that the API serving the old build is reading. The old build
-- never declares `fixed_meals`, and `"meal_slot"` is not a new type — it has
-- existed since `0000` — so no CREATE TYPE races the running build. Rolling back
-- is the previous build being blind to one extra table.
--
-- `fixed_meals_user_weekday_unique` is the structure's own assumption, written
-- down: the scheduler takes its pins as a map keyed by the day of the fortnight
-- (`SchedulerInput.pinned`), so a second rule on the same weekday is not a thing
-- it can hold — one of the two would be dropped silently, by whichever order the
-- rows came back in. It is deliberately the tight version: loosening it later to
-- (user_id, weekday, slot) is a DROP + ADD CONSTRAINT with no table rewrite,
-- while tightening it afterwards would need the data to already comply.
--
-- `fixed_meals_weekday_range` is not belt and braces. `smallint` accepts
-- -32768..32767 and the rule is 0-6; a row outside that range does not quietly
-- fail to fire — `fixedMealSchema` throws on reading it, which takes out that
-- account's screen and every generation that expands its rules as an opaque 500.
-- Past the parse, `daysFor`'s `% 7` would map 7 onto Monday and fire the rule on
-- the wrong day for ever.
--
-- The dish is a foreign key and not a slug, cascading: a rule naming a recipe
-- that no longer exists would be a rule the generator drops once a fortnight, in
-- silence, for ever. The cascade removes the rule instead, and removes it
-- silently — accepted because no code path deletes a recipe and any recipe ever
-- planned is held by ON DELETE restrict from `meals`.
--
-- `weekday` is 0-6 from Monday.

CREATE TABLE "fixed_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recipe_id" uuid NOT NULL,
	"slot" "meal_slot" NOT NULL,
	"weekday" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fixed_meals_user_weekday_unique" UNIQUE("user_id","weekday"),
	CONSTRAINT "fixed_meals_weekday_range" CHECK ("fixed_meals"."weekday" between 0 and 6)
);
--> statement-breakpoint
ALTER TABLE "fixed_meals" ADD CONSTRAINT "fixed_meals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "fixed_meals" ADD CONSTRAINT "fixed_meals_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixed_meals_user_id_idx" ON "fixed_meals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fixed_meals_recipe_idx" ON "fixed_meals" USING btree ("recipe_id");