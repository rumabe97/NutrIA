-- Hand-added comment only; the statements are drizzle-kit's, unchanged (PLAN 011 phase 4).
-- A new, empty table and one nullable column with no default. The ADD COLUMN on "two_factor" is metadata only: no
-- row is rewritten, and its ACCESS EXCLUSIVE lock is held for the catalogue change alone, after waiting for open
-- transactions on "two_factor" (the plugin's short reads and writes during a sign-in). The two foreign keys on the
-- new table check no rows (it has none) and take SHARE ROW EXCLUSIVE on "user", which waits behind open writers on
-- "user" for the same short moment (BillingRepository.customerFor holds FOR NO KEY UPDATE on a user row while it
-- calls Stripe), so do not merge this just before the 03:30 and 08:00 UTC crons.
-- No backfill, on purpose: NULL last_totp_step means "no code accepted since this was recorded", and the first
-- correct code claims its step. The old API, still running while this deploys, neither reads nor writes the column
-- or the table: its Drizzle schema does not name them, and the plugin's INSERT leaves the column NULL. If the API is
-- rolled back, codes are no longer checked for replay and no removal runs until the new API returns; a pending
-- request stays in its row and is neither lost nor run early, since the cron only removes at or after due_at; a code
-- the account enters while rolled back does not cancel it, so the owner cancels it from the console if it should.
CREATE TABLE "two_factor_removal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"cancelled_at" timestamp with time zone,
	"due_at" timestamp with time zone NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"requested_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "two_factor_removal_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "last_totp_step" bigint;--> statement-breakpoint
ALTER TABLE "two_factor_removal" ADD CONSTRAINT "two_factor_removal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "two_factor_removal" ADD CONSTRAINT "two_factor_removal_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;