-- Hand-added comment only; the statements are drizzle-kit's, unchanged (decision 0071, project 008 phase 7).
-- Two nullable columns with no default: metadata only, no row is rewritten, and the ACCESS EXCLUSIVE
-- lock on "user" is held for the catalogue change alone (milliseconds), not for a table scan. Taking it
-- first waits for every open transaction on "user", and new session lookups queue behind the wait; every
-- query on "user" is short today. Do not merge this just before the 03:30 and 08:00 UTC crons.
-- No backfill, on purpose: NULL means not recorded (created before the record existed, or during a
-- rollback or the seconds before the new API takes over), and writing
-- a version onto it would state something that cannot be proved. The old API, still running while this
-- deploys, neither reads nor writes the columns: its INSERTs leave them NULL, which is the same
-- "before recording" answer. No index, no constraint and no foreign key.
ALTER TABLE "user" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "terms_version" text;