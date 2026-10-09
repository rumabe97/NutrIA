import { boolean, index, jsonb, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { ingredientCategory, measurementUnit } from './_enums';
import { ingredients } from './food.schema';
import { mealPlans } from './plan.schema';
import { timestamps } from './_columns';
import { userOwned } from './_utils';

/** Exactly one list per plan — the list is a projection of the plan, never free-standing. */
export const shoppingLists = userOwned('shopping_lists', {
  planId: uuid()
    .notNull()
    .unique()
    .references(() => mealPlans.id, { onDelete: 'cascade' })
});

/**
 * Aggregation is deterministic code, not a model call: three "tomate" lines
 * across the fortnight become one row of 450 g. `totalGrams` is the summed
 * canonical unit; `displayQuantity`/`displayUnit` are what the shop-floor reader
 * sees. `name` and `category` are snapshotted so a historical list stays
 * readable after the catalogue moves on.
 *
 * The row is read by range and bought by amount (`0091`). It keeps one row per
 * ingredient per plan — a range changes the quantity a row shows, never its
 * identity — and carries what each day of the plan owes it, so a reader with no
 * signal can filter the fortnight down to three days without asking the server
 * (`0053`).
 */
export const shoppingListItems = pgTable(
  'shopping_list_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** True for rows the user typed in themselves; regeneration keeps these. */
    addedManually: boolean().notNull().default(false),
    /**
     * How much of this row has been bought, in grams (`0091`). The truth a
     * partial shop is recorded in: buy the week's 500 g of the fortnight's
     * 1.2 kg and 700 g are still to buy, whichever range the row is read in.
     * Capped at `totalGrams` and floored at zero by the write, whatever a
     * client sends.
     */
    boughtGrams: numeric({ precision: 9, scale: 2 }).notNull().default('0'),
    category: ingredientCategory().notNull(),
    /**
     * Derived from `boughtGrams` — true when the whole plan's need is covered.
     * Kept for one release because the web build live during a deploy writes
     * and reads it (`0091`). That is the whole reason: these two tables have
     * exactly one reader and writer, `PlanRepository`, and the only screen that
     * reads this flag is the web shopping list. Nothing else — no console, no
     * report — depends on it, so the release that stops the old build reaching
     * production is the release this column can go.
     */
    checked: boolean().notNull().default(false),
    displayQuantity: numeric({ precision: 9, scale: 2 }).notNull(),
    displayUnit: measurementUnit().notNull().default('g'),
    /**
     * Whether this row's weight came off a cooked grain and a range's sum must
     * be rounded up to the 5 g step (`0078`). It cannot be inferred from the
     * row: a plan holding cooked *and* dry couscous merges into one row named
     * and slugged after the **dry** food.
     */
    dryRounded: boolean().notNull().default(false),
    /**
     * What one unit of a countable weighs, snapshotted like `name` — three eggs
     * for 150 g does not say that an egg is 58 g, and without it a range's own
     * `ceil(grams / 58)` cannot be computed. Null for anything sold by weight.
     */
    gramsPerUnit: numeric({ precision: 9, scale: 2 }),
    ingredientId: uuid().references(() => ingredients.id, { onDelete: 'set null' }),
    listId: uuid()
      .notNull()
      .references(() => shoppingLists.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /**
     * What each day of the plan owes this row: `{ "2026-03-01": 100.5, … }`,
     * the day's own date against unrounded grams, already dry where `0078`
     * applies. Exactly `ShoppingPerDay` in `core/domain/ShoppingList`, so it is
     * stored and read with no conversion, and `rangeQuantity` sums it the same
     * way on the server and in the browser.
     *
     * Null on a row nobody built from days — one somebody typed in themselves,
     * or one stored before this column existed. Such a row reads as the whole
     * plan's need under every range, which is what keeps it visible.
     */
    perDay: jsonb().$type<Record<string, number>>(),
    totalGrams: numeric({ precision: 9, scale: 2 }).notNull(),
    ...timestamps
  },
  table => [index('shopping_list_items_list_idx').on(table.listId), index('shopping_list_items_category_idx').on(table.category)]
);
