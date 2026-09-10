-- What an account is allowed to spend (`0042`).
--
-- Every existing account becomes `free`, which is what they already were: the
-- allowances they have been living under are the free ones. Nobody's limits
-- change on the day this runs.
--
-- No dates here. While the owner grants the tier by hand there is nothing to
-- expire, and if billing ever writes it, the periods belong to the subscription
-- that decided them, not to this column.
CREATE TYPE "public"."user_tier" AS ENUM('free', 'premium');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "tier" "user_tier" DEFAULT 'free' NOT NULL;
