import { describe, expect, it } from 'vitest';

import { ALLOWANCES, mealSwapStanding, planRedoStanding, redosInFortnight } from 'core/domain/Allowance';

describe('planRedoStanding', () => {
  it('always allows a first plan, and the next fortnight once the current one has ended', () => {
    expect(planRedoStanding(undefined, 0, '2026-09-09')).toMatchObject({ allowed: true, kind: 'new_fortnight' });
    expect(planRedoStanding({ endDate: '2026-09-08' }, 3, '2026-09-09')).toMatchObject({ allowed: true, kind: 'new_fortnight', used: 0 });
  });

  it('allows one redo of the fortnight in progress, then names the day the next one opens', () => {
    expect(planRedoStanding({ endDate: '2026-09-20' }, 0, '2026-09-09')).toMatchObject({ allowed: true, kind: 'redo', nextAt: null, used: 0 });
    expect(planRedoStanding({ endDate: '2026-09-20' }, ALLOWANCES.planRedosPerFortnight, '2026-09-09')).toMatchObject({ allowed: false, kind: 'redo', nextAt: '2026-09-21' });
  });

  it('treats the last day of the plan as still in progress', () => {
    expect(planRedoStanding({ endDate: '2026-09-09' }, 1, '2026-09-09')).toMatchObject({ allowed: false, kind: 'redo', nextAt: '2026-09-10' });
  });
});

describe('redosInFortnight', () => {
  it('counts predecessors that were cut short, and stops at the first that ran its course', () => {
    // v3 active; v2 replaced on day 3 of 14; v1 replaced on day 2 — two redos this fortnight.
    expect(redosInFortnight([{ completedAt: '2026-09-04', endDate: '2026-09-15' }, { completedAt: '2026-09-02', endDate: '2026-09-14' }])).toBe(2);
    // v2 active; v1 ended naturally and the next fortnight was generated a day later.
    expect(redosInFortnight([{ completedAt: '2026-09-15', endDate: '2026-09-14' }])).toBe(0);
    // A redo behind a plan that ran its course belongs to the previous fortnight.
    expect(redosInFortnight([{ completedAt: '2026-09-15', endDate: '2026-09-14' }, { completedAt: '2026-08-20', endDate: '2026-09-01' }])).toBe(0);
    expect(redosInFortnight([])).toBe(0);
  });

  it('does not count a plan replaced on its own last day as cut short', () => {
    expect(redosInFortnight([{ completedAt: '2026-09-14', endDate: '2026-09-14' }])).toBe(0);
  });
});

describe('mealSwapStanding', () => {
  it('counts down to zero and no further', () => {
    expect(mealSwapStanding(0)).toEqual({ allowed: true, limit: ALLOWANCES.mealSwapsPerPlan, remaining: ALLOWANCES.mealSwapsPerPlan, used: 0 });
    expect(mealSwapStanding(ALLOWANCES.mealSwapsPerPlan)).toMatchObject({ allowed: false, remaining: 0 });
    expect(mealSwapStanding(ALLOWANCES.mealSwapsPerPlan + 2)).toMatchObject({ allowed: false, remaining: 0 });
  });
});
