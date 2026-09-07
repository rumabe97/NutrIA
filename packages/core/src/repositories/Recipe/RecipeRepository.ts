import { and, eq, inArray, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { ingredientAllergens, ingredients } from 'database/schema/food';
import { recipeIngredients, recipes } from 'database/schema/recipe';

import { DatabaseOperationError } from 'core/entities/Error';
import type { CatalogueIngredient, MealSlot } from 'core/entities/Plan';

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

export const RecipeRepository = {
  /**
   * Recipes already in the library that could fill one of these slots.
   *
   * Returns candidates, **not** approved dishes. Safety is decided by
   * `findSafetyViolations` in the controller, over the ingredients returned here —
   * a recipe existing in the database says nothing about whether it is safe for a
   * particular person. See `docs/decisions/0006-reuse-before-generating.md`.
   */
  async findReusable(slots: readonly MealSlot[], limit: number): Promise<readonly ReusableRecipe[]> {
    if (slots.length === 0) {return [];}

    try {
      const db = database();

      const rows = await db
        .select()
        .from(recipes)
        // `meal_slots` is a text[]; overlap is the array-aware form of "any of these".
        .where(sql`${recipes.mealSlots} && ${sql.raw(`ARRAY[${slots.map(slot => `'${slot}'`).join(',')}]::text[]`)}`)
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
  async loadCatalogue(): Promise<readonly CatalogueIngredient[]> {
    try {
      const db = database();

      const [rows, links] = await Promise.all([
        db.select().from(ingredients),
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
        name: row.name,
        proteinPer100g: Number(row.proteinPer100g),
        slug: row.slug
      }));
    } catch (error: unknown) {
      throw wrap(error, 'ingredients');
    }
  }
};

function wrap(error: unknown, table: string): DatabaseOperationError {
  if (error instanceof ZodError) {return new DatabaseOperationError(`Schema mismatch on ${table}: ${error.message}`);}

  return new DatabaseOperationError();
}
