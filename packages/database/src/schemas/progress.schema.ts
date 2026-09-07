import { date, jsonb, numeric, smallint, text, uuid } from 'drizzle-orm/pg-core';

import { mealPlans } from './plan.schema';
import { userOwned } from './_utils';

export type BodyMeasurements = {
  readonly armCm?: number;
  readonly chestCm?: number;
  readonly hipCm?: number;
  readonly thighCm?: number;
  readonly waistCm?: number;
};

/** One row per logged day. Trends are computed in code, never stored pre-chewed. */
export const progressEntries = userOwned('progress_entries', {
  /** 1..5 */
  energy: smallint(),
  hunger: smallint(),
  loggedOn: date().notNull(),
  measurements: jsonb().$type<BodyMeasurements>(),
  notes: text(),
  weightKg: numeric({ precision: 5, scale: 2 })
});

/**
 * The fortnightly hinge: a completed check-in is what the next plan reads to
 * decide what changes. Kept as structured columns (not prose) so plan
 * generation consumes signals rather than re-parsing free text.
 */
export const checkIns = userOwned('check_ins', {
  activityChanges: text(),
  comments: text(),
  completedAt: date(),
  /** 1..5 — how hard the plan was to follow. */
  difficultyRating: smallint(),
  dueOn: date().notNull(),
  feltRating: smallint(),
  hungerRating: smallint(),
  newPreferences: text(),
  newRestrictions: text(),
  planId: uuid()
    .notNull()
    .references(() => mealPlans.id, { onDelete: 'cascade' }),
  portionSatisfaction: smallint(),
  satisfactionRating: smallint(),
  scheduleChanges: text(),
  weightKg: numeric({ precision: 5, scale: 2 })
});
