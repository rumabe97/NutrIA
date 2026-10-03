-- Hand-added comment only; the statement is drizzle-kit's, unchanged (PLAN 011 phase 7).
-- One new, empty table for the per-address sign-in brake: no existing row is read, rewritten or dropped, and with no
-- foreign key it locks nothing but itself. The old API, still running while this deploys, does not name the table, so
-- it neither reads nor writes it. "key" is an HMAC of the lower-cased address with BETTER_AUTH_SECRET; no address is
-- stored. Rolling the API back leaves the rows unused (the daily cron of the old API does not delete them; they hold
-- no address and can be emptied by hand); a later redeploy needs nothing first. Rotating BETTER_AUTH_SECRET orphans
-- every row, which only lifts the brakes then in force.
CREATE TABLE "sign_in_failure" (
	"count" integer NOT NULL,
	"key" text PRIMARY KEY NOT NULL,
	"next_allowed_at" timestamp with time zone,
	"window_started_at" timestamp with time zone NOT NULL
);
