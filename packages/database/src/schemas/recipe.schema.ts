import { boolean, index, jsonb, numeric, pgTable, smallint, text, unique, uuid } from 'drizzle-orm/pg-core';

import { difficulty, measurementUnit, recipeSource } from './_enums';
import { ingredients } from './food.schema';
import { user } from './auth.schema';
import { timestamps } from './_columns';

export type RecipeStep = { readonly minutes?: number; readonly text: string; };

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
    source: recipeSource().notNull().default('seed')
  },
  table => [index('recipes_source_idx').on(table.source), index('recipes_cuisine_idx').on(table.cuisine), index('recipes_locale_idx').on(table.locale)]
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
    index('recipe_ingredients_recipe_idx').on(table.recipeId)
  ]
);
