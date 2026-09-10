import { date, integer, jsonb, numeric, smallint, text, time, timestamp } from 'drizzle-orm/pg-core';

import { activityLevel, budgetTier, cookingFrequency, dietaryPattern, goalType, sentiment, sex } from './_enums';

/**
 * The four sizes a meal can be. Written out here rather than imported: this
 * package sits *below* `packages/core`, so the authority on the shape —
 * `mealShapeSchema` — cannot be reached from a schema file. Four strings is a
 * cheap duplication; the Zod schema is what validates anything written.
 */
type MealSize = 'large' | 'light' | 'normal' | 'off';

type MealShape = Record<'afternoon_snack' | 'breakfast' | 'dinner' | 'lunch' | 'morning_snack' | 'supper', MealSize>;
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
  timezone: text().notNull().default('Europe/Madrid'),
  /**
   * When this person was last shown the tour (`0038`).
   *
   * On the profile rather than in the browser: a tour that reappears on a second
   * device is worse than one nobody sees, and "have I already been told this" is
   * a fact about a person, not about a laptop. Null means never — which is every
   * account that existed before the tour did, on purpose.
   */
  tourSeenAt: timestamp({ withTimezone: true })
});

export const goals = userOwned('goals', {
  archivedAt: date(),
  customGoal: text(),
  /** kg per week, as a magnitude. The goal supplies the direction — see `domain/Nutrition`. */
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
  /**
   * Which meals this person eats and how big each one is (`0036`).
   *
   * Replaced `mealsPerDay` + `includesSnacks`, which could say how many meals
   * somebody ate but never *which*: asking for two always dropped dinner, so a
   * person who skips breakfast had no way to say so. Six answers instead of a
   * count, each `off`, `light`, `normal` or `large`.
   */
  mealShape: jsonb().$type<MealShape>().notNull().default({
    afternoon_snack: 'normal',
    breakfast: 'normal',
    dinner: 'normal',
    lunch: 'normal',
    morning_snack: 'off',
    supper: 'off'
  }),
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

/**
 * A user's correction to their computed daily targets.
 *
 * Every column is nullable and a null means "use the computed value" — the
 * computed figure is deliberately **not** copied in. Copying it would freeze a
 * snapshot of today's equations into the row, so a later correction to the
 * calculator would silently stop reaching anyone who had ever opened this form.
 *
 * Only kcal and the three macros: fibre follows from the calorie figure and
 * nobody has an opinion about it worth a column.
 */
export const targetOverrides = userOwnedSingleton('target_overrides', {
  carbsG: smallint(),
  fatG: smallint(),
  kcal: integer(),
  /** When the user last changed it, so the profile can say whose number this is. */
  overriddenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  proteinG: smallint()
});

/**
 * Health data, collected as health data.
 *
 * Three tables rather than one because they are used differently, and the
 * differences are the whole point: a condition may produce a **curated**
 * dietary exclusion, a medication produces none ever, and a supplement
 * contributes nutrition. Merging them into a "health notes" table would make
 * that boundary a convention instead of a schema.
 *
 * All three cascade from `user.id`, so deleting an account deletes them. None
 * is required to finish onboarding: data given under a condition of using the
 * product is not consent.
 */
export const healthConditions = userOwned('health_conditions', {
  /**
   * A key from the curated list in `core/entities/Health`, or null when the
   * user typed something we do not recognise. Null means **no dietary
   * inference at all** — only the supervision recommendation.
   */
  conditionKey: text(),
  /** What the user chose or typed, kept verbatim for showing back. */
  label: text().notNull()
});

/**
 * Recorded so the user can see what they told us and so the supervision notice
 * can be shown. **Never** mapped to a dietary rule and **never** placed in a
 * prompt — the boundary in `docs/decisions/0004-deterministic-safety-layer.md`.
 *
 * No dose column. Dosing is permanently out of scope, and a field nothing may
 * read is a field that should not exist: it is health data whose only possible
 * use is one we have ruled out.
 */
export const medications = userOwned('medications', {
  name: text().notNull()
});

/**
 * A supplement and, optionally, the protein it supplies.
 *
 * Protein only. The other macros a supplement might carry are not what anyone
 * records a supplement for, and a column per macro would invite treating this
 * table as a second, unvalidated food catalogue.
 */
export const supplements = userOwned('supplements', {
  name: text().notNull(),
  proteinGPerServing: numeric({ precision: 5, scale: 1 }),
  servingsPerDay: smallint().notNull().default(1)
});

/**
 * Consent to hold the three tables above.
 *
 * `version` is what makes it re-askable: change the notice and the stored
 * version no longer matches, so consent is requested again rather than assumed
 * to cover wording the user never saw. Withdrawal is the deletion of this row
 * and the health rows together, in one transaction.
 */
export const healthDataConsents = userOwnedSingleton('health_data_consents', {
  grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  version: text().notNull()
});
