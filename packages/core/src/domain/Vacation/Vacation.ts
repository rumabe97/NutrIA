import { MAX_VACATION_DAYS } from 'core/entities/Vacation';

import type { PlanVacation } from 'core/entities/Vacation';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Pausing a plan is date arithmetic and nothing else (`0032`).
 *
 * Every function here takes and returns `YYYY-MM-DD` strings, which is what the
 * `date` columns hold. No `Date` crosses the boundary on purpose: a plan day is
 * a day in the person's life, not an instant, and the moment one becomes a
 * timestamp somebody's Tuesday becomes a Monday in another timezone.
 */

/** Both ends included — see `vacationSchema`. */
export function daysAway(trip: PlanVacation): number {
  return Math.round((Date.parse(`${trip.endsOn}T00:00:00Z`) - Date.parse(`${trip.startsOn}T00:00:00Z`)) / MS_PER_DAY) + 1;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whether a day falls inside the trip, both ends included. */
export function isAway(trip: PlanVacation, date: string): boolean {
  return date >= trip.startsOn && date <= trip.endsOn;
}

export function overlaps(one: PlanVacation, other: PlanVacation): boolean {
  return one.startsOn <= other.endsOn && other.startsOn <= one.endsOn;
}

export type VacationProblem = 'ends-before-it-starts' | 'overlaps' | 'starts-in-the-past' | 'too-long';

/**
 * What is wrong with a trip, or null.
 *
 * A trip may not start in the past because the shift only ever moves days that
 * have not happened yet: the past is read-only (`0021`), and a plan day somebody
 * already ate cannot be moved to make room for a holiday they already took.
 */
export function problemWith(trip: PlanVacation, today: string, existing: readonly PlanVacation[]): VacationProblem | null {
  if (trip.endsOn < trip.startsOn) {
    return 'ends-before-it-starts';
  }

  if (trip.startsOn < today) {
    return 'starts-in-the-past';
  }

  if (daysAway(trip) > MAX_VACATION_DAYS) {
    return 'too-long';
  }

  if (existing.some(other => overlaps(trip, other))) {
    return 'overlaps';
  }

  return null;
}

/**
 * How far back a trip that is cancelled should pull the plan.
 *
 * Only the days not yet spent. Cancelling from the beach on the fourth morning
 * of a week away gives back four days, not seven — the three already gone were
 * days the plan genuinely did not happen, and pulling them back would put plan
 * days in the past.
 */
export function daysToGiveBack(trip: PlanVacation, today: string): number {
  if (trip.endsOn < today) {
    return 0;
  }

  return daysAway({ endsOn: trip.endsOn, startsOn: trip.startsOn > today ? trip.startsOn : today });
}
