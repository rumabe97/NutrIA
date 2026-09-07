import { boolean, index, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';

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
 */
export const shoppingListItems = pgTable(
  'shopping_list_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** True for rows the user typed in themselves; regeneration keeps these. */
    addedManually: boolean().notNull().default(false),
    category: ingredientCategory().notNull(),
    checked: boolean().notNull().default(false),
    displayQuantity: numeric({ precision: 9, scale: 2 }).notNull(),
    displayUnit: measurementUnit().notNull().default('g'),
    ingredientId: uuid().references(() => ingredients.id, { onDelete: 'set null' }),
    listId: uuid()
      .notNull()
      .references(() => shoppingLists.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    totalGrams: numeric({ precision: 9, scale: 2 }).notNull(),
    ...timestamps
  },
  table => [index('shopping_list_items_list_idx').on(table.listId), index('shopping_list_items_category_idx').on(table.category)]
);
