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
