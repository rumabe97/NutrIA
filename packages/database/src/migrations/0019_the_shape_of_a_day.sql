-- Which meals somebody eats, and how big each one is (`0036`).
--
-- Replaces `meals_per_day` + `includes_snacks`, which could say *how many* meals
-- somebody ate but never *which*: the old derivation took the first N of
-- breakfast, lunch, dinner, so asking for two always dropped dinner and a person
-- who skips breakfast had no way to say so.
ALTER TABLE "user_preferences" ADD COLUMN "meal_shape" jsonb DEFAULT '{"afternoon_snack":"normal","breakfast":"normal","dinner":"normal","lunch":"normal","morning_snack":"off","supper":"off"}'::jsonb NOT NULL;--> statement-breakpoint

-- Everybody keeps the day their old answer implied, so nobody is asked again.
-- This reproduces the previous `slotsFor` exactly: the three core meals in
-- order, then the extras — snacks first when they wanted snacks, supper when
-- they did not — until the count is met.
UPDATE "user_preferences" SET "meal_shape" = jsonb_build_object(
  'breakfast', 'normal',
  'lunch', CASE WHEN coalesce("meals_per_day", 3) >= 2 THEN 'normal' ELSE 'off' END,
  'dinner', CASE WHEN coalesce("meals_per_day", 3) >= 3 THEN 'normal' ELSE 'off' END,
  'afternoon_snack', CASE WHEN "includes_snacks" AND coalesce("meals_per_day", 3) >= 4 THEN 'normal' ELSE 'off' END,
  'morning_snack', CASE WHEN "includes_snacks" AND coalesce("meals_per_day", 3) >= 5 THEN 'normal' ELSE 'off' END,
  'supper', CASE
    WHEN (NOT "includes_snacks" AND coalesce("meals_per_day", 3) >= 4) OR ("includes_snacks" AND coalesce("meals_per_day", 3) >= 6) THEN 'normal'
    ELSE 'off'
  END
);--> statement-breakpoint

-- Dropped rather than left unread: a column nothing reads is a column that lies
-- the first time somebody trusts it.
ALTER TABLE "user_preferences" DROP COLUMN "meals_per_day";--> statement-breakpoint
ALTER TABLE "user_preferences" DROP COLUMN "includes_snacks";
