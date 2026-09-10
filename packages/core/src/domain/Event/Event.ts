import { KCAL_PER_G } from 'core/entities/Nutrition';
import { PLAN_DAYS } from 'core/domain/Scheduler';
import { addDays } from 'core/domain/Vacation';

import type { AddEvent, MacroDirection } from 'core/entities/Event';
import type { NutritionTargets } from 'core/entities/Nutrition';

/**
 * What a loaded day eats, and which days are loaded (`0043`).
 *
 * The person chooses the shape — how many days, which macros, which way. The
 * size is chosen here, once, and is deliberately small. "Up" is a fifth more of
 * that macro's grams and "down" a fifth less; a moderate carbohydrate load, not
 * an athlete's. The number is one constant so it can be argued about in one
 * place, and it is not on any screen because the screen is where it would be
 * typed wrong. Somebody who needs more than this needs a person, not a field.
 *
 * Pure. Every function takes and returns `YYYY-MM-DD` strings and plain target
 * objects, so the whole rule is testable without a database or a calendar.
 */
export const LOAD_STEP = 0.2;

function scaled(grams: number, direction: MacroDirection): number {
  if (direction === 'up') {
    return Math.round(grams * (1 + LOAD_STEP));
  }

  if (direction === 'down') {
    return Math.round(grams * (1 - LOAD_STEP));
  }

  return grams;
}

/**
 * The base targets, moved the way the event asks.
 *
 * Energy is recomputed from the grams rather than scaled alongside them, so the
 * result always sums — `targetViolations` checks exactly that, and a loaded day
 * whose kcal disagreed with its own macros would be refused by it. Fibre
 * follows nothing: it is a function of energy in the base derivation and a load
 * is not a reason to change it.
 */
export function loadedTargets(base: NutritionTargets, event: Pick<AddEvent, 'carbs' | 'fat' | 'protein'>): NutritionTargets {
  const carbsG = scaled(base.carbsG, event.carbs);
  const proteinG = scaled(base.proteinG, event.protein);
  const fatG = scaled(base.fatG, event.fat);

  return {
    carbsG,
    fatG,
    fiberG: base.fiberG,
    kcal: Math.round(carbsG * KCAL_PER_G.carbs + proteinG * KCAL_PER_G.protein + fatG * KCAL_PER_G.fat),
    proteinG
  };
}

/** The dates that eat for the event: the `daysBefore` days ending the day before it. The day itself is not loaded. */
export function loadedDates(event: Pick<AddEvent, 'daysBefore' | 'on'>): readonly string[] {
  return Array.from({ length: event.daysBefore }, (_none, offset) => addDays(event.on, -(event.daysBefore - offset)));
}

/** The first loaded date, for overlap checks and for saying when the load starts. */
export function loadStartsOn(event: Pick<AddEvent, 'daysBefore' | 'on'>): string {
  return addDays(event.on, -event.daysBefore);
}

/** Two events overlap when a day would have to eat for both. */
export function overlaps(one: Pick<AddEvent, 'daysBefore' | 'on'>, other: Pick<AddEvent, 'daysBefore' | 'on'>): boolean {
  return loadStartsOn(one) <= other.on && loadStartsOn(other) <= one.on;
}

/**
 * The event a date eats for, or null.
 *
 * Overlaps are refused at creation, so at most one matches; the search is by
 * date rather than by index because the plan's days are dates and an event is a
 * date, and turning either into the other is where timezones get in.
 */
export function eventOn<T extends Pick<AddEvent, 'daysBefore' | 'on'>>(date: string, events: readonly T[]): T | null {
  return events.find(event => loadedDates(event).includes(date)) ?? null;
}

/** A stretch of dated days, both ends included — the fortnight an event is counted against. */
export type PlanWindow = { readonly from: string; readonly to: string };

/**
 * The fortnight an event belongs to (`0044`).
 *
 * The active plan's own days when there is one, because that is the fortnight
 * the person is living and the one a load would change. With no plan it is
 * today and the thirteen days after — the fortnight the next generation will
 * lay out — so that somebody declaring three races before their first plan
 * exists is held to the same number as everybody else, rather than to none.
 */
export function planWindow(active: { readonly endDate: string; readonly startDate: string } | null | undefined, today: string): PlanWindow {
  if (!active || active.endDate < today) {
    return { from: today, to: addDays(today, PLAN_DAYS - 1) };
  }

  return { from: active.startDate, to: active.endDate };
}

/**
 * The events whose load lands inside the window — the ones this fortnight is
 * actually eating for.
 *
 * By loaded days rather than by the event's own date, because the load is what
 * touches the plan: a race on the Sunday after a plan ends still moves the
 * Friday and Saturday inside it, and an event on the plan's first day moves
 * only days that belong to the fortnight before.
 */
export function eventsInWindow<T extends Pick<AddEvent, 'daysBefore' | 'on'>>(events: readonly T[], window: PlanWindow): readonly T[] {
  return events.filter(event => loadedDates(event).some(date => window.from <= date && date <= window.to));
}

/**
 * The fortnight a new event is counted against: `base` when its load touches
 * it, otherwise the fortnights that follow, tiled forward from `base`, the
 * first one the load touches.
 *
 * Without this, an event declared for the week after next would be counted
 * against nothing — the fortnight it belongs to has no plan yet — and the cap
 * would be a cap only on people who declare things late. Fortnights follow one
 * another, so the fortnight after this one is a real thing to count against.
 */
export function windowFor(event: Pick<AddEvent, 'daysBefore' | 'on'>, base: PlanWindow): PlanWindow {
  const startsOn = loadStartsOn(event);
  let window = base;

  while (window.to < startsOn) {
    window = { from: addDays(window.to, 1), to: addDays(window.to, PLAN_DAYS) };
  }

  return window;
}

export type EventProblem = 'in-the-past' | 'overlaps';

/**
 * What is wrong with a new event, or null.
 *
 * An event whose load would already have started is refused, not because the
 * date is odd but because the days it would change have been eaten: the past
 * is read-only (`0021`). An event on a day inside another's load is refused
 * because a day cannot eat for two things at once, and picking one silently
 * would be deciding which of two competitions matters more.
 */
export function problemWith(event: AddEvent, today: string, existing: readonly Pick<AddEvent, 'daysBefore' | 'on'>[]): EventProblem | null {
  if (loadStartsOn(event) < today) {
    return 'in-the-past';
  }

  if (existing.some(other => overlaps(event, other))) {
    return 'overlaps';
  }

  return null;
}
