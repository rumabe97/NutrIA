-- A kitchen is what it has, and a dish says what it cannot be cooked without (`0102`).
--
-- **Additive and alone.** Two new types, one new table, one new column with a
-- constant default. No row is read, moved or deleted, and there is deliberately
-- no `-- reviewed-destructive:` line because there is nothing here for one to be
-- about: the only `NOT NULL` arrives with `DEFAULT '{}'`, which is what keeps it
-- from failing on the 962 recipes production already holds.
--
-- **The backfill is not here, on purpose.** Reading the prose of every dish's
-- steps to work out which appliances it needs is project 021 phase 2, a
-- migration of its own, so that this one is *provably* safe on production's
-- rows — there is no statement in it that could be wrong about a dish. It is
-- also the only way the two can be timed apart: drizzle wraps **every pending
-- migration file in one transaction**, so a backfill merged in the same deploy
-- would run inside this file's lock however many files it was split across
-- (`0061`'s own comment, and `migration-reviewer` on project 020 phase 2).
--
-- **Locks.** `ADD COLUMN ... text[] DEFAULT '{}' NOT NULL` is catalog-only on
-- Postgres 11 and later: the default is a constant, so no existing row is
-- touched and the table is not rewritten. What it does take is `ACCESS
-- EXCLUSIVE` on `recipes` — held, like every statement here, until the file's
-- transaction commits — and `recipes` has as many readers as anything in this
-- product: every generation's library read, every plan screen, every meal
-- detail, every picture sweep. With no data step in the file the **hold** is
-- milliseconds, which is the whole reason the reading of prose is somewhere
-- else.
--
-- **Acquiring that lock is not in this file's hands**, which is the half a
-- header is tempted to leave out (`migration-reviewer`, 2026-10-16). The ALTER
-- queues behind whatever reader of `recipes` is already in flight, every later
-- read queues behind the waiting ALTER, and `drizzle-kit migrate` sets no
-- `lock_timeout` (`0057` and `0059` say so in their own headers). What bounds
-- it today is that nothing holds a long transaction over `recipes`: there is no
-- `transaction(` in `apps/api/src/modules/{meal-plans,fixed-meals,ai}` or in
-- `packages/core/src/controllers/Plan`, `RecipeRepository`'s transactions are on
-- `recipe_images`, and the two paths that write `recipes` are database-only — the
-- dish request's own comment says its transaction is deliberately not held
-- across a model call. So the wait is single statements, sub-second. **It stops
-- being wording the moment a file also carries a data step**, which is exactly
-- why phase 2's backfill is a separate deploy and not a second file in this one.
--
-- **The old build survives it, and nothing about it is subtle.** The API
-- serving requests while the new one rolls out never names `appliance` or
-- `equipment_stance`, never declares `kitchen_equipment`, and does not declare
-- `recipes.equipment` — so it neither selects it (drizzle lists the columns the
-- build itself declares) nor writes it. A dish it inserts mid-deploy takes the
-- default and reads as unclassified, which `0102` says out loud is a pan, and
-- which phase 2's pattern list then reads like any other row.
--
-- **Rolling the deploy back is safe.** The previous build is blind to two
-- types, one table and one column; no code path of it can observe any of them,
-- and nothing of anybody's is lost by going back. A kitchen somebody described
-- in the window would simply stop being read until the new build returns.
--
-- **Coming back afterwards is the part that needs care** (`migration-reviewer`,
-- 2026-10-16). An instant rollback runs no build and therefore no `migrate`, and
-- a `git revert` and redeploy applies nothing either — this file is already the
-- last entry the migrator saw. So **re-landing it needs a fresh `when` in
-- `meta/_journal.json`**, or the migrator skips it in silence and a build that
-- declares `recipes.equipment` serves against a schema without it. The same
-- precaution applies if a migration from another branch merges and deploys ahead
-- of this one (`packages/database/AGENTS.md` § Migrations: re-stamp `when` at
-- merge). As it stands this file's `when` is 1792102038051 against 0065's
-- 1792076471236, so it runs.
--
-- `kitchen_equipment_one_per_appliance` is the structure's own assumption
-- written down: a person takes **one** stance to an appliance, so two requests
-- fired together must not be able to insert two rows that disagree — under READ
-- COMMITTED both read "no row yet" before either commits. It is also what
-- `ON CONFLICT (user_id, appliance)` matches against, which is how a stance is
-- changed at all (without it, Postgres 42P10 reaches the person as an opaque
-- 500 — the mistake `userOwnedSingleton` exists because of).
--
-- **No row is the default kitchen** — stovetop, oven, microwave (`0102`) — so
-- there is nothing to write for the accounts that already exist: every one of
-- them reads as a normal kitchen from the moment this applies, and stays that
-- way until somebody says otherwise.

CREATE TYPE "public"."appliance" AS ENUM('stovetop', 'oven', 'microwave', 'air_fryer', 'pressure_cooker', 'blender', 'grill', 'steamer', 'slow_cooker', 'rice_cooker');--> statement-breakpoint
CREATE TYPE "public"."equipment_stance" AS ENUM('missing', 'has', 'prefers');--> statement-breakpoint
CREATE TABLE "kitchen_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"appliance" "appliance" NOT NULL,
	"stance" "equipment_stance" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kitchen_equipment_one_per_appliance" UNIQUE("user_id","appliance")
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "equipment" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "kitchen_equipment" ADD CONSTRAINT "kitchen_equipment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "kitchen_equipment_user_id_idx" ON "kitchen_equipment" USING btree ("user_id");