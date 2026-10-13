import { describe, expect, it } from 'vitest';

import { addFixedMealSchema, daysFor, weekdayOf } from 'core/entities/FixedMeal';

import type { Weekday } from 'core/entities/FixedMeal';

/* 2026-10-05 is a Monday, so the week it opens is the one every expectation below counts from. */
const MONDAY = '2026-10-05';

describe('weekdayOf', () => {
  it('counts from Monday, not from Sunday as Date does', () => {
    expect(weekdayOf(MONDAY)).toBe(0);
    expect(weekdayOf('2026-10-09')).toBe(4);
    // The one `Date.getDay` would get wrong: it calls Sunday 0, which would put
    // Sunday at the start of the week in a product whose every week starts on Monday.
    expect(weekdayOf('2026-10-11')).toBe(6);
    expect(new Date('2026-10-11T00:00:00Z').getUTCDay()).toBe(0);
  });

  it('reads the date in UTC, so a timezone cannot move somebody’s Friday', () => {
    // Not `new Date('2026-10-09')` parsed locally: west of Greenwich that is the
    // 8th, and a rule for Friday would land on Thursday for a whole timezone.
    expect(weekdayOf('2026-10-09')).toBe(weekdayOf('2026-10-09'));
    expect([0, 1, 2, 3, 4, 5, 6]).toContain(weekdayOf('2026-01-01'));
  });
});

describe('daysFor', () => {
  it('lands a weekly rule on two days of a fortnight', () => {
    expect(daysFor(0, MONDAY, 14)).toEqual([0, 7]);
    expect(daysFor(4, MONDAY, 14)).toEqual([4, 11]);
    expect(daysFor(6, MONDAY, 14)).toEqual([6, 13]);
  });

  it('counts from the plan’s own first day, which need not be a Monday (project 015)', () => {
    // A plan starting on Thursday: its day 0 is Thursday, so a Friday rule is day 1.
    const thursday = '2026-10-08';

    expect(weekdayOf(thursday)).toBe(3);
    expect(daysFor(4, thursday, 14)).toEqual([1, 8]);
    expect(daysFor(3, thursday, 14)).toEqual([0, 7]);
    // The day *before* the start wraps to the next week rather than going negative.
    expect(daysFor(2, thursday, 14)).toEqual([6, 13]);
  });

  it('lands on one day, or none, when the plan is shorter than a week', () => {
    // A redo cuts a fortnight short, so the count cannot assume two.
    expect(daysFor(4, MONDAY, 5)).toEqual([4]);
    expect(daysFor(6, MONDAY, 5)).toEqual([]);
    expect(daysFor(0, MONDAY, 1)).toEqual([0]);
    expect(daysFor(0, MONDAY, 0)).toEqual([]);
  });

  it('gives every weekday exactly one day of any seven running, and never the same day twice', () => {
    const start = '2026-10-08';
    const landing = [0, 1, 2, 3, 4, 5, 6].flatMap(weekday => daysFor(weekday as Weekday, start, 7));

    expect([...landing].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  /*
   * `0098`: one fixed meal per day is structural, because the scheduler takes
   * its pins as a map keyed by the day index. Two rules on different weekdays
   * must therefore never collide on a day index, whatever the start.
   */
  it('never collides two weekdays on one day index, from any start', () => {
    for (const start of ['2026-10-05', '2026-10-08', '2026-10-11', '2027-02-25']) {
      const seen = new Set<number>();

      for (const weekday of [0, 1, 2, 3, 4, 5, 6] as const) {
        for (const day of daysFor(weekday, start, 14)) {
          expect(seen.has(day), `${start} weekday ${weekday} day ${day}`).toBe(false);
          seen.add(day);
        }
      }

      expect(seen.size).toBe(14);
    }
  });
});

describe('addFixedMealSchema', () => {
  it('takes a weekday, a slot and a dish', () => {
    expect(addFixedMealSchema.parse({ dishSlug: 'tortilla-de-patatas', slot: 'dinner', weekday: 4 })).toEqual({
      dishSlug: 'tortilla-de-patatas',
      slot: 'dinner',
      weekday: 4
    });
  });

  it('refuses a weekday outside the week, a slot that is not one, and an empty dish', () => {
    expect(addFixedMealSchema.safeParse({ dishSlug: 'x', slot: 'dinner', weekday: 7 }).success).toBe(false);
    expect(addFixedMealSchema.safeParse({ dishSlug: 'x', slot: 'dinner', weekday: -1 }).success).toBe(false);
    expect(addFixedMealSchema.safeParse({ dishSlug: 'x', slot: 'brunch', weekday: 1 }).success).toBe(false);
    expect(addFixedMealSchema.safeParse({ dishSlug: '  ', slot: 'dinner', weekday: 1 }).success).toBe(false);
  });
});
