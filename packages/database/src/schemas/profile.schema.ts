import { boolean, date, numeric, smallint, text, time } from 'drizzle-orm/pg-core';

import { activityLevel, budgetTier, cookingFrequency, dietaryPattern, goalType, sentiment, sex } from './_enums';
import { userOwned, userOwnedSingleton } from './_utils';

/**
 * Everything here is nullable on purpose: onboarding writes it one step at a
 * time, so a half-filled profile is a legitimate state. Completeness is a
 * *domain* rule checked by `profileSchema` in `packages/core` before a plan may
 * be generated — not a column constraint that would break step-by-step saves.
 */
export const profiles = userOwnedSingleton('profiles', {
  birthDate: date(),
  country: text(),
  displayName: text(),
  heightCm: smallint(),
  locale: text().notNull().default('es-ES'),
  sex: sex(),
  timezone: text().notNull().default('Europe/Madrid')
});

export const goals = userOwned('goals', {
  archivedAt: date(),
  customGoal: text(),
  /** kg per week; negative for loss, positive for gain. */
  paceKgPerWeek: numeric({ precision: 3, scale: 2 }),
  startingWeightKg: numeric({ precision: 5, scale: 2 }),
  targetWeightKg: numeric({ precision: 5, scale: 2 }),
  type: goalType().notNull()
});

export const userPreferences = userOwnedSingleton('user_preferences', {
  activityLevel: activityLevel(),
  breakfastStyle: text(),
  budget: budgetTier(),
  cookingFrequency: cookingFrequency(),
  /** Minutes the user is willing to spend on one meal. */
  cookingTimeMinutes: smallint(),
  includesSnacks: boolean().notNull().default(true),
  mealsPerDay: smallint(),
  portionPreference: text(),
  sleepEnd: time(),
  sleepStart: time(),
  trainingDaysPerWeek: smallint(),
  trainingTime: time(),
  workScheduleNotes: text()
});

export const userDietaryPatterns = userOwned('user_dietary_patterns', { pattern: dietaryPattern().notNull() });

export const cuisinePreferences = userOwned('cuisine_preferences', { cuisine: text().notNull(), sentiment: sentiment().notNull() });

/**
 * Which onboarding steps are done, so a refresh resumes where the user left off
 * rather than restarting a ten-step flow.
 */
export const onboardingState = userOwnedSingleton('onboarding_state', {
  completedAt: date(),
  completedSteps: text().array().notNull().default([]),
  currentStep: smallint().notNull().default(1)
});
