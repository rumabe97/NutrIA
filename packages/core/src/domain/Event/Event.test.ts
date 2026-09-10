import { describe, expect, it } from 'vitest';

import { eventOn, LOAD_STEP, loadedDates, loadedTargets, overlaps, problemWith } from 'core/domain/Event';
import { targetViolations } from 'core/domain/Nutrition';

import type { AddEvent } from 'core/entities/Event';
import type { NutritionTargets } from 'core/entities/Nutrition';

const BASE: NutritionTargets = { carbsG: 250, fatG: 70, fiberG: 25, kcal: 2230, proteinG: 130 };

function race(overrides: Partial<AddEvent> = {}): AddEvent {
  return { carbs: 'up', daysBefore: 2, fat: 'down', name: 'Media maratón', on: '2026-09-13', protein: 'same', ...overrides };
}

describe('loadedTargets', () => {
  it('moves each macro the way it was asked, by the one step', () => {
    const loaded = loadedTargets(BASE, race());

    expect(loaded.carbsG).toBe(Math.round(250 * (1 + LOAD_STEP)));
    expect(loaded.fatG).toBe(Math.round(70 * (1 - LOAD_STEP)));
    expect(loaded.proteinG).toBe(130);
    expect(loaded.fiberG).toBe(25);
  });

  /*
   * Energy is recomputed from the grams. If it were scaled alongside them the
   * macros would stop summing to it, and `targetViolations` would refuse the
   * day for our own arithmetic.
   */
  it('recomputes energy from the grams so the set still sums', () => {
    const loaded = loadedTargets(BASE, race());

    expect(loaded.kcal).toBe(loaded.carbsG * 4 + loaded.proteinG * 4 + loaded.fatG * 9);
  });

  it('leaves everything alone when nothing moves', () => {
    expect(loadedTargets(BASE, { carbs: 'same', fat: 'same', protein: 'same' })).toEqual({ ...BASE, kcal: 250 * 4 + 130 * 4 + 70 * 9 });
  });

  /*
   * The step is small on purpose. A moderate load must never, on its own, push
   * a set of sane targets outside the bounds a person's own profile sets.
   */
  it('stays inside ordinary bounds on its own', () => {
    const bounds = { ceilingKcal: 3200, floorKcal: 1400, maintenanceKcal: 2300, proteinCeilingG: 200, proteinFloorG: 80 };

    expect(targetViolations(loadedTargets(BASE, race()), bounds)).toEqual([]);
    expect(targetViolations(loadedTargets(BASE, race({ carbs: 'up', fat: 'up', protein: 'up' })), bounds)).toEqual([]);
  });
});

describe('loadedDates', () => {
  it('is the days before the event, not the event itself', () => {
    expect(loadedDates(race({ daysBefore: 2, on: '2026-09-13' }))).toEqual(['2026-09-11', '2026-09-12']);
    expect(loadedDates(race({ daysBefore: 1, on: '2026-09-13' }))).toEqual(['2026-09-12']);
  });

  it('crosses a month boundary as dates, not as day numbers', () => {
    expect(loadedDates(race({ daysBefore: 3, on: '2026-10-01' }))).toEqual(['2026-09-28', '2026-09-29', '2026-09-30']);
  });
});

describe('eventOn', () => {
  const events = [race({ on: '2026-09-13' }), race({ daysBefore: 1, name: 'Partido', on: '2026-09-20' })];

  it('finds the event a date eats for', () => {
    expect(eventOn('2026-09-12', events)?.name).toBe('Media maratón');
    expect(eventOn('2026-09-19', events)?.name).toBe('Partido');
  });

  it('answers null for the event day itself and for an ordinary day', () => {
    expect(eventOn('2026-09-13', events)).toBeNull();
    expect(eventOn('2026-09-15', events)).toBeNull();
  });
});

describe('overlaps', () => {
  it('sees a day that would eat for two things', () => {
    expect(overlaps(race({ daysBefore: 2, on: '2026-09-13' }), race({ daysBefore: 2, on: '2026-09-14' }))).toBe(true);
  });

  it('lets one load end the day before the next begins', () => {
    expect(overlaps(race({ daysBefore: 2, on: '2026-09-13' }), race({ daysBefore: 1, on: '2026-09-15' }))).toBe(false);
  });
});

describe('problemWith', () => {
  it('refuses a load that would already have started', () => {
    expect(problemWith(race({ daysBefore: 2, on: '2026-09-13' }), '2026-09-12', [])).toBe('in-the-past');
  });

  it('allows a load that starts today', () => {
    expect(problemWith(race({ daysBefore: 2, on: '2026-09-13' }), '2026-09-11', [])).toBeNull();
  });

  it('refuses a day that would eat for two events', () => {
    expect(problemWith(race({ on: '2026-09-14' }), '2026-09-01', [race({ on: '2026-09-13' })])).toBe('overlaps');
  });
});
