import { aliasedTable, and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { ingredientAllergens, ingredientNames, ingredients } from 'database/schema/food';
import { recipeImages, recipeIngredients, recipes } from 'database/schema/recipe';

import { DatabaseOperationError } from 'core/entities/Error';
import type { CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { RecipeStep } from 'database/schema/recipe';

export type ReusableRecipe = {
  readonly id: string;
  readonly cookMinutes: number;
  readonly cuisine: string | null;
  readonly difficulty: 'easy' | 'hard' | 'medium';
  readonly ingredients: readonly { readonly grams: number; readonly slug: string }[];
  readonly mealSlots: readonly MealSlot[];
  readonly name: string;
  readonly prepMinutes: number;
  readonly servings: number;
  readonly slug: string;
  readonly steps: readonly { readonly minutes?: number; readonly text: string }[];
};

/**
 * The language every catalogue name is guaranteed to exist in.
 *
 * Spanish is the product's first language and the one the seed has always
 * written, so it is the only safe fallback. A resolver with no fallback would
 * hand back an empty name the first time a locale was added.
 */
export const FALLBACK_LOCALE = 'es-ES';

export type UndocumentedRecipe = {
  readonly id: string;
  readonly cookMinutes: number;
  readonly ingredients: readonly { readonly grams: number; readonly name: string }[];
  readonly locale: string;
  readonly name: string;
  readonly prepMinutes: number;
  readonly servings: number;
  readonly steps: readonly RecipeStep[];
};

export const RecipeRepository = {
  /** The stored illustration, or nothing. Bytes only — the route adds the headers. */
  async findImage(recipeId: string): Promise<{ readonly bytes: Buffer; readonly contentType: string } | undefined> {
    try {
      const [row] = await database()
        .select({ bytes: recipeImages.bytes, contentType: recipeImages.contentType })
        .from(recipeImages)
        .where(eq(recipeImages.recipeId, recipeId))
        .limit(1);

      return row;
    } catch (error: unknown) {
      throw wrap(error, 'recipe_images');
    }
  },

  /**
   * Recipes already in the library that could fill one of these slots.
   *
   * Returns candidates, **not** approved dishes. Safety is decided by
   * `findSafetyViolations` in the controller, over the ingredients returned here —
   * a recipe existing in the database says nothing about whether it is safe for a
   * particular person. See `docs/decisions/0006-reuse-before-generating.md`.
   */
  async findReusable(slots: readonly MealSlot[], limit: number, locale: string): Promise<readonly ReusableRecipe[]> {
    if (slots.length === 0) {return [];}

    try {
      const db = database();

      const rows = await db
        .select()
        .from(recipes)
        // `meal_slots` is a text[]; overlap is the array-aware form of "any of these".
        //
        // Scoped to the locale, and this is not a nicety: a recipe's name and
        // method are one artefact written in one language. Handing "Tostada de
        // aguacate" to an English user is not a translation gap, it is the wrong
        // dish — and reuse would otherwise quietly undo everything else here.
        .where(
          and(eq(recipes.locale, locale), sql`${recipes.mealSlots} && ${sql.raw(`ARRAY[${slots.map(slot => `'${slot}'`).join(',')}]::text[]`)}`)
        )
        .limit(limit);

      if (rows.length === 0) {return [];}

      const items = await db
        .select({ grams: recipeIngredients.grams, recipeId: recipeIngredients.recipeId, slug: ingredients.slug })
        .from(recipeIngredients)
        .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
        .where(
          and(
            inArray(
              recipeIngredients.recipeId,
              rows.map(row => row.id)
            ),
            eq(recipeIngredients.isOptional, false)
          )
        );

      const byRecipe = new Map<string, { grams: number; slug: string }[]>();

      for (const item of items) {
        byRecipe.set(item.recipeId, [...(byRecipe.get(item.recipeId) ?? []), { grams: Number(item.grams), slug: item.slug }]);
      }

      return rows
        .map(row => ({
          id: row.id,
          cookMinutes: row.cookMinutes,
          cuisine: row.cuisine,
          difficulty: row.difficulty,
          ingredients: byRecipe.get(row.id) ?? [],
          mealSlots: row.mealSlots as readonly MealSlot[],
          name: row.name,
          prepMinutes: row.prepMinutes,
          servings: row.servings,
          slug: row.slug,
          steps: row.instructions
        }))
        .filter(recipe => recipe.ingredients.length > 0);
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  },

  /**
   * The whole ingredient catalogue, with allergen links attached.
   *
   * Loaded once per generation and passed down: every macro sum and every allergy
   * check reads from this, so it must be one query rather than a lookup per
   * ingredient inside a loop over fourteen days of meals.
   */
  /**
   * Recipes whose steps predate the current prompt, with everything needed to
   * rewrite them: the dish, its times, its ingredients in its own language, and
   * the steps as they stand.
   *
   * Nothing about any person is here and nothing can be — a recipe is shared, and
   * the rewriter is given a dish, not a diner.
   */
  async findUndocumented(stepsVersion: string, limit: number): Promise<readonly UndocumentedRecipe[]> {
    try {
      const db = database();
      const rows = await db
        .select({
          id: recipes.id,
          cookMinutes: recipes.cookMinutes,
          locale: recipes.locale,
          name: recipes.name,
          prepMinutes: recipes.prepMinutes,
          servings: recipes.servings,
          steps: recipes.instructions
        })
        .from(recipes)
        .where(or(isNull(recipes.stepsVersion), ne(recipes.stepsVersion, stepsVersion)))
        .orderBy(recipes.id)
        .limit(limit);

      if (rows.length === 0) {return [];}

      const items = await db
        .select({ grams: recipeIngredients.grams, locale: ingredientNames.locale, name: ingredientNames.name, recipeId: recipeIngredients.recipeId })
        .from(recipeIngredients)
        .innerJoin(ingredientNames, eq(ingredientNames.ingredientId, recipeIngredients.ingredientId))
        .where(
          inArray(
            recipeIngredients.recipeId,
            rows.map(row => row.id)
          )
        );

      return rows.map(row => ({
        ...row,
        ingredients: items
          .filter(item => item.recipeId === row.id && item.locale === row.locale)
          .map(item => ({ grams: Number(item.grams), name: item.name }))
      }));
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  },

  /**
   * Recipes still waiting for an illustration, oldest first, with what the
   * illustrator needs to describe them: the name and the ingredient names in the
   * recipe's own language. Nothing about any person is here, and nothing can be.
   */
  async findWithoutImage(limit: number): Promise<readonly { readonly id: string; readonly ingredientNames: readonly string[]; readonly locale: string; readonly name: string }[]> {
    try {
      const db = database();
      const rows = await db
        .select({ id: recipes.id, locale: recipes.locale, name: recipes.name })
        .from(recipes)
        .leftJoin(recipeImages, eq(recipeImages.recipeId, recipes.id))
        .where(isNull(recipeImages.recipeId))
        .orderBy(recipes.id)
        .limit(limit);

      if (rows.length === 0) {return [];}

      const names = await db
        .select({ locale: ingredientNames.locale, name: ingredientNames.name, recipeId: recipeIngredients.recipeId })
        .from(recipeIngredients)
        .innerJoin(ingredientNames, eq(ingredientNames.ingredientId, recipeIngredients.ingredientId))
        .where(
          inArray(
            recipeIngredients.recipeId,
            rows.map(row => row.id)
          )
        );

      return rows.map(row => ({
        ...row,
        ingredientNames: names.filter(name => name.recipeId === row.id && name.locale === row.locale).map(name => name.name)
      }));
    } catch (error: unknown) {
      throw wrap(error, 'recipe_images');
    }
  },

  async loadCatalogue(locale: string): Promise<readonly CatalogueIngredient[]> {
    try {
      const db = database();
      // Two joins rather than one, so a missing translation is visible instead of
      // absent: `requested` is null exactly when this locale has no name, and the
      // caller is told which locale it actually got.
      const requested = aliasedTable(ingredientNames, 'requested_name');
      const fallback = aliasedTable(ingredientNames, 'fallback_name');

      const [rows, links] = await Promise.all([
        db
          .select({
            id: ingredients.id,
            carbsPer100g: ingredients.carbsPer100g,
            category: ingredients.category,
            defaultUnit: ingredients.defaultUnit,
            fallbackName: fallback.name,
            fatPer100g: ingredients.fatPer100g,
            fiberPer100g: ingredients.fiberPer100g,
            gramsPerUnit: ingredients.gramsPerUnit,
            kcalPer100g: ingredients.kcalPer100g,
            proteinPer100g: ingredients.proteinPer100g,
            requestedName: requested.name,
            slug: ingredients.slug
          })
          .from(ingredients)
          .leftJoin(requested, and(eq(requested.ingredientId, ingredients.id), eq(requested.locale, locale)))
          .leftJoin(fallback, and(eq(fallback.ingredientId, ingredients.id), eq(fallback.locale, FALLBACK_LOCALE))),
        db.select({ allergenId: ingredientAllergens.allergenId, ingredientId: ingredientAllergens.ingredientId, presence: ingredientAllergens.presence }).from(ingredientAllergens)
      ]);

      const byIngredient = new Map<string, { allergenId: string; presence: 'contains' | 'may_contain' }[]>();

      for (const link of links) {
        byIngredient.set(link.ingredientId, [...(byIngredient.get(link.ingredientId) ?? []), { allergenId: link.allergenId, presence: link.presence }]);
      }

      return rows.map(row => ({
        id: row.id,
        allergens: byIngredient.get(row.id) ?? [],
        carbsPer100g: Number(row.carbsPer100g),
        category: row.category,
        defaultUnit: row.defaultUnit,
        fatPer100g: Number(row.fatPer100g),
        fiberPer100g: Number(row.fiberPer100g),
        gramsPerUnit: row.gramsPerUnit === null ? null : Number(row.gramsPerUnit),
        kcalPer100g: Number(row.kcalPer100g),
        // The slug is the last resort. An ingredient with no name in any locale
        // is a broken seed, and showing "pan-integral" says so; showing nothing
        // hides it.
        name: row.requestedName ?? row.fallbackName ?? row.slug,
        nameLocale: row.requestedName === null ? FALLBACK_LOCALE : locale,
        proteinPer100g: Number(row.proteinPer100g),
        slug: row.slug
      }));
    } catch (error: unknown) {
      throw wrap(error, 'ingredients');
    }
  },

  /** Replaces any existing illustration; a re-drawn recipe keeps one row. */
  async saveImage(recipeId: string, image: { readonly bytes: Buffer; readonly contentType: string; readonly height: number; readonly model: string; readonly promptVersion: string; readonly width: number }): Promise<void> {
    try {
      await database()
        .insert(recipeImages)
        .values({ recipeId, ...image })
        .onConflictDoUpdate({ set: { ...image, updatedAt: new Date() }, target: recipeImages.recipeId });
    } catch (error: unknown) {
      throw wrap(error, 'recipe_images');
    }
  },

  /**
   * Replaces a recipe's method and stamps who wrote it. **Only** `instructions`
   * and `steps_version`: the ingredients, the grams and the macros every plan
   * already computed from them are untouched, so a rewrite cannot change what a
   * past plan says anyone ate.
   */
  async updateSteps(recipeId: string, steps: readonly RecipeStep[], stepsVersion: string): Promise<void> {
    try {
      await database().update(recipes).set({ instructions: steps, stepsVersion }).where(eq(recipes.id, recipeId));
    } catch (error: unknown) {
      throw wrap(error, 'recipes');
    }
  }
};

function wrap(error: unknown, table: string): DatabaseOperationError {
  if (error instanceof ZodError) {return new DatabaseOperationError(`Schema mismatch on ${table}: ${error.message}`);}

  return new DatabaseOperationError();
}
