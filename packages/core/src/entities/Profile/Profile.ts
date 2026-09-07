import { z } from 'zod';

export const SEXES = ['female', 'male', 'other', 'prefer_not_to_say'] as const;
export const GOAL_TYPES = ['weight_loss', 'maintenance', 'muscle_gain', 'performance', 'healthy_eating', 'custom'] as const;
export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'high', 'athlete'] as const;
export const COOKING_FREQUENCIES = ['rarely', 'sometimes', 'often', 'daily'] as const;
export const BUDGET_TIERS = ['low', 'medium', 'high'] as const;
export const DIETARY_PATTERNS = [
  'omnivore',
  'vegetarian',
  'vegan',
  'pescatarian',
  'flexitarian',
  'gluten_free',
  'lactose_free',
  'halal',
  'kosher'
] as const;

/**
 * Bounds are safety limits, not form politeness. A height of 3 cm or a target of
 * 20 kg is either a typo or a request the product must refuse; either way it
 * must never reach the plan generator, which would happily build a starvation
 * diet around it.
 */
const HEIGHT_CM = { max: 250, min: 100 } as const;
const WEIGHT_KG = { max: 400, min: 30 } as const;
const AGE_YEARS = { max: 100, min: 16 } as const;

export const profileSchema = z.object({
  id: z.uuid(),
  birthDate: z.string().nullable(),
  country: z.string().max(2).nullable(),
  createdAt: z.date(),
  displayName: z.string().min(1).max(80).nullable(),
  heightCm: z.number().int().min(HEIGHT_CM.min).max(HEIGHT_CM.max).nullable(),
  locale: z.string(),
  sex: z.enum(SEXES).nullable(),
  timezone: z.string(),
  updatedAt: z.date(),
  userId: z.string().min(1)
});

export type Profile = z.infer<typeof profileSchema>;

/** What a user may send. `userId` is never accepted from input — the session decides it. */
export const updateProfileSchema = z.object({
  birthDate: z.iso.date().nullish(),
  country: z.string().length(2).nullish(),
  displayName: z.string().min(1).max(80).nullish(),
  heightCm: z.number().int().min(HEIGHT_CM.min).max(HEIGHT_CM.max).nullish(),
  locale: z.string().min(2).max(10).optional(),
  sex: z.enum(SEXES).nullish(),
  timezone: z.string().min(1).max(64).optional()
});

export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export const goalSchema = z.object({
  id: z.uuid(),
  createdAt: z.date(),
  customGoal: z.string().nullable(),
  paceKgPerWeek: z.number().nullable(),
  startingWeightKg: z.number().nullable(),
  targetWeightKg: z.number().nullable(),
  type: z.enum(GOAL_TYPES),
  updatedAt: z.date(),
  userId: z.string().min(1)
});

export type Goal = z.infer<typeof goalSchema>;

export const updateGoalSchema = z
  .object({
    customGoal: z.string().max(280).nullish(),
    /** Negative loses weight, positive gains. Capped: faster than this is not a nutrition plan. */
    paceKgPerWeek: z.number().min(-1).max(1).nullish(),
    startingWeightKg: z.number().min(WEIGHT_KG.min).max(WEIGHT_KG.max).nullish(),
    targetWeightKg: z.number().min(WEIGHT_KG.min).max(WEIGHT_KG.max).nullish(),
    type: z.enum(GOAL_TYPES)
  })
  .refine(value => value.type !== 'custom' || Boolean(value.customGoal), {
    message: 'Describe tu objetivo personalizado',
    path: ['customGoal']
  });

export type UpdateGoal = z.infer<typeof updateGoalSchema>;

export const preferencesSchema = z.object({
  id: z.uuid(),
  activityLevel: z.enum(ACTIVITY_LEVELS).nullable(),
  breakfastStyle: z.string().nullable(),
  budget: z.enum(BUDGET_TIERS).nullable(),
  cookingFrequency: z.enum(COOKING_FREQUENCIES).nullable(),
  cookingTimeMinutes: z.number().int().nullable(),
  createdAt: z.date(),
  includesSnacks: z.boolean(),
  mealsPerDay: z.number().int().nullable(),
  portionPreference: z.string().nullable(),
  sleepEnd: z.string().nullable(),
  sleepStart: z.string().nullable(),
  trainingDaysPerWeek: z.number().int().nullable(),
  trainingTime: z.string().nullable(),
  updatedAt: z.date(),
  userId: z.string().min(1),
  workScheduleNotes: z.string().nullable()
});

export type Preferences = z.infer<typeof preferencesSchema>;

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export const updatePreferencesSchema = z.object({
  activityLevel: z.enum(ACTIVITY_LEVELS).nullish(),
  breakfastStyle: z.string().max(120).nullish(),
  budget: z.enum(BUDGET_TIERS).nullish(),
  cookingFrequency: z.enum(COOKING_FREQUENCIES).nullish(),
  cookingTimeMinutes: z.number().int().min(5).max(240).nullish(),
  includesSnacks: z.boolean().optional(),
  mealsPerDay: z.number().int().min(2).max(6).nullish(),
  portionPreference: z.string().max(120).nullish(),
  sleepEnd: z.string().regex(TIME_OF_DAY).nullish(),
  sleepStart: z.string().regex(TIME_OF_DAY).nullish(),
  trainingDaysPerWeek: z.number().int().min(0).max(7).nullish(),
  trainingTime: z.string().regex(TIME_OF_DAY).nullish(),
  workScheduleNotes: z.string().max(500).nullish()
});

export type UpdatePreferences = z.infer<typeof updatePreferencesSchema>;

export { AGE_YEARS, HEIGHT_CM, WEIGHT_KG };
