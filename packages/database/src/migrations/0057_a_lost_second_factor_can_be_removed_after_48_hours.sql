-- Hand-added comment only; the statements are drizzle-kit's, unchanged (PLAN 011 phase 4).
-- A new, empty table and one nullable column with no default. The ADD COLUMN on "two_factor" is metadata only: no
-- row is rewritten. But drizzle-kit migrate runs every pending migration in ONE transaction, so the ACCESS EXCLUSIVE
-- lock it takes on "two_factor" (itself queued behind any in-flight read of "two_factor") is held until COMMIT —
-- through the two foreign keys after it, which check no rows (the table is empty) but take SHARE ROW EXCLUSIVE on
-- "user" and wait behind any uncommitted INSERT, UPDATE or DELETE there (ROW EXCLUSIVE: an activation, a tier change,
-- Better Auth's own user updates). Row locks such as FOR NO KEY UPDATE take only ROW SHARE and do not hold it up.
-- While it waits, every 2FA sign-in's read of "two_factor" waits too. Those writes take milliseconds, but drizzle-kit
-- migrate sets no lock_timeout, so the wait has no bound of its own; a failure or a deadlock aborts the one
-- transaction — the build fails, nothing is applied and the old API keeps serving. Still, do not merge this just
-- before the 03:30 and 08:00 UTC crons.
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