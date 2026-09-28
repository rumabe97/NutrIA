-- Generated migration with a hand-added step in front (0067 follow-up,
-- next release after 0044): the physical drop 0044 deferred. Every value in
-- these ten columns was already nulled by migration 0043, and nothing has
-- read or written any of them since the release that shipped 0044 — that
-- release's `profile.schema.ts` is the last one to ever have declared them,
-- so it is the last API build whose SELECT/RETURNING could name them. By
-- the time this migration runs, that release is what production has been
-- serving, so there is no older API left for a dropped column to break.
-- No `IF EXISTS`: a mistyped column name must fail loudly here, not pass
-- silently and leave the column in place. What actually stops this file
-- running twice is the migrator recording it in `__drizzle_migrations` and
-- skipping anything already applied, and `drizzle-kit migrate` running every
-- pending file in one transaction, so there is no partial apply to guard
-- against either.
-- The nine `user_preferences` columns are one `ALTER TABLE` rather than
-- nine, for one lock instead of nine.
--
-- `budget_tier` and `cooking_frequency` are dropped below the column drops,
-- not above: `user_preferences.budget` and `.cooking_frequency` were the
-- last columns using them, and Postgres refuses to drop a type a column
-- still references. Those two `DROP TYPE` statements are what `generate`
-- produced on its own once `budgetTier` and `cookingFrequency` left
-- `_enums.ts` in this same change — the columns were already gone from the
-- schema as of 0044, so this is the first diff that could show it. The ten
-- `DROP COLUMN`s above them are hand-added in front, the same shape as
-- `0007`'s data-move exception: nothing generate could produce on its own,
-- because 0044 already removed those columns from what it diffs against.
-- reviewed-destructive: every value in these ten columns is already null
-- (migration 0043), so nothing of substance is destroyed — this only
-- removes storage nothing has read since the previous release. The two enum
-- types dropped at the end have no data of their own and, by this point in
-- the file, no column referencing them. There is no copy to keep and no
-- undo beyond a Neon point-in-time branch from before this build, within
-- the project's history-retention window.
ALTER TABLE "goals" DROP COLUMN "custom_goal";
--> statement-breakpoint
ALTER TABLE "user_preferences"
  DROP COLUMN "breakfast_style",
  DROP COLUMN "budget",
  DROP COLUMN "cooking_frequency",
  DROP COLUMN "portion_preference",
  DROP COLUMN "sleep_end",
  DROP COLUMN "sleep_start",
  DROP COLUMN "training_days_per_week",
  DROP COLUMN "training_time",
  DROP COLUMN "work_schedule_notes";
--> statement-breakpoint
DROP TYPE "public"."budget_tier";--> statement-breakpoint
DROP TYPE "public"."cooking_frequency";
