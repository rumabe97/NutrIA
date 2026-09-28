-- Hand-added, no schema change: data only (0067, owner's decision — "limpiar
-- esas columnas"). The columns and the 'custom' enum value stay for this
-- release, so the API deployed alongside this migration — still running the
-- old code for the seconds this build takes — can still write to them; the
-- next release's migration drops what this one only empties. Nothing here
-- reads these columns any more (packages/core's onboarding and profile
-- schemas dropped them in the same change), so nulling what a person once
-- typed into them is the RGPD-minimisation half of removing the fields, not
-- a second decision.
-- reviewed-destructive: no copy is kept, on purpose (RGPD minimisation,
-- 0067). The only undo is a Neon point-in-time branch from before this
-- build, within the project's history-retention window, then copying the
-- nine user_preferences columns, goals.custom_goal and goals.type back by id.
UPDATE "user_preferences" SET
  "breakfast_style" = NULL,
  "budget" = NULL,
  "cooking_frequency" = NULL,
  "portion_preference" = NULL,
  "sleep_end" = NULL,
  "sleep_start" = NULL,
  "training_days_per_week" = NULL,
  "training_time" = NULL,
  "work_schedule_notes" = NULL
WHERE
  "breakfast_style" IS NOT NULL
  OR "budget" IS NOT NULL
  OR "cooking_frequency" IS NOT NULL
  OR "portion_preference" IS NOT NULL
  OR "sleep_end" IS NOT NULL
  OR "sleep_start" IS NOT NULL
  OR "training_days_per_week" IS NOT NULL
  OR "training_time" IS NOT NULL
  OR "work_schedule_notes" IS NOT NULL;
--> statement-breakpoint
-- The free text a "custom" goal carried. Cleared before the type below, so no
-- row is ever a plain "maintenance" that still keeps the sentence a person
-- wrote for the goal they had before.
UPDATE "goals" SET "custom_goal" = NULL WHERE "custom_goal" IS NOT NULL;
--> statement-breakpoint
-- A "custom" goal has always computed exactly as "maintenance"
-- (`core/domain/Nutrition`) — this moves the stored value to match what it
-- already meant, so no one's targets change. The enum keeps 'custom' as a
-- valid value until the column-drop release; nothing writes it again once
-- `packages/core`'s `GOAL_TYPES` loses it in this same change.
UPDATE "goals" SET "type" = 'maintenance' WHERE "type" = 'custom';
