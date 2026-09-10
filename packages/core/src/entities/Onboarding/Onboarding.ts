import { z } from 'zod';

import { setAllergiesSchema } from 'core/entities/Safety';
import { updateGoalSchema, updatePreferencesSchema, updateProfileSchema } from 'core/entities/Profile';

/**
 * The ten onboarding steps, in order. The array is the source of truth for both
 * the client's progress bar and the server's completeness check — one list, so
 * they cannot disagree about what "done" means.
 */
export const ONBOARDING_STEPS = [
  'about-you',
  'goal',
  'body-activity',
  'how-you-eat',
  'food-preferences',
  'allergies',
  'lifestyle',
  'cooking',
  'review',
  'create-plan'
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Steps that must be completed before a plan may be generated. */
export const REQUIRED_ONBOARDING_STEPS: readonly OnboardingStep[] = ONBOARDING_STEPS.slice(0, 8);

export const onboardingStateSchema = z.object({
  id: z.uuid(),
  completedAt: z.string().nullable(),
  completedSteps: z.array(z.enum(ONBOARDING_STEPS)),
  currentStep: z.number().int().min(1).max(ONBOARDING_STEPS.length),
  userId: z.string().min(1)
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

const foodPreferenceInput = z.object({
  ingredientId: z.uuid().nullish(),
  label: z.string().min(1).max(80),
  sentiment: z.enum(['liked', 'disliked'])
});

/**
 * One schema per step, discriminated by `step`. A step submits only its own
 * fields, which is what makes the flow resumable: each PATCH is independently
 * valid, and no step can smuggle another's data past validation.
 */
export const onboardingStepSchema = z.discriminatedUnion('step', [
  z.object({ data: updateProfileSchema, step: z.literal('about-you') }),
  z.object({ data: updateGoalSchema, step: z.literal('goal') }),
  z.object({
    data: z.object({
      activityLevel: updatePreferencesSchema.shape.activityLevel,
      currentWeightKg: z.number().min(30).max(400),
      heightCm: updateProfileSchema.shape.heightCm
    }),
    step: z.literal('body-activity')
  }),
  z.object({
    data: updatePreferencesSchema.pick({ breakfastStyle: true, mealShape: true, portionPreference: true }),
    step: z.literal('how-you-eat')
  }),
  z.object({
    data: z.object({ cuisines: z.array(z.string().max(60)).max(10), preferences: z.array(foodPreferenceInput).max(60) }),
    step: z.literal('food-preferences')
  }),
  z.object({ data: setAllergiesSchema.extend({ dietaryPatterns: z.array(z.string()).max(9) }), step: z.literal('allergies') }),
  z.object({
    data: updatePreferencesSchema.pick({ sleepEnd: true, sleepStart: true, trainingDaysPerWeek: true, trainingTime: true, workScheduleNotes: true }),
    step: z.literal('lifestyle')
  }),
  z.object({ data: updatePreferencesSchema.pick({ budget: true, cookingFrequency: true, cookingTimeMinutes: true }), step: z.literal('cooking') })
]);

export type OnboardingStepInput = z.infer<typeof onboardingStepSchema>;
