import { index, numeric, pgTable, primaryKey, text, unique, uuid } from 'drizzle-orm/pg-core';

import { allergenPresence, ingredientCategory, measurementUnit, sentiment } from './_enums';
import { allergens } from './safety.schema';
import { timestamps } from './_columns';
import { userOwned } from './_utils';

/**
 * Structured nutrition, so macros are looked up rather than invented by a model
 * (§ AI does not control hard constraints). Everything is **per 100 g** — the
 * one normalisation that makes recipe totals a sum instead of a special case.
 */
export const ingredients = pgTable(
  'ingredients',
  {
    id: uuid().primaryKey().defaultRandom(),
    carbsPer100g: numeric({ precision: 6, scale: 2 }).notNull(),
    category: ingredientCategory().notNull(),
    /** Grams in one `defaultUnit`, so "2 eggs" becomes grams without a guess. */
    defaultUnit: measurementUnit().notNull().default('g'),
    fatPer100g: numeric({ precision: 6, scale: 2 }).notNull(),
    fiberPer100g: numeric({ precision: 6, scale: 2 }).notNull().default('0'),
    gramsPerUnit: numeric({ precision: 7, scale: 2 }),
    kcalPer100g: numeric({ precision: 6, scale: 2 }).notNull(),
    locale: text().notNull().default('es-ES'),
    name: text().notNull(),
    proteinPer100g: numeric({ precision: 6, scale: 2 }).notNull(),
    slug: text().notNull().unique(),
    /** Provenance of the nutrition figures, e.g. `bedca`, `usda`, `manual`. */
    source: text().notNull().default('manual')
  },
  table => [index('ingredients_category_idx').on(table.category)]
);

/**
 * `contains` is a hard exclusion for anyone with that allergy; `may_contain`
 * only excludes users who set `crossContaminationSensitive`.
 */
export const ingredientAllergens = pgTable(
  'ingredient_allergens',
  {
    allergenId: uuid()
      .notNull()
      .references(() => allergens.id, { onDelete: 'cascade' }),
    ingredientId: uuid()
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    presence: allergenPresence().notNull().default('contains'),
    ...timestamps
  },
  table => [primaryKey({ columns: [table.ingredientId, table.allergenId] }), index('ingredient_allergens_allergen_idx').on(table.allergenId)]
);

/** Powers "no tengo aguacate" without asking a model to improvise nutrition. */
export const ingredientSubstitutions = pgTable(
  'ingredient_substitutions',
  {
    id: uuid().primaryKey().defaultRandom(),
    ingredientId: uuid()
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    note: text(),
    /** Grams of substitute per gram of original. */
    ratio: numeric({ precision: 5, scale: 3 }).notNull().default('1'),
    substituteId: uuid()
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  table => [unique('ingredient_substitutions_pair_key').on(table.ingredientId, table.substituteId)]
);

/** Per-user likes and dislikes at the ingredient level; feeds plan generation. */
export const foodPreferences = userOwned('food_preferences', {
  /** Null when the user typed something not yet in the catalogue. */
  ingredientId: uuid().references(() => ingredients.id, { onDelete: 'cascade' }),
  label: text().notNull(),
  sentiment: sentiment().notNull(),
  /** Grows as the check-in loop confirms the signal. */
  weight: numeric({ precision: 4, scale: 2 }).notNull().default('1')
});
