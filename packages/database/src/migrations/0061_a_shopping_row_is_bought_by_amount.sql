ALTER TABLE "shopping_list_items" ADD COLUMN "bought_grams" numeric(9, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "dry_rounded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "grams_per_unit" numeric(9, 2);--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "per_day" jsonb;--> statement-breakpoint
-- Hand-added data step, the exception `packages/database/AGENTS.md` sanctions
-- (the shape of `0007`'s): drizzle-kit emits DDL and never the data move, and
-- these four columns arrive empty beside a `checked` flag that already means
-- "this whole row is bought". Without this, every row somebody had already
-- ticked would read as nothing bought the moment `0091`'s amount becomes the
-- truth — a shopper would be told to buy again what is in their cupboard.
--
-- Safe on the rows already there: it only ever writes `bought_grams` for rows
-- whose `checked` is already true, and it writes exactly that row's own
-- `total_grams`, which is precisely what `checked = true` asserted. An unticked
-- row keeps the column's `0` default. It touches no other column, is
-- idempotent (running it twice writes the same value), and needs no index.
-- `WHERE "checked"` also keeps it off the rows it has nothing to say about,
-- so the write set is as small as the claim.
--
-- The other three columns are deliberately left empty. `per_day` cannot be
-- backfilled here: the breakdown is computed from a plan's days by
-- `core/domain/ShoppingList`, which SQL cannot call, and guessing it by
-- dividing a total by fourteen would invent numbers a reader would then shop
-- from. A row with no breakdown reads as the whole plan's need under every
-- range (`rangeQuantity`), so an existing list stays correct and simply is not
-- filterable until its plan is regenerated, swapped or rebuilt.
--
-- On the lock, for whoever reads this when the table is bigger: drizzle wraps
-- every pending migration file in ONE transaction, so the `ACCESS EXCLUSIVE`
-- the four `ADD COLUMN`s take is held until this `UPDATE` commits — the table
-- is closed to reads and writes for its whole duration. The adds themselves are
-- O(1) (PG 11+, constant default, no rewrite); the cost is this seq scan and
-- one new tuple per ticked row. A few thousand rows is a non-event; around
-- 100k ticked rows is a second or two, and a million is tens of seconds of a
-- closed table, which the shared pooler would spread to unrelated endpoints.
-- **Splitting this into two migration FILES would not shorten the lock** — one
-- transaction spans all pending files. It takes two deploys: the DDL merged and
-- `Ready`, the backfill merged after.
UPDATE "shopping_list_items" SET "bought_grams" = "total_grams" WHERE "checked";
