import { z } from 'zod';

import { macrosSchema } from 'core/entities/Nutrition';
import type { Macros, NutritionTargets } from 'core/entities/Nutrition';

/** Ordered as they occur in a day. Mirrors the `meal_slot` enum in the database. */
export const MEAL_SLOTS = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** Slots assembled from a few ingredients rather than cooked — see PRD 002 resolution 3. */
export const SNACK_SLOTS: readonly MealSlot[] = ['morning_snack', 'afternoon_snack'];

export const INGREDIENT_CATEGORIES = ['produce', 'protein', 'dairy', 'pantry', 'frozen', 'bakery', 'beverages', 'other'] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const MEASUREMENT_UNITS = ['g', 'ml', 'unit', 'tbsp', 'tsp', 'cup', 'slice', 'pinch'] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

/**
 * An ingredient as the domain layer needs it: macros per 100 g, plus the allergen
 * links the safety gate compares against. Assembled from the `ingredients` and
 * `ingredient_allergens` tables by a repository — the domain never queries.
 */
export type CatalogueIngredient = {
  readonly id: string;
  readonly allergens: readonly { readonly allergenId: string; readonly presence: 'contains' | 'may_contain' }[];
  readonly carbsPer100g: number;
  readonly category: IngredientCategory;
  readonly defaultUnit: MeasurementUnit;
  readonly fatPer100g: number;
  readonly fiberPer100g: number;
  readonly gramsPerUnit: number | null;
  readonly kcalPer100g: number;
  readonly name: string;
  /**
   * The locale `name` actually came from.
   *
   * Not the same as the locale that was asked for: a catalogue with no entry in
   * the requested language falls back to `es-ES`, and this is how a caller can
   * tell — and report the gap — instead of the fallback passing silently for a
   * translation.
   */
  readonly nameLocale: string;
  readonly proteinPer100g: number;
  readonly slug: string;
};

/** Keyed by slug, because that is the identifier a model is given and returns. */
export type Catalogue = ReadonlyMap<string, CatalogueIngredient>;

export function toCatalogue(ingredients: readonly CatalogueIngredient[]): Catalogue {
  return new Map(ingredients.map(ingredient => [ingredient.slug, ingredient]));
}

export const dishIngredientSchema = z.object({ grams: z.number().positive().max(2000), slug: z.string().min(1) });

/**
 * A dish proposed for the pool. Quantities are for `servings` servings — the
 * scheduler scales from here.
 *
 * Note what is absent: no calories, no macros. Those are computed from the
 * catalogue ([`0004`](../../../../docs/decisions/0004-deterministic-safety-layer.md)),
 * so there is nowhere for a generated number to be stored even by accident.
 */
export const candidateDishSchema = z.object({
  cookMinutes: z.number().int().min(0).max(240),
  cuisine: z.string().max(60).nullish(),
  difficulty: z.enum(DIFFICULTIES),
  ingredients: z.array(dishIngredientSchema).min(1).max(20),
  name: z.string().min(1).max(120),
  prepMinutes: z.number().int().min(0).max(240),
  servings: z.number().min(0.25).max(8),
  slots: z.array(z.enum(MEAL_SLOTS)).min(1),
  slug: z.string().min(1).max(140),
  // At least one, always: see `domain/Method`, which is where the floor is decided
  // and where the provider's output and the reuse pool are both measured against it.
  steps: z.array(z.object({ minutes: z.number().int().min(0).max(240).optional(), text: z.string().min(1).max(600) })).min(1).max(15)
});

export type CandidateDish = z.infer<typeof candidateDishSchema>;

/** One dish placed in one slot on one day, with its scaled quantities and macros. */
export type ScheduledMeal = {
  readonly dish: CandidateDish;
  /** Scaled to `servings`; what the shopping list and the meal detail both read. */
  readonly ingredients: readonly { readonly grams: number; readonly slug: string }[];
  readonly macros: Macros;
  readonly servings: number;
  readonly slot: MealSlot;
  readonly sortOrder: number;
};

export type PlanDayAssignment = {
  readonly dayIndex: number;
  readonly meals: readonly ScheduledMeal[];
  readonly totals: Macros;
};

export type PlanAssignment = { readonly days: readonly PlanDayAssignment[] };

export type ShoppingDraftItem = {
  readonly category: IngredientCategory;
  readonly displayQuantity: number;
  readonly displayUnit: MeasurementUnit;
  readonly ingredientId: string;
  readonly name: string;
  readonly slug: string;
  readonly totalGrams: number;
};

export type ShoppingDraft = { readonly items: readonly ShoppingDraftItem[] };

export { macrosSchema };
export type { Macros };

// ── Persistence drafts ────────────────────────────────────────────────────
// What the generator hands the repository. Shapes only, so they live here rather
// than in the repository, which is private to this package.

/** A recipe the generator produced and that must be persisted with the plan. */
export type RecipeDraft = {
  readonly cookMinutes: number;
  readonly cuisine: string | null;
  readonly difficulty: 'easy' | 'hard' | 'medium';
  readonly ingredients: readonly { readonly grams: number; readonly ingredientId: string; readonly unit: MeasurementUnit }[];
  readonly mealSlots: readonly MealSlot[];
  readonly name: string;
  readonly prepMinutes: number;
  readonly servings: number;
  readonly slug: string;
  readonly steps: readonly { readonly minutes?: number; readonly text: string }[];
};

export type MealDraft = {
  readonly carbsG: number;
  readonly fatG: number;
  readonly fiberG: number;
  readonly kcal: number;
  readonly proteinG: number;
  readonly recipeSlug: string;
  readonly servings: number;
  readonly slot: MealSlot;
  readonly sortOrder: number;
};

export type ShoppingItemDraft = {
  readonly category: IngredientCategory;
  readonly displayQuantity: number;
  readonly displayUnit: MeasurementUnit;
  readonly ingredientId: string;
  readonly name: string;
  readonly totalGrams: number;
};

export type PlanDraft = {
  readonly days: readonly { readonly date: string; readonly dayIndex: number; readonly meals: readonly MealDraft[] }[];
  readonly endDate: string;
  readonly generationMetadata: Record<string, unknown>;
  /** The language the dishes were written in. Stored on each new recipe, and what scopes reuse. */
  readonly locale: string;
  readonly newRecipes: readonly RecipeDraft[];
  readonly shoppingItems: readonly ShoppingItemDraft[];
  readonly startDate: string;
  readonly strategy: NutritionTargets;
};

/** The only field a shopping-list item exposes for writing. */
export const setShoppingItemSchema = z.object({ checked: z.boolean() });

export type SetShoppingItem = z.infer<typeof setShoppingItemSchema>;
