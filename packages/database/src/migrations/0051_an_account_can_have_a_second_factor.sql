-- Hand-added comment only; the statements are drizzle-kit's, unchanged (PLAN 011 phase 3).
-- A new, empty table and one column with a constant default: on Postgres 11+ the ADD COLUMN ... DEFAULT false
-- NOT NULL is metadata only — no row of "user" is rewritten and the ACCESS EXCLUSIVE lock is held for the
-- catalogue change alone. Taking it first waits for every open transaction on "user" (BillingRepository.customerFor
-- holds FOR NO KEY UPDATE on a user row while it calls Stripe), so do not merge this just before the 03:30 and
-- 08:00 UTC crons. The foreign key on the new table checks no rows (it has none) and takes SHARE ROW EXCLUSIVE on
-- "user", which also waits behind open writers for the same short moment.
-- No backfill, on purpose: false means "no second factor", which is true of every existing account.
-- The old API, still running while this deploys, neither reads nor writes the column or the table: its Drizzle
-- schema does not name them, and an INSERT from it takes the default. If the API is rolled back, accounts that
-- turned the factor on sign in with their password alone until the new API returns; nothing is lost.
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"backup_codes" text NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"secret" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	CONSTRAINT "two_factor_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;