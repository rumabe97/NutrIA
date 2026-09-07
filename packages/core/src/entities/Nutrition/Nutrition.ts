import { z } from 'zod';

export const nutritionTargetsSchema = z.object({
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative(),
  kcal: z.number().positive(),
  proteinG: z.number().nonnegative()
});

export type NutritionTargets = z.infer<typeof nutritionTargetsSchema>;

export const macrosSchema = z.object({
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative(),
  kcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative()
});

export type Macros = z.infer<typeof macrosSchema>;

/**
 * The floor below which the product will not build a plan, whatever the goal or
 * the model suggests. Widely used clinical minimums for unsupervised dieting.
 * Crossing this is a safety failure, not an aggressive target.
 */
export const MINIMUM_DAILY_KCAL = { female: 1200, male: 1500 } as const;

/**
 * Grams of protein per kg of body weight, above which a day is implausible.
 *
 * A sanity bound, not a recommendation: intakes around 2 g/kg are ordinary for
 * trained people, and 3 g/kg is where a plan stops looking like food.
 *
 * It lives here rather than in `domain/PlanValidation` because two places need
 * it — the gate a finished plan passes, and the gate a *target* passes before a
 * plan is ever built around it. A ceiling enforced in one and not the other is
 * how a target that no plan can satisfy gets written down as a fact.
 */
export const PROTEIN_CEILING_G_PER_KG = 3;

/** The RDA, and the floor an override may not go under. */
export const PROTEIN_FLOOR_G_PER_KG = 0.8;

/**
 * The share of daily energy that may come from protein.
 *
 * Not a preference — an achievability bound. Past roughly this point a day stops
 * being assemblable from food: the pool would need to be almost entirely lean
 * protein, and the scheduler ends up chasing a number no combination of dishes
 * reaches. Capping protein here instead of letting carbohydrate absorb the
 * remainder is what keeps a computed target from being arithmetically impossible.
 */
export const MAX_PROTEIN_KCAL_SHARE = 0.35;

/** Essential fatty acids and fat-soluble vitamins need a floor, not just a target. */
export const MIN_FAT_KCAL_SHARE = 0.15;

/** kcal per gram, Atwater. */
export const KCAL_PER_G = { carbs: 4, fat: 9, protein: 4 } as const;

/**
 * How far the macros may drift from the calorie figure before the set is
 * incoherent.
 *
 * Rounding each macro to whole grams moves the total by a few kcal, so the check
 * cannot be exact. Anything past this is not rounding — it is a set of numbers
 * that does not describe one day of eating.
 */
export const MACRO_SUM_TOLERANCE = 0.03;

/**
 * A user's correction to their computed targets.
 *
 * Every field is optional and nullable, and the two mean different things: absent
 * leaves whatever is stored alone, `null` clears that field back to the computed
 * value. Fibre is not overridable — it follows from the calorie figure and nobody
 * has an opinion about it worth the extra field.
 */
export const updateTargetOverrideSchema = z.object({
  carbsG: z.number().int().min(0).max(1500).nullish(),
  fatG: z.number().int().min(0).max(500).nullish(),
  kcal: z.number().int().min(500).max(8000).nullish(),
  proteinG: z.number().int().min(0).max(600).nullish()
});

export type UpdateTargetOverride = z.infer<typeof updateTargetOverrideSchema>;

export const targetOverrideSchema = z.object({
  carbsG: z.number().nullable(),
  fatG: z.number().nullable(),
  kcal: z.number().nullable(),
  overriddenAt: z.date(),
  proteinG: z.number().nullable()
});

export type TargetOverride = z.infer<typeof targetOverrideSchema>;
