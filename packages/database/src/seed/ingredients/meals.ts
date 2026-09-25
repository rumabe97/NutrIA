import type { IngredientSeed, MealSlot } from './types';

/**
 * Foods that belong only to some meals.
 *
 * An exception list, like `countries.ts`: a row absent from here belongs to
 * every meal, and almost every row is absent — rice, eggs and a tomato sit at
 * any table. What goes here is a food that reads wrong somewhere: a pulse that
 * is a lunch and not a dinner, a pastry that is a breakfast or a snack. A
 * meal's catalogue is the rows that are empty or name it, and a dish is served
 * only at the meals all of its ingredients share (`0062`).
 *
 * Empty for now. The column and every reader exist first, so filling this list
 * is a data change the owner reviews on its own, and until the seed is re-run
 * a database behaves exactly as it did before.
 */
const ONLY_AT: ReadonlyMap<string, readonly MealSlot[]> = new Map();

/** The meals a row belongs to, or empty for every meal. */
export function mealSlotsFor(entry: IngredientSeed): readonly MealSlot[] {
  return ONLY_AT.get(entry.slug) ?? [];
}
