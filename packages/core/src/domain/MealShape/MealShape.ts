import { MEAL_SLOTS } from 'core/entities/Plan';

import type { MealShape, MealSize } from 'core/entities/Profile';
import type { MealSlot } from 'core/entities/Plan';
import type { NutritionTargets } from 'core/entities/Nutrition';

/**
 * Share of the day's energy each slot carries at its normal size, before the
 * person's own answer and before normalising over whichever slots they eat.
 *
 * Snacks are deliberately small: they exist to bridge gaps, and a 600 kcal
 * "snack" is a meal wearing a disguise.
 */
const SLOT_WEIGHT: Record<MealSlot, number> = { afternoon_snack: 0.09, breakfast: 0.25, dinner: 0.3, lunch: 0.33, morning_snack: 0.08, supper: 0.1 };

/**
 * What each answer does to a slot's share.
 *
 * Ratios, not amounts: the budget is normalised over whichever slots survive, so
 * a light breakfast does not shrink the day — it hands its share to the meals
 * that are left, which is exactly what somebody means by "I eat little in the
 * morning".
 *
 * `off` is zero and the slot disappears entirely. Half and a half again are far
 * enough apart to be felt and close enough that no single meal becomes absurd.
 */
const SIZE_FACTOR: Record<MealSize, number> = { large: 1.5, light: 0.5, normal: 1, off: 0 };

/**
 * What a profile that has not answered gets: the ordinary three, plus something
 * in the afternoon. Chosen to match what most people already had.
 */
export const DEFAULT_MEAL_SHAPE: MealShape = {
  afternoon_snack: 'normal',
  breakfast: 'normal',
  dinner: 'normal',
  lunch: 'normal',
  morning_snack: 'off',
  supper: 'off'
};

/** The slots this person actually eats, in the order a day is lived. */
export function slotsIn(shape: MealShape): readonly MealSlot[] {
  return MEAL_SLOTS.filter(slot => shape[slot] !== 'off');
}

/**
 * Each eaten slot's share of the day.
 *
 * Unnormalised on purpose: the scheduler divides by the total, so this can stay
 * a statement about one slot rather than about the set — and adding a slot later
 * cannot silently change what the others mean.
 */
export function weightsFor(shape: MealShape): ReadonlyMap<MealSlot, number> {
  return new Map(slotsIn(shape).map(slot => [slot, SLOT_WEIGHT[slot] * SIZE_FACTOR[shape[slot]]]));
}

/**
 * Each eaten slot's fraction of the day — the weights normalised over the
 * slots that are eaten. The one division the scheduler's budgets and the note
 * before generating both read, so the kcal a screen quotes is the kcal a plate
 * is sized to.
 */
export function slotShares(weights: ReadonlyMap<MealSlot, number>): ReadonlyMap<MealSlot, number> {
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0) || 1;

  return new Map([...weights].map(([slot, weight]) => [slot, weight / total]));
}

/** Each eaten slot's energy, in kcal, for this shape and these targets. Unrounded. */
export function mealShareKcal(shape: MealShape, targets: Pick<NutritionTargets, 'kcal'>): ReadonlyMap<MealSlot, number> {
  return new Map([...slotShares(weightsFor(shape))].map(([slot, share]) => [slot, targets.kcal * share]));
}

/**
 * A main meal past this many kcal is one a person is told about before a plan
 * is generated (project 016, LOG 2026-10-02): what it carries, and that a meal
 * more would make each one smaller. Told, never refused — a heavy lunch is a
 * choice the product supports (`0036`).
 */
export const LARGE_MEAL_KCAL = 850;

/** The slots that are a meal rather than something between meals — breakfast included, unlike `Variety`'s `MAIN_SLOTS`. */
const FULL_MEALS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner'];

export type MainMealSize = {
  /** Whether the largest main meal is past `LARGE_MEAL_KCAL`. */
  readonly largeMeals: boolean;
  /** The largest of breakfast, lunch and dinner, in whole kcal; 0 when none is eaten. */
  readonly largestMainKcal: number;
};

/** How big this person's largest main meal is, and whether that is worth saying. */
export function mainMealSize(shape: MealShape, targets: Pick<NutritionTargets, 'kcal'>): MainMealSize {
  const shares = mealShareKcal(shape, targets);
  const largestMainKcal = Math.round(Math.max(0, ...FULL_MEALS.map(slot => shares.get(slot) ?? 0)));

  return { largeMeals: largestMainKcal > LARGE_MEAL_KCAL, largestMainKcal };
}

/**
 * The shape somebody's old answer implied.
 *
 * Kept after the migration backfilled every row, because the same derivation is
 * what a fixture and a test need to say "an ordinary day" without writing six
 * fields out.
 */
export function shapeFor(mealsPerDay: number, includesSnacks: boolean): MealShape {
  const meals = Math.max(1, Math.min(mealsPerDay, 6));

  return {
    afternoon_snack: includesSnacks && meals >= 4 ? 'normal' : 'off',
    breakfast: 'normal',
    dinner: meals >= 3 ? 'normal' : 'off',
    lunch: meals >= 2 ? 'normal' : 'off',
    morning_snack: includesSnacks && meals >= 5 ? 'normal' : 'off',
    supper: (!includesSnacks && meals >= 4) || (includesSnacks && meals >= 6) ? 'normal' : 'off'
  };
}
