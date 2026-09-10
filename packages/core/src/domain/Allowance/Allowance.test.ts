import { describe, expect, it } from 'vitest';

import { ALLOWANCES, allowancesFor, mealSwapStanding, planRedoStanding, redosInFortnight } from 'core/domain/Allowance';

describe('planRedoStanding', () => {
  it('always allows a first plan, and the next fortnight once the current one has ended', () => {
    expect(planRedoStanding(undefined, 0, '2026-09-09')).toMatchObject({ allowed: true, kind: 'new_fortnight' });
    expect(planRedoStanding({ endDate: '2026-09-08' }, 3, '2026-09-09')).toMatchObject({ allowed: true, kind: 'new_fortnight', used: 0 });
  });

  it('allows one redo of the fortnight in progress, then names the day the next one opens', () => {
    expect(planRedoStanding({ endDate: '2026-09-20' }, 0, '2026-09-09')).toMatchObject({ allowed: true, kind: 'redo', nextAt: null, used: 0 });
    expect(planRedoStanding({ endDate: '2026-09-20' }, ALLOWANCES.planRedosPerFortnight, '2026-09-09')).toMatchObject({
      allowed: false,
      kind: 'redo',
      nextAt: '2026-09-21'
    });
  });

  it('treats the last day of the plan as still in progress', () => {
    expect(planRedoStanding({ endDate: '2026-09-09' }, 1, '2026-09-09')).toMatchObject({ allowed: false, kind: 'redo', nextAt: '2026-09-10' });
  });
});

describe('redosInFortnight', () => {
  it('counts stamped redos back from the active plan, and stops at the plan that opened the fortnight', () => {
    // v3 active and a redo; v2 a redo; v1 opened the fortnight — two redos.
    expect(redosInFortnight([{ redo: true }, { redo: true }, { redo: false }])).toBe(2);
    // v2 active and a fresh fortnight; whatever happened before it is not this fortnight's.
    expect(redosInFortnight([{ redo: false }, { redo: true }, { redo: true }])).toBe(0);
    expect(redosInFortnight([])).toBe(0);
  });

  it('starts a person whose history predates the allowance with it untouched', () => {
    // Plans generated before the stamp existed carry no flag, however many there were.
    expect(redosInFortnight([{ redo: false }, { redo: false }, { redo: false }, { redo: false }])).toBe(0);
  });
});

describe('mealSwapStanding', () => {
  it('counts down to zero and no further', () => {
    expect(mealSwapStanding(0)).toEqual({ allowed: true, limit: ALLOWANCES.mealSwapsPerPlan, remaining: ALLOWANCES.mealSwapsPerPlan, used: 0 });
    expect(mealSwapStanding(ALLOWANCES.mealSwapsPerPlan)).toMatchObject({ allowed: false, remaining: 0 });
    expect(mealSwapStanding(ALLOWANCES.mealSwapsPerPlan + 2)).toMatchObject({ allowed: false, remaining: 0 });
  });
});

describe('allowancesFor', () => {
  it('gives premium more of both', () => {
    expect(allowancesFor('premium').planRedosPerFortnight).toBeGreaterThan(allowancesFor('free').planRedosPerFortnight);
    expect(allowancesFor('premium').mealSwapsPerPlan).toBeGreaterThan(allowancesFor('free').mealSwapsPerPlan);
  });

  /*
   * This is read where the answer decides whether somebody may spend a model
   * call. A value nobody recognises must grant the smaller number, never the
   * larger — the failure that costs money is the one that grants too much.
   */
  it('falls back to free for anything it does not recognise', () => {
    expect(allowancesFor(null)).toEqual(allowancesFor('free'));
    expect(allowancesFor(undefined)).toEqual(allowancesFor('free'));
    expect(allowancesFor('gold' as never)).toEqual(allowancesFor('free'));
  });

  it('is what the standings count against', () => {
    expect(mealSwapStanding(6, 'premium')).toMatchObject({ allowed: true, limit: allowancesFor('premium').mealSwapsPerPlan });
    expect(mealSwapStanding(6, 'free')).toMatchObject({ allowed: false, limit: allowancesFor('free').mealSwapsPerPlan });

    expect(planRedoStanding({ endDate: '2026-09-20' }, 1, '2026-09-09', 'premium')).toMatchObject({ allowed: true });
    expect(planRedoStanding({ endDate: '2026-09-20' }, 1, '2026-09-09', 'free')).toMatchObject({ allowed: false });
  });

  /* A caller that forgets to say which tier gets the free one, not the generous one. */
  it('treats an unstated tier as free', () => {
    expect(mealSwapStanding(6)).toMatchObject({ allowed: false });
    expect(planRedoStanding({ endDate: '2026-09-20' }, 1, '2026-09-09')).toMatchObject({ allowed: false });
  });
});
