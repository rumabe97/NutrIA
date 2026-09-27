import { sql } from 'drizzle-orm';
import { boolean, check, customType, index, jsonb, numeric, pgTable, smallint, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

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
     * Until when a rewrite sweep holds this recipe. Taken in the same statement
     * that picks it, so two sweeps started together — "Run" pressed twice — each
     * rewrite different recipes instead of the same twelve. Null for a recipe no
     * sweep has held, and a past time is a claim that lapsed.
     */
    stepsClaimedUntil: timestamp({ withTimezone: true }),
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
 * One picture per recipe (0066): where the file lives in Vercel Blob and how
 * far its drawing got. The file itself is never here — Neon's free plan would
 * fill and block plan writes — and it is shared by every viewer of the dish,
 * gone when the recipe goes.
 *
 * `status` is the drawing's state: `drawing` from the claim until the drawing
 * ends, then `ready` with its `url`, or `failed` until the cool-off lets
 * someone claim it again. `model` and `promptVersion` say what drew it and are
 * set when it is ready, so a claimed row has neither yet. `provenance` is what
 * was checked on the file (the C2PA manifest found or not, the judge's notes).
 *
 * `bytes`, `contentType`, `width` and `height` are `0010`'s stored image. No
 * code writes them any more; a later migration drops them once no running code
 * reads them.
 */
export const recipeImages = pgTable(
  'recipe_images',
  {
    attempts: smallint().notNull().default(0),
    bytes: bytea(),
    contentType: text(),
    height: smallint(),
    lastAttemptAt: timestamp({ withTimezone: true }),
    model: text(),
    promptVersion: text(),
    provenance: jsonb().$type<Record<string, unknown>>(),
    recipeId: uuid()
      .primaryKey()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    status: text().notNull().default('ready'),
    url: text(),
    width: smallint(),
    ...timestamps
  },
  table => [check('recipe_images_status', sql`${table.status} in ('drawing', 'ready', 'failed')`)]
);

/**
 * Every paid call made to draw or judge a picture (0066), with what it cost.
 * The month's picture spend is the sum of `costUsd` since the month began, so
 * the cap is read from what was billed, never from a counter that can drift.
 * No person is named here: a picture belongs to a dish, not to whoever opened it.
 */
export const recipeImageCalls = pgTable(
  'recipe_image_calls',
  {
    id: uuid().primaryKey().defaultRandom(),
    costUsd: numeric({ precision: 10, scale: 6 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    kind: text().notNull(),
    model: text().notNull(),
    outcome: text(),
    // Kept when the recipe goes: what was billed stays in the month's spend.
    recipeId: uuid().references(() => recipes.id, { onDelete: 'set null' })
  },
  table => [
    // What the month's spend is summed by.
    index('recipe_image_calls_created_at_idx').on(table.createdAt),
    index('recipe_image_calls_recipe_id_idx').on(table.recipeId),
    check('recipe_image_calls_kind', sql`${table.kind} in ('image', 'judge')`)
  ]
);
