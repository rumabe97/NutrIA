import { composePerServing } from 'core/domain/Composition';
import { fitSlots } from 'core/domain/MealFit';
import { isOversized, servingCap } from 'core/domain/Serving';
import { MEAL_SLOTS } from 'core/entities/Plan';
import { REWRITE_ATTEMPT_BOUND, stepsVersionAttempts } from 'core/domain/Method';

import type { Catalogue, MealSlot } from 'core/entities/Plan';
import type { RecipeCheck } from 'core/entities/AdminQuery';

/**
 * What a stored recipe is judged on (`0071`, Catálogo › Calidad): its served
 * ingredients — not the optional ones, which the app leaves out of every dish
 * it serves — its servings, and the meals it names.
 */
export type QualityRecipe = {
  readonly items: readonly { readonly grams: number; readonly slug: string }[];
  /** The `meal_slots` column as it holds them; anything that is not a meal is ignored. */
  readonly mealSlots: readonly string[];
  readonly servings: number;
  /** `recipes.steps_version`, `2.8.0+2` when the sweep refused it twice. */
  readonly stepsVersion: string | null;
};

/** Each question the console asks of one recipe. All of them are about the dish; none about a person. */
export type QualityFlags = {
  /** One serving past `OVERSIZED_FACTOR` times the cap: the pot declared as one plate (`0070`). Should be zero. */
  readonly overBound: boolean;
  /** Past the cap of its meals but within the bound: a dish to look at, not one that should not exist. */
  readonly overCap: boolean;
  /** The sweep has been refused `REWRITE_ATTEMPT_BOUND` times against the current steps version. Should be zero. */
  readonly refusalLimit: boolean;
  /** The catalogue cannot compute its macros: an unknown ingredient, or no servings. Should be zero. */
  readonly uncosted: boolean;
  /** No meal fits every ingredient of the dish, so it is never served to anybody. Should be zero. */
  readonly unserved: boolean;
};

const MEALS: ReadonlySet<string> = new Set(MEAL_SLOTS);

/** The meals a stored recipe names that are meals. */
function slotsOf(mealSlots: readonly string[]): MealSlot[] {
  return mealSlots.filter((slot): slot is MealSlot => MEALS.has(slot));
}

/**
 * Judges one recipe with the app's own helpers and no formula of its own:
 * `composePerServing` for the figure, `servingCap` and `isOversized` for the
 * cap and the bound, `fitSlots` for the meals and `stepsVersionAttempts` for
 * the sweep's refusals.
 *
 * `unserved` asks `fitSlots` for the widest person there is — one who is vegan,
 * to whom every plant protein belongs at every meal (`0062` § 4) — so a dish
 * is flagged only when *nobody* could be served it, not because an omnivore
 * cannot. A recipe with no meal at all is unserved too.
 */
export function qualityFlags(recipe: QualityRecipe, catalogue: Catalogue, currentStepsVersion: string): QualityFlags {
  const slots = slotsOf(recipe.mealSlots);
  const dish = { ingredients: [...recipe.items], servings: recipe.servings, slots };
  const composed = recipe.servings > 0 ? composePerServing(dish, catalogue) : undefined;
  // No meals means no cap to be past: `servingCap([])` is minus infinity.
  const kcal = composed?.ok === true && slots.length > 0 ? composed.macros.kcal : undefined;
  const overBound = kcal !== undefined && isOversized(dish, catalogue);

  return {
    overBound,
    overCap: kcal !== undefined && !overBound && kcal > servingCap(slots),
    refusalLimit: stepsVersionAttempts(recipe.stepsVersion, currentStepsVersion) >= REWRITE_ATTEMPT_BOUND,
    uncosted: composed?.ok !== true,
    unserved: fitSlots(dish, catalogue, ['vegan']).length === 0
  };
}

/** The flag each `RecipeCheck` reads. A record, so a new check cannot be left without one. */
const CHECK_FLAG: Readonly<Record<RecipeCheck, keyof QualityFlags>> = {
  over_bound: 'overBound',
  over_cap: 'overCap',
  refusal_limit: 'refusalLimit',
  uncosted: 'uncosted',
  unserved: 'unserved'
};

/** Whether the recipe fails this check. */
export function failsCheck(flags: QualityFlags, check: RecipeCheck): boolean {
  return flags[CHECK_FLAG[check]];
}
