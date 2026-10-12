-- One row per tier per limit, and only for limits somebody has moved from the
-- console (`0097`). A limit nobody has touched has no row and is whatever the
-- code ships, so this table is empty on the day it is created and the service
-- behaves exactly as it did before it existed.
--
-- Additive and alone: a new table, no column added to one in use, no data moved,
-- nothing locked that the API serving the old build is reading. The deploy that
-- runs this is safe with the previous build still up — it reads a table nothing
-- yet writes.
--
-- `key` is text and not an enum on purpose. The authority on which limits exist
-- is the code's registry (`ALLOWANCE_BOUNDS`), and a row naming a limit this
-- version does not have is ignored at read rather than honoured — the same
-- reasoning that keeps a flag's key out of the database's type system.
CREATE TABLE "tier_allowances" (
	"key" text NOT NULL,
	"tier" "user_tier" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "tier_allowances_tier_key_pk" PRIMARY KEY("tier","key")
);
