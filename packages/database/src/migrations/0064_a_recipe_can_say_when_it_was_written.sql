-- A recipe can say when it was written (`0011` § 4 a).
--
-- **Two statements where drizzle generated one, deliberately.** It wrote
-- `ADD COLUMN … DEFAULT now()`, and that is not additive the way it looks:
-- Postgres backfills every existing row with the default, so the whole library
-- would claim it was written the day this ran. Measured before this file was
-- rewritten — 988 of 988 recipes stamped with today.
--
-- Adding the column bare and setting the default afterwards leaves every recipe
-- written before today with **null**, which is the truth: this table never
-- recorded it. New rows get `now()`.
--
-- Additive otherwise, and safe with the old build running: nothing reads this
-- column until the code that does ships, and a nullable column with a default
-- breaks no insert that does not name it.
--
-- The index is for the one reader, the dish-request allowance, which counts a
-- month's `(created_by, source, created_at)` once per request. `recipes` is
-- about a thousand rows, so the SHARE lock `CREATE INDEX` takes is milliseconds
-- — but it does block writes to `recipes` while it runs, which is a generation
-- persisting its dishes, so it goes last and alone.

ALTER TABLE "recipes" ADD COLUMN "created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recipes" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
CREATE INDEX "recipes_requested_idx" ON "recipes" USING btree ("created_by","source","created_at");
