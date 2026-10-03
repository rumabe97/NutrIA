-- Hand-added comment only; the statements are drizzle-kit's, unchanged (PLAN 011 phase 5).
-- One new, empty table for Better Auth's passkey plugin: no existing row is read, rewritten or dropped. The foreign
-- key checks no rows (the table is empty) but takes SHARE ROW EXCLUSIVE on "user", so, as in 0057, it waits behind any
-- uncommitted INSERT, UPDATE or DELETE there and, since drizzle-kit migrate runs every pending migration in one
-- transaction with no lock_timeout, holds that lock until COMMIT. Those writes take milliseconds; a failure or a
-- deadlock aborts the one transaction, the build fails, nothing is applied and the old API keeps serving. Do not merge
-- this just before the 03:30 and 08:00 UTC crons.
-- user_id ON DELETE CASCADE: an account deleted takes its passkeys with it (the plan's requirement). credential_id is
-- UNIQUE: one authenticator's key belongs to one account. counter is bigint because WebAuthn's counter is an unsigned
-- 32-bit number. The old API, still running while this deploys, has no passkey plugin and its Drizzle schema does not
-- name the table, so it neither reads nor writes it. If the API is rolled back, passkeys already added stay in their
-- rows, unused — nobody can sign in with one until the new API returns — and a password change or reset made meanwhile
-- does not remove them (the new API's rule); the person removes them under Seguridad, or the table is emptied by hand.
-- Redeploying after a rollback must first DELETE FROM passkey (or the rows of accounts that reset or changed their
-- password meanwhile), because the old API did not remove passkeys.
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"aaguid" text,
	"backed_up" boolean NOT NULL,
	"counter" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"credential_id" text NOT NULL,
	"device_type" text NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"transports" text,
	"user_id" text NOT NULL,
	CONSTRAINT "passkey_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "passkey_user_id_idx" ON "passkey" USING btree ("user_id");