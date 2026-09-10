import { boolean, customType, index, jsonb, numeric, pgTable, smallint, text, unique, uuid } from 'drizzle-orm/pg-core';

import { difficulty, measurementUnit, recipeSource } from './_enums';
import { ingredients } from './food.schema';
import { user } from './auth.schema';
import { timestamps } from './_columns';

/** `cue` is what the cook looks for before moving on — "until the edges brown", "until it stops steaming". */
export type RecipeStep = { readonly cue?: string; readonly minutes?: number; readonly text: string };

/**
 * Recipes are shared, not user-owned: an AI-generated one is reusable, and plan
 * history stays readable because a completed plan still points at its recipes.
 * `createdBy` is provenance, never an access check — visibility is decided by
 * the plan a recipe is attached to.
 */
export const recipes = pgTable(
  'recipes',
  {
    id: uuid().primaryKey().defaultRandom(),
    cookMinutes: smallint().notNull().default(0),
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    cuisine: text(),
    description: text(),
    difficulty: difficulty().notNull().default('easy'),
    imageUrl: text(),
    instructions: jsonb().$type<readonly RecipeStep[]>().notNull().default([]),
    /**
     * The language its name and steps are written in.
     *
     * Reuse is scoped to it. A recipe is genuinely locale-bound in a way an
     * ingredient is not: "Tostada de aguacate" and its Spanish method are one
     * artefact, and handing them to an English user is not a translation gap,
     * it is the wrong dish.
     */
    locale: text().notNull().default('es-ES'),
    /** Which slots this recipe is appropriate for; a plan meal must match one. */
    mealSlots: text().array().notNull().default([]),
    name: text().notNull(),
    prepMinutes: smallint().notNull().default(0),
    servings: smallint().notNull().default(1),
    slug: text().notNull().unique(),
    source: recipeSource().notNull().default('seed'),
    /**
     * Which prompt wrote `instructions`. Null for everything written before the
     * versions were recorded — the seed, and every dish generated up to 2.3.0.
     *
     * It exists to make one question answerable: *which recipes were written by a
     * prompt we have since improved.* Without it, "needs rewriting" has to be
     * guessed from the content, and a rewrite that happens to come back terse
     * would be swept again for ever. A stamp is checked once and is right.
     */
    stepsVersion: text()
  },
  table => [
    index('recipes_source_idx').on(table.source),
    index('recipes_cuisine_idx').on(table.cuisine),
    index('recipes_locale_idx').on(table.locale),
    // The rewriter's only query: everything not yet written by the current prompt.
    index('recipes_steps_version_idx').on(table.stepsVersion)
  ]
);

/**
 * `grams` is stored alongside the display quantity so the shopping list can sum
 * a single unit and the macro totals never depend on parsing "1 taza".
 */
export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: uuid().primaryKey().defaultRandom(),
    grams: numeric({ precision: 8, scale: 2 }).notNull(),
    ingredientId: uuid()
      .notNull()
      .references(() => ingredients.id, { onDelete: 'restrict' }),
    isOptional: boolean().notNull().default(false),
    note: text(),
    quantity: numeric({ precision: 8, scale: 2 }).notNull(),
    recipeId: uuid()
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    unit: measurementUnit().notNull().default('g'),
    ...timestamps
  },
  table => [
    unique('recipe_ingredients_unique').on(table.recipeId, table.ingredientId),
    index('recipe_ingredients_recipe_idx').on(table.recipeId),
    // The catalogue join every plan read makes. The unique constraint above
    // indexes (recipe_id, ingredient_id) in that order, which Postgres cannot use
    // to look up by ingredient alone.
    index('recipe_ingredients_ingredient_idx').on(table.ingredientId)
  ]
);

/** drizzle-pg has no `bytea`; postgres.js passes a Buffer through unchanged. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  }
});

/**
 * One illustration per recipe, stored here rather than in a blob store.
 *
 * An image lives with the recipe it depicts: shared across every plan that uses
 * the recipe, gone when the recipe goes. Sixty recipes at ~80 KB is a few
 * megabytes, served through one cacheable route — well under the point where a
 * second vendor earns its account, and it keeps the product runnable from a
 * database URL alone (0010). `model` and `promptVersion` say what drew it, so
 * a later, better illustrator can tell which rows are its own.
 */
export const recipeImages = pgTable('recipe_images', {
  bytes: bytea().notNull(),
  contentType: text().notNull(),
  height: smallint().notNull(),
  model: text().notNull(),
  promptVersion: text().notNull(),
  recipeId: uuid()
    .primaryKey()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  width: smallint().notNull(),
  ...timestamps
});
