import { index, numeric, pgTable, primaryKey, text, unique, uuid } from 'drizzle-orm/pg-core';

import { allergenPresence, ingredientCategory, measurementUnit, sentiment } from './_enums';
import { allergens } from './safety.schema';
import { timestamps } from './_columns';
import { userOwned } from './_utils';

/**
 * Structured nutrition, so macros are looked up rather than invented by a model
 * (§ AI does not control hard constraints). Everything is **per 100 g** — the
 * one normalisation that makes recipe totals a sum instead of a special case.
 *
 * No `name` column, and no `locale` one either. A name is not a property of an
 * ingredient, it is a property of an ingredient *in a language*, and a row-level
 * `locale` tag said the opposite: that a Spanish tomato and an English one were
 * two ingredients. They are one, with two names, in `ingredient_names`.
 */
/**
 * What a food *is*, for the questions allergens cannot answer: a way of eating
 * that excludes meat, a dislike of fish. Four of the seven are also allergens
 * and are derived from those links at seed time; `meat`, `pork` and a bare
 * `animal` (honey, gelatine, lard, a meat stock) exist only here. `pork`
 * implies `meat`, and everything implies `animal`.
 *
 * A column rather than a lookup at query time because every generation filters
 * the catalogue by it, and a rule that costs a join is a rule someone later
 * skips.
 */
export const FOOD_CLASSES = ['animal', 'dairy', 'egg', 'fish', 'meat', 'pork', 'shellfish'] as const;
export type FoodClass = (typeof FOOD_CLASSES)[number];

export const ingredients = pgTable(
  'ingredients',
  {
    id: uuid().primaryKey().defaultRandom(),
    carbsPer100g: numeric({ precision: 6, scale: 2 }).notNull(),
    category: ingredientCategory().notNull(),
    /** See `FOOD_CLASSES`. Empty for anything with no animal origin. */
    classes: text().array().notNull().default([]),
    /** Grams in one `defaultUnit`, so "2 eggs" becomes grams without a guess. */
    defaultUnit: measurementUnit().notNull().default('g'),
    fatPer100g: numeric({ precision: 6, scale: 2 }).notNull(),
    fiberPer100g: numeric({ precision: 6, scale: 2 }).notNull().default('0'),
    gramsPerUnit: numeric({ precision: 7, scale: 2 }),
    kcalPer100g: numeric({ precision: 6, scale: 2 }).notNull(),
    proteinPer100g: numeric({ precision: 6, scale: 2 }).notNull(),
    slug: text().notNull().unique(),
    /** Provenance of the nutrition figures, e.g. `bedca`, `usda`, `manual`. */
    source: text().notNull().default('manual')
  },
  table => [index('ingredients_category_idx').on(table.category)]
);

/**
 * One ingredient, one name per locale.
 *
 * The primary key is the pair, so a locale cannot end up with two names for the
 * same thing, and the cascade means a deleted ingredient takes its names with
 * it. A missing row is a real state — a locale the catalogue has not been
 * translated into yet — and the resolver falls back to `es-ES` and reports the
 * gap rather than showing a blank.
 */
export const ingredientNames = pgTable(
  'ingredient_names',
  {
    ingredientId: uuid()
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    /** BCP 47, matching `profiles.locale`. */
    locale: text().notNull(),
    name: text().notNull(),
    ...timestamps
  },
  table => [primaryKey({ columns: [table.ingredientId, table.locale] }), index('ingredient_names_locale_idx').on(table.locale)]
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
