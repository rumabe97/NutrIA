-- Hand-edited (0067 follow-up, next release): `generate` also wrote a `DROP
-- COLUMN` for `goals.custom_goal` and the nine `user_preferences` columns
-- this release's schema stops declaring. Those are cut from this file on
-- purpose. Dropping them physically now would break the previous release's
-- API (#139) while it still serves during this very build/migrate step —
-- Drizzle names every declared column in its SELECT/RETURNING, and #139's
-- own `profile.schema.ts` still declares all ten, so it would 500 on every
-- profile or goal read the moment the column vanished under it. The data is
-- already gone (migration 0043 nulled it); only the physical columns are
-- left, for migration 0045 next release — once #139 is nowhere left running
-- — to drop.
--
-- `goal_type` is different and does not wait: Postgres has no `ALTER TYPE
-- ... DROP VALUE`, so removing `'custom'` from the enum can only mean
-- rebuilding the type, and that is safe to do in this same deploy. Unlike
-- the columns above, #139 already stopped being able to *produce* `'custom'`
-- — `packages/core`'s `GOAL_TYPES` dropped it in that same release — so
-- there is no in-flight write to race, and every value #139 might still
-- *read* is one of the five this migration keeps. The `UPDATE` below only
-- has to catch a `'custom'` written in the narrow window between 0043's own
-- cleanup and #139 actually being the code running (a slow rollout, or a
-- rollback to before #139) — the same defensive sweep 0043 already ran once.
-- reviewed-destructive: no data is destroyed here. The `UPDATE` moves any
-- lingering `'custom'` goal to `'maintenance'` — what a custom goal has
-- always computed as (`core/domain/Nutrition`) — before the enum is rebuilt
-- without that value, so the cast below never meets a row it cannot convert.
-- The nine `user_preferences` columns and `goals.custom_goal` keep their
-- (already-nulled) data; this migration only stops the schema declaring
-- them, and does not touch the columns themselves.
UPDATE "goals" SET "type" = 'maintenance' WHERE "type" = 'custom';
--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."goal_type";--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('weight_loss', 'maintenance', 'muscle_gain', 'performance', 'healthy_eating');--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "type" SET DATA TYPE "public"."goal_type" USING "type"::"public"."goal_type";
