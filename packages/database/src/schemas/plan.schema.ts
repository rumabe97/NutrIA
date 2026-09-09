import { date, index, integer, jsonb, numeric, pgTable, smallint, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { jobStatus, mealSlot, mealStatus, planStatus } from './_enums';
import { recipes } from './recipe.schema';
import { user } from './auth.schema';
import { timestamps } from './_columns';
import { userOwned } from './_utils';

export type NutritionTargets = {
  readonly carbsG: number;
  readonly fatG: number;
  readonly fiberG: number;
  readonly kcal: number;
  readonly proteinG: number;
};

/**
 * One 14-day cycle. Plans are **append-only history**: a finished plan is never
 * rewritten, the next one is a new row linked by `previousPlanId`. That is what
 * makes "Plan #3, agosto 2026" still openable a year later.
 *
 * `version` is per-user and monotonic. The partial unique index below enforces
 * the real invariant — a user has at most one `active` plan at a time.
 */
export const mealPlans = pgTable(
  'meal_plans',
  {
    id: uuid().primaryKey().defaultRandom(),
    activatedAt: timestamp({ withTimezone: true }),
    completedAt: date(),
    endDate: date().notNull(),
    /** Model, prompt version, token counts, retries — for the admin failure view. */
    generationMetadata: jsonb().$type<Record<string, unknown>>(),
    previousPlanId: uuid(),
    startDate: date().notNull(),
    status: planStatus().notNull().default('draft'),
    /** Computed by code, not the model: daily kcal + macro split for this cycle. */
    strategy: jsonb().$type<NutritionTargets>(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    version: integer().notNull(),
    ...timestamps
  },
  table => [
    index('meal_plans_user_id_idx').on(table.userId),
    unique('meal_plans_user_version_key').on(table.userId, table.version),
    // The real invariant: at most one active plan per user. A partial unique
    // index enforces it in the database, so a double-submit cannot produce two.
    uniqueIndex('meal_plans_one_active_per_user')
      .on(table.userId)
      .where(sql`${table.status} = 'active'`)
  ]
);

export const planDays = pgTable(
  'plan_days',
  {
    id: uuid().primaryKey().defaultRandom(),
    date: date().notNull(),
    /** 1..14 */
    dayIndex: smallint().notNull(),
    notes: text(),
    planId: uuid()
      .notNull()
      .references(() => mealPlans.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  table => [unique('plan_days_unique').on(table.planId, table.dayIndex), index('plan_days_plan_idx').on(table.planId)]
);

/**
 * Macros are snapshotted onto the meal rather than recomputed from the recipe:
 * a historical plan must keep showing the numbers the user actually ate, even
 * after the recipe or an ingredient is later corrected.
 */
export const meals = pgTable(
  'meals',
  {
    id: uuid().primaryKey().defaultRandom(),
    carbsG: numeric({ precision: 7, scale: 2 }).notNull().default('0'),
    fatG: numeric({ precision: 7, scale: 2 }).notNull().default('0'),
    fiberG: numeric({ precision: 7, scale: 2 }).notNull().default('0'),
    kcal: numeric({ precision: 7, scale: 2 }).notNull().default('0'),
    planDayId: uuid()
      .notNull()
      .references(() => planDays.id, { onDelete: 'cascade' }),
    proteinG: numeric({ precision: 7, scale: 2 }).notNull().default('0'),
    recipeId: uuid()
      .notNull()
      .references(() => recipes.id, { onDelete: 'restrict' }),
    /** Set when this meal came from a replacement, so the swap stays auditable. */
    replacedFromMealId: uuid(),
    servings: numeric({ precision: 4, scale: 2 }).notNull().default('1'),
    slot: mealSlot().notNull(),
    sortOrder: smallint().notNull().default(0),
    status: mealStatus().notNull().default('planned'),
    ...timestamps
  },
  table => [
    unique('meals_slot_unique').on(table.planDayId, table.slot),
    index('meals_plan_day_idx').on(table.planDayId),
    // Joined to `recipes` on every plan read — fifty-six rows a plan, and a
    // sequential scan of every meal ever stored without this.
    index('meals_recipe_idx').on(table.recipeId)
  ]
);

/** The adherence signal. One row per user action, so it is auditable and undoable. */
/**
 * A stretch of days somebody is away, both ends included (`0032`).
 *
 * The row is the *record* of the pause, not its mechanism: creating one moves
 * every plan day at or after `starts_on` forward by its length, so during the
 * trip there is simply no plan day on those dates — nothing to eat, nothing to
 * skip, nothing to be reminded about — and the plan resumes on the day after.
 * Storing the shift rather than deriving it keeps every other query honest: a
 * plan day's date is the date it is.
 */
export const vacations = userOwned('vacations', {
  endsOn: date().notNull(),
  startsOn: date().notNull()
});

export const mealCompletions = userOwned('meal_completions', {
  loggedAt: date().notNull(),
  mealId: uuid()
    .notNull()
    .references(() => meals.id, { onDelete: 'cascade' }),
  status: mealStatus().notNull()
});

export const mealFeedback = userOwned('meal_feedback', {
  comment: text(),
  mealId: uuid()
    .notNull()
    .references(() => meals.id, { onDelete: 'cascade' }),
  /** 1..5 */
  rating: smallint(),
  tookTooLong: text(),
  wasFilling: text()
});

export const favoriteRecipes = userOwned('favorite_recipes', {
  recipeId: uuid()
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' })
});

/**
 * One row per meal swap, so the fortnight's allowance can be counted and a
 * person can be told what they had before. The meal row itself is updated in
 * place — `meals_slot_unique` allows one meal per slot per day — so this is the
 * only record that a swap happened.
 */
export const mealSwaps = userOwned('meal_swaps', {
  fromRecipeId: uuid()
    .notNull()
    .references(() => recipes.id, { onDelete: 'restrict' }),
  mealId: uuid()
    .notNull()
    .references(() => meals.id, { onDelete: 'cascade' }),
  planId: uuid()
    .notNull()
    .references(() => mealPlans.id, { onDelete: 'cascade' }),
  /** Where the replacement came from: the library, or a dish the model wrote for this swap. */
  source: text().notNull(),
  toRecipeId: uuid()
    .notNull()
    .references(() => recipes.id, { onDelete: 'restrict' })
});

export const dislikedRecipes = userOwned('disliked_recipes', {
  reason: text(),
  recipeId: uuid()
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' })
});

/**
 * Generation is long-running, so its progress is a row rather than a held HTTP
 * connection: the loading screen polls this, and the admin view reads the same
 * table for failures. `step` is the user-facing stage label.
 */
export const planGenerationJobs = userOwned('plan_generation_jobs', {
  attempts: smallint().notNull().default(0),
  error: text(),
  /** The provider's own (redacted) message. Stable codes go in `error`. */
  errorDetail: text(),
  finishedAt: timestamp({ withTimezone: true }),
  planId: uuid().references(() => mealPlans.id, { onDelete: 'cascade' }),
  startedAt: timestamp({ withTimezone: true }),
  status: jobStatus().notNull().default('queued'),
  step: text()
});
