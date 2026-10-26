import { numeric, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { ingredients } from './food.schema';
import { measurementUnit } from './_enums';
import { userOwned } from './_utils';

/**
 * What one person says is already in the house, while they are typing it.
 *
 * Rows, the way `kitchen_equipment` is rows and for the same reason: a cupboard
 * is a short list of things somebody spoke about. **No row is an empty
 * cupboard**, so an account that never said anything stores nothing at all.
 *
 * It is a **draft and never a larder** (`0012` § 6, and the owner's decision of
 * 2026-10-22): it is typed before a fortnight exists, the generation that reads
 * it spends it, and it is cleared with that generation. That is why there is no
 * date, no expiry and nothing that could age into "we think you still have that
 * yoghurt" — a freshness model is the one thing this product cannot honestly
 * carry, and the lifetime is what makes it unnecessary rather than deferred.
 *
 * **A cupboard shortens the shopping list; it changes no pick** (the owner,
 * 2026-10-23). Nothing here reaches `SafetyProfile`, nothing here removes a
 * dish, and nothing here is a restriction: what somebody *has* is not what
 * somebody *may eat*.
 *
 * `label` is what the person typed or picked and is theirs alone — it is shown
 * back to them and never put in a prompt, a log or an error. `ingredientId` is
 * what we could resolve it to, and a **catalogue slug is the only thing that
 * ever leaves the product** (PRD 022, criterion 7). Null is a real state and not
 * a failure: an entry nothing in the catalogue answers is kept, with its word,
 * because tomorrow the catalogue may answer it and because in aggregate those
 * words are the library's own to-do list.
 *
 * `grams` and `unit` are null for *"I have some"* — the honest answer for a bag
 * of rice nobody weighed — which is a different fact from *"I have all of it"*
 * and is why the amount is nullable rather than defaulted. A unit without an
 * amount is refused by `addPantryItemSchema`, so the pair below holds for every
 * row a route can write.
 *
 * **The cascade on `ingredientId` is the one place this file does not keep the
 * word**, and it is deliberate. `SET NULL` reads better — the entry would
 * survive its ingredient as an unresolved one — but it can make a catalogue
 * write *fail*: an account holding the same word once resolved and once not
 * would have both rows become `(null, <word>)`, and
 * `pantry_items_one_per_unresolved_label` would abort the `DELETE FROM
 * ingredients` with a 23505 naming nobody, during the API's build against
 * production. Cascade cannot fail, and what it costs is one row of a draft that
 * the next generation would have spent anyway. `food_preferences.ingredientId`
 * — the same shape, a typed label beside a nullable id — cascades for the same
 * reason; `custom_allergens` is the one that uses `SET NULL`, because there the
 * failure direction is a claim of enforcement outliving the thing enforced.
 *
 * `normalisedLabel` is `normaliseForMatching(label)` from
 * `core/domain/Safety`, written by the repository and read by nothing else: it
 * exists so the second unique index below can be a plain one. Postgres cannot
 * reproduce that function — NFD, Unicode diacritic stripping, punctuation
 * flattened — in an immutable index expression, and a SQL normaliser that
 * nearly agreed with it would be a second normaliser, which is the one thing
 * this feature may not have.
 *
 * **The uniqueness is two partial indexes, not one**, and it is the detail a
 * first draft gets wrong: Postgres counts NULLs as distinct, so a plain
 * `unique(userId, ingredientId)` lets every *unresolved* label in twice over.
 * One index holds the resolved rows by what they resolved to, the other holds
 * the unresolved ones by their normalised word. They are in the database for
 * exactly the reason `kitchen_equipment_one_per_appliance` is: a double tap, or
 * two tabs, has both requests reading "no row yet" under READ COMMITTED and
 * both inserting.
 */
export const pantryItems = userOwned(
  'pantry_items',
  {
    /** How much, where the person knows. Null is *"I have some"*, not *"I have none"*. */
    grams: numeric({ precision: 9, scale: 2 }),
    /** Null when the catalogue has no answer for what was typed — kept, never guessed. */
    ingredientId: uuid().references(() => ingredients.id, { onDelete: 'cascade' }),
    label: text().notNull(),
    /** `normaliseForMatching(label)`, so the second index below needs no SQL normaliser. */
    normalisedLabel: text().notNull(),
    /** What the person counted in, where they said. Null wherever `grams` is. */
    unit: measurementUnit()
  },
  table => [
    uniqueIndex('pantry_items_one_per_ingredient')
      .on(table.userId, table.ingredientId)
      .where(sql`${table.ingredientId} is not null`),
    uniqueIndex('pantry_items_one_per_unresolved_label')
      .on(table.userId, table.normalisedLabel)
      .where(sql`${table.ingredientId} is null`)
  ]
);
