--
-- Hand-added, and the reason this migration is safe to run on a populated
-- database: the generated statement below adds a UNIQUE constraint to a table
-- that until now had nothing stopping a duplicate, and `ADD CONSTRAINT` fails
-- outright on the rows already there if a single pair is repeated. This runs
-- against production during the API's build with no staging before it, so it
-- may not rest on production happening to hold none today.
--
-- A repeated (user_id, plan_id) *is* the bug the constraint closes: two submits
-- of the same fortnight fired together each read "no check-in yet" before either
-- had written, and both landed. The earliest row of each pair is the one `once
-- per plan` (`0018`) always meant to keep; the later ones are the copies. No
-- table references `check_ins.id`.
--
-- reviewed-destructive: removes the duplicate check-ins of a plan and keeps the earliest of each — the row the once-per-plan rule always meant. It is a no-op unless the race had been won at least once, nothing references these rows, and the weight each carried is in `progress_entries` either way.
DELETE FROM "check_ins" AS "later"
USING "check_ins" AS "kept"
WHERE "later"."user_id" = "kept"."user_id"
  AND "later"."plan_id" = "kept"."plan_id"
  AND ("kept"."created_at", "kept"."id") < ("later"."created_at", "later"."id");--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_one_per_plan" UNIQUE("user_id","plan_id");
