import { describe, expect, it } from 'vitest';

import { daysIn, hasWeeks, planDays, resolveRange, WHOLE_PLAN } from './shoppingRange';

import type { RangeSelection, ShoppingListItem } from './shoppingRange';

/** A fortnight starting on a Sunday, the dates the plan would carry. */
const FORTNIGHT = Array.from({ length: 14 }, (_, index) => `2026-03-${String(index + 1).padStart(2, '0')}`);

function item(overrides: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return {
    id: 'itm-1',
    boughtGrams: 0,
    category: 'produce',
    checked: false,
    displayQuantity: 1200,
    displayUnit: 'g',
    dryRounded: false,
    gramsPerUnit: null,
    name: 'Pollo',
    perDay: {},
    totalGrams: 1200,
    ...overrides
  };
}

function days(...chosen: readonly string[]): RangeSelection {
  return { choice: 'days', days: chosen };
}

describe('planDays', () => {
  it('reads the plan’s days off the rows, in order, without asking the server for them', () => {
    // Built from entries, not a literal: the keys arrive out of order on purpose,
    // which is what this asserts, and a sorted literal could not say it.
    const items = [
      item({
        perDay: Object.fromEntries([
          ['2026-03-03', 100],
          ['2026-03-01', 200]
        ])
      }),
      item({ perDay: Object.fromEntries([['2026-03-02', 50]]) })
    ];

    expect(planDays(items)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });

  it('is empty for a list stored before the days travelled with the rows — then the screen offers no filter', () => {
    expect(planDays([item(), item()])).toEqual([]);
  });
});

describe('daysIn', () => {
  it('covers the whole plan for the fortnight', () => {
    expect(daysIn(WHOLE_PLAN, FORTNIGHT)).toEqual(FORTNIGHT);
  });

  it('splits the two weeks at the seventh day', () => {
    expect(daysIn({ choice: 'week1', days: [] }, FORTNIGHT)).toEqual(FORTNIGHT.slice(0, 7));
    expect(daysIn({ choice: 'week2', days: [] }, FORTNIGHT)).toEqual(FORTNIGHT.slice(7));
  });

  it('keeps only the chosen days the plan actually has', () => {
    expect(daysIn(days('2026-03-02', '2026-04-20'), FORTNIGHT)).toEqual(['2026-03-02']);
  });

  it('returns them in the plan’s order, not the order they were ticked', () => {
    expect(daysIn(days('2026-03-05', '2026-03-01'), FORTNIGHT)).toEqual(['2026-03-01', '2026-03-05']);
  });

  it('covers nothing when every day has been unticked', () => {
    expect(daysIn(days(), FORTNIGHT)).toEqual([]);
  });
});

describe('hasWeeks', () => {
  it('is true for a fortnight and false for a plan with no second week', () => {
    expect(hasWeeks(FORTNIGHT)).toBe(true);
    expect(hasWeeks(FORTNIGHT.slice(0, 7))).toBe(false);
  });
});

/*
 * One key serves both shopping screens, and the plan under way is replaced when
 * it is regenerated — so what this device stored can name days that no longer
 * exist. An empty list for no visible reason is the failure being avoided here.
 */
describe('resolveRange', () => {
  it('keeps chosen days that still belong to the plan', () => {
    const stored = days('2026-03-02');

    expect(resolveRange(stored, FORTNIGHT)).toBe(stored);
  });

  it('falls back to the whole plan when not one chosen day is in it', () => {
    expect(resolveRange(days('2025-01-01'), FORTNIGHT)).toEqual(WHOLE_PLAN);
  });

  /* Unticking the last day is a state the screen shows, not one to overrule: snapping
     back to the fortnight would hide the checkboxes the reader was using. */
  it('keeps a deliberately emptied day list, which is not the same as stale dates', () => {
    const stored = days();

    expect(resolveRange(stored, FORTNIGHT)).toBe(stored);
  });

  it('keeps the week presets, which are positional and survive any plan', () => {
    const stored: RangeSelection = { choice: 'week1', days: [] };

    expect(resolveRange(stored, FORTNIGHT)).toBe(stored);
    expect(resolveRange(stored, FORTNIGHT.slice(0, 7))).toBe(stored);
  });

  it('drops the second week on a plan too short to have one', () => {
    expect(resolveRange({ choice: 'week2', days: [] }, FORTNIGHT.slice(0, 7))).toEqual(WHOLE_PLAN);
  });

  it('leaves the whole plan alone', () => {
    expect(resolveRange(WHOLE_PLAN, FORTNIGHT)).toBe(WHOLE_PLAN);
  });
});

/*
 * The gesture a narrow range cannot express (found by `accessibility` as a P0).
 * A row marked across the fortnight, unmarked from one week: giving back the
 * week's share still leaves more than the week needs, so the box springs back
 * and nothing on screen moves. From a single day's view that is eleven taps
 * that each change nothing and each reach the server.
 */
describe('unmarking from a range narrower than what is bought', () => {
  /** The row's own arithmetic, as `ShoppingItem` does it. */
  function unmark(bought: number, needed: number) {
    const amount = Math.max(bought - needed, 0);

    return { amount, refused: needed > 0 && amount >= needed, stillDone: needed > 0 && amount >= needed };
  }

  it('would leave the row done after giving back a week of a fortnight', () => {
    expect(unmark(1200, 500).stillDone).toBe(true);
  });

  it('would do it eleven times over from one day of a fortnight', () => {
    let bought = 1200;
    let dead = 0;

    while (unmark(bought, 100).stillDone) {
      bought = unmark(bought, 100).amount;
      dead += 1;
    }

    expect(dead).toBe(11);
  });

  it('is refused instead, exactly when the give-back would still cover the range', () => {
    expect(unmark(1200, 500).refused).toBe(true);
    expect(unmark(700, 500).refused).toBe(false);
    expect(unmark(500, 500).refused).toBe(false);
  });

  it('never refuses a row whose range needs nothing, which cannot be marked either', () => {
    expect(unmark(0, 0).refused).toBe(false);
  });
});
