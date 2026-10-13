import { describe, expect, it } from 'vitest';

import {
  ALLOWANCE_BOUNDS,
  ALLOWANCE_NAMES,
  ALLOWANCES,
  allowancesFor,
  eventStanding,
  mealSwapStanding,
  midPlanEventStanding,
  planRedoStanding,
  redosInFortnight,
  resolveAllowances,
  startMeaning
} from 'core/domain/Allowance';

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

  it('counts the redos of pending plans a plan replaced, which are no longer in the chain (0060)', () => {
    // v4 pending, a redo that replaced two pending redos; v1 active opened the fortnight.
    expect(redosInFortnight([{ redo: true, replacedRedos: 2 }, { redo: false }])).toBe(3);
    expect(redosInFortnight([{ redo: false, replacedRedos: 2 }])).toBe(0);
  });
});

describe('mealSwapStanding', () => {
  it('counts down to zero and no further', () => {
    expect(mealSwapStanding(0)).toEqual({ allowed: true, limit: ALLOWANCES.mealSwapsPerPlan, remaining: ALLOWANCES.mealSwapsPerPlan, used: 0 });
    expect(mealSwapStanding(ALLOWANCES.mealSwapsPerPlan)).toMatchObject({ allowed: false, remaining: 0 });
    expect(mealSwapStanding(ALLOWANCES.mealSwapsPerPlan + 2)).toMatchObject({ allowed: false, remaining: 0 });
  });
});

describe('eventStanding — days that eat for something, per fortnight', () => {
  it('is three a plan on the free tier and ten on premium', () => {
    expect(allowancesFor('free').eventsPerPlan).toBe(3);
    expect(allowancesFor('premium').eventsPerPlan).toBe(7);
  });

  it('allows up to the limit and not one past it', () => {
    expect(eventStanding(2)).toEqual({ allowed: true, limit: 3, remaining: 1, used: 2 });
    expect(eventStanding(3)).toMatchObject({ allowed: false, remaining: 0 });
    // Seven, not ten: an eighth event cannot have a loaded day in a fortnight (`0097`).
    expect(eventStanding(6, allowancesFor('premium'))).toMatchObject({ allowed: true, remaining: 1 });
    expect(eventStanding(7, allowancesFor('premium'))).toMatchObject({ allowed: false, remaining: 0 });
  });
});

describe('midPlanEventStanding — rebuilding the fortnight under way', () => {
  it('is none on the free tier and three on premium', () => {
    expect(allowancesFor('free').midPlanEventsPerPlan).toBe(0);
    expect(allowancesFor('premium').midPlanEventsPerPlan).toBe(3);
  });

  /*
   * Zero, not absent: the free answer is still a standing the screen can read,
   * and it reads `allowed: false` before anyone asks which tier it is on.
   */
  it('never allows a free account one, and stops premium at its number', () => {
    expect(midPlanEventStanding(0)).toEqual({ allowed: false, limit: 0, remaining: 0, used: 0 });
    expect(midPlanEventStanding(2, allowancesFor('premium'))).toEqual({ allowed: true, limit: 3, remaining: 1, used: 2 });
    expect(midPlanEventStanding(3, allowancesFor('premium'))).toMatchObject({ allowed: false, remaining: 0 });
  });
});

describe('allowancesFor', () => {
  it('gives premium more of everything', () => {
    expect(allowancesFor('premium').planRedosPerFortnight).toBeGreaterThan(allowancesFor('free').planRedosPerFortnight);
    expect(allowancesFor('premium').mealSwapsPerPlan).toBeGreaterThan(allowancesFor('free').mealSwapsPerPlan);
    expect(allowancesFor('premium').eventsPerPlan).toBeGreaterThan(allowancesFor('free').eventsPerPlan);
    expect(allowancesFor('premium').midPlanEventsPerPlan).toBeGreaterThan(allowancesFor('free').midPlanEventsPerPlan);
    expect(allowancesFor('premium').fixedMeals).toBeGreaterThan(allowancesFor('free').fixedMeals);
    expect(allowancesFor('premium').dishRequestsPerMonth).toBeGreaterThan(allowancesFor('free').dishRequestsPerMonth);
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
    expect(mealSwapStanding(6, allowancesFor('premium'))).toMatchObject({ allowed: true, limit: allowancesFor('premium').mealSwapsPerPlan });
    expect(mealSwapStanding(6, allowancesFor('free'))).toMatchObject({ allowed: false, limit: allowancesFor('free').mealSwapsPerPlan });

    expect(planRedoStanding({ endDate: '2026-09-20' }, 1, '2026-09-09', allowancesFor('premium'))).toMatchObject({ allowed: true });
    expect(planRedoStanding({ endDate: '2026-09-20' }, 1, '2026-09-09', allowancesFor('free'))).toMatchObject({ allowed: false });
  });

  /* A caller that forgets to say which tier gets the free one, not the generous one. */
  it('treats an unstated tier as free', () => {
    expect(mealSwapStanding(6)).toMatchObject({ allowed: false });
    expect(planRedoStanding({ endDate: '2026-09-20' }, 1, '2026-09-09')).toMatchObject({ allowed: false });
  });
});

describe('startMeaning — what a chosen first day spends (project 015)', () => {
  const TODAY = '2026-10-02';
  const A = { endDate: '2026-10-04' };

  it('is the next fortnight, free, after the plan under way ends — waiting when that is after today', () => {
    expect(startMeaning(A, '2026-10-05', TODAY)).toEqual({ cuts: null, kind: 'new_fortnight', scheduled: true });
  });

  it('is a redo that cuts the plan under way to the day before, for a start on or before its end', () => {
    expect(startMeaning(A, '2026-10-04', TODAY)).toEqual({ cuts: '2026-10-03', kind: 'redo', scheduled: true });
    expect(startMeaning(A, '2026-10-03', TODAY)).toEqual({ cuts: '2026-10-02', kind: 'redo', scheduled: true });
  });

  it('is today’s redo, as it always was, for a start of today while a plan runs', () => {
    expect(startMeaning(A, TODAY, TODAY)).toMatchObject({ kind: 'redo', scheduled: false });
    expect(startMeaning({ endDate: '2026-10-01' }, TODAY, TODAY)).toEqual({ cuts: null, kind: 'new_fortnight', scheduled: false });
  });

  it('is a new fortnight on any day with no plan under way', () => {
    expect(startMeaning(undefined, TODAY, TODAY)).toEqual({ cuts: null, kind: 'new_fortnight', scheduled: false });
    expect(startMeaning(undefined, '2026-10-09', TODAY)).toEqual({ cuts: null, kind: 'new_fortnight', scheduled: true });
  });

  it('is a redo whatever the day when a plan already waits for its day: it is replaced', () => {
    expect(startMeaning(A, '2026-10-05', TODAY, true)).toEqual({ cuts: null, kind: 'redo', scheduled: true });
    expect(startMeaning(undefined, '2026-10-05', TODAY, true)).toMatchObject({ kind: 'redo' });
  });
});

describe('redosInFortnight — a plan that replaced the next fortnight’s opener (project 015)', () => {
  it('counts it and its carried redos, and stops there: it opened that fortnight', () => {
    expect(redosInFortnight([{ opens: true, redo: true, replacedRedos: 1 }, { redo: true }, { redo: false }])).toBe(2);
    expect(redosInFortnight([{ redo: true }, { opens: true, redo: true }, { redo: true }])).toBe(2);
  });
});

describe('resolveAllowances — what the console stored, believed or not (0097)', () => {
  const stored = (tier: string, name: string, value: number) => ({ name, tier, value });

  it('is the shipped table when the console has stored nothing', () => {
    expect(resolveAllowances()).toEqual({ free: allowancesFor('free'), premium: allowancesFor('premium') });
  });

  it('takes a whole number inside its bounds', () => {
    const { free, premium } = resolveAllowances([stored('free', 'eventsPerPlan', 1), stored('premium', 'eventsPerPlan', 4)]);

    expect(free.eventsPerPlan).toBe(1);
    expect(premium.eventsPerPlan).toBe(4);
  });

  /** Rule 1: the fallback is the shipped number, never the nearest bound — a typo may not grant. */
  it.each([
    ['above its ceiling', 999],
    ['below its floor', -1],
    ['not a whole number', 2.5],
    ['not a number at all', Number.NaN]
  ])('reads a value that is %s as the shipped default, not as the bound', (_case, value) => {
    expect(resolveAllowances([stored('premium', 'mealSwapsPerPlan', value)]).premium.mealSwapsPerPlan).toBe(
      allowancesFor('premium').mealSwapsPerPlan
    );
  });

  it('ignores a row naming a limit this version does not have', () => {
    expect(resolveAllowances([stored('free', 'somethingElse', 99)])).toEqual({ free: allowancesFor('free'), premium: allowancesFor('premium') });
  });

  /** Rule 2, and the ordering that makes a write-time refusal alone insufficient. */
  it('never answers premium below free, however the two were stored', () => {
    // Free raised after premium was set: valid when written, invalid now.
    const { free, premium } = resolveAllowances([stored('premium', 'planRedosPerFortnight', 2), stored('free', 'planRedosPerFortnight', 5)]);

    expect(free.planRedosPerFortnight).toBe(5);
    expect(premium.planRedosPerFortnight).toBe(5);
  });

  it('does not let a free value outside its bounds drag premium up with it', () => {
    // Free's 50 is refused (rule 1) before the pair rule reads it, so premium keeps its own.
    const { free, premium } = resolveAllowances([stored('free', 'mealSwapsPerPlan', 50), stored('premium', 'mealSwapsPerPlan', 10)]);

    expect(free.mealSwapsPerPlan).toBe(allowancesFor('free').mealSwapsPerPlan);
    expect(premium.mealSwapsPerPlan).toBe(10);
  });

  /** Rule 3, per tier and after the pair rule. */
  it('holds mid-plan events to that tier’s own events', () => {
    const { free, premium } = resolveAllowances([
      stored('free', 'eventsPerPlan', 1),
      stored('free', 'midPlanEventsPerPlan', 4),
      stored('premium', 'eventsPerPlan', 2),
      stored('premium', 'midPlanEventsPerPlan', 6)
    ]);

    expect(free.midPlanEventsPerPlan).toBe(1);
    expect(premium.midPlanEventsPerPlan).toBe(2);
  });

  /**
   * The ordering that `invariant-reviewer` found: read against free's *unclamped*
   * mid-plan number, premium would keep five while the admin had just set three,
   * and the write-time check could not catch it because it compares the clamped one.
   */
  it('does not let a free number free itself never gets hold premium up', () => {
    const { free, premium } = resolveAllowances([
      stored('free', 'eventsPerPlan', 0),
      stored('free', 'midPlanEventsPerPlan', 5),
      stored('premium', 'midPlanEventsPerPlan', 3)
    ]);

    expect(free.midPlanEventsPerPlan).toBe(0);
    expect(premium.midPlanEventsPerPlan).toBe(3);
  });

  it('zero is a value, not an absence: it makes a thing premium-only', () => {
    const { free } = resolveAllowances([stored('free', 'mealSwapsPerPlan', 0)]);

    expect(free.mealSwapsPerPlan).toBe(0);
    expect(mealSwapStanding(0, { ...allowancesFor('free'), mealSwapsPerPlan: 0 })).toEqual({ allowed: false, limit: 0, remaining: 0, used: 0 });
  });
});

describe('ALLOWANCE_BOUNDS', () => {
  it('ships every default inside its own bounds, for both tiers', () => {
    for (const [name, bounds] of Object.entries(ALLOWANCE_BOUNDS)) {
      for (const tier of ['free', 'premium'] as const) {
        const shipped = allowancesFor(tier)[name as keyof typeof ALLOWANCES];

        expect(shipped, `${tier}.${name}`).toBeGreaterThanOrEqual(bounds.floor);
        expect(shipped, `${tier}.${name}`).toBeLessThanOrEqual(bounds.ceiling);
      }
    }
  });

  it('gives every ceiling a reason, because a ceiling with none is how ten events happened', () => {
    for (const [name, bounds] of Object.entries(ALLOWANCE_BOUNDS)) {
      expect(bounds.why.trim().length, name).toBeGreaterThan(20);
    }
  });

  /*
   * `0097`: a structural limit's ceiling *is* the number shipped in the code,
   * because raising one spends the promise that every day lands inside 5% on
   * all four macros and the console cannot know what a raise costs. The
   * registry is where that would be broken, silently, by a ceiling set a little
   * above the default "to leave room".
   */
  it('holds a structural ceiling at the premium number shipped, so the console may only lower it (0097)', () => {
    const structural = Object.entries(ALLOWANCE_BOUNDS).filter(([, bounds]) => bounds.kind === 'structural');

    expect(structural.map(([name]) => name)).toEqual(['fixedMeals']);

    for (const [name, bounds] of structural) {
      expect(bounds.ceiling, name).toBe(allowancesFor('premium')[name as keyof typeof ALLOWANCES]);
    }
  });

  /*
   * `satisfies readonly AllowanceName[]` checks that every entry is a real
   * name; it does not check that every name is an entry. An allowance missing
   * from the list is one the console cannot move and `resolveAllowances`
   * ignores every row for — a limit that silently cannot be configured.
   */
  /*
   * `0097` again: zero is a value and not an absence. Free has none of this one
   * on purpose — free is the population that scales, and a request costs money
   * every time it succeeds — so the resolution must not quietly raise it, and
   * the premium-never-below-free rule must not read 0 as "unset".
   */
  it('keeps free at none where that is the shipped answer, and does not read it as unset', () => {
    expect(allowancesFor('free').dishRequestsPerMonth).toBe(0);
    expect(resolveAllowances().free.dishRequestsPerMonth).toBe(0);
    expect(resolveAllowances([{ name: 'dishRequestsPerMonth', tier: 'premium', value: 0 }]).premium.dishRequestsPerMonth).toBe(0);
  });

  it('registers every allowance, so none is unmovable from the console', () => {
    expect([...ALLOWANCE_NAMES].sort()).toEqual(Object.keys(ALLOWANCES).sort());
    expect([...ALLOWANCE_NAMES].sort()).toEqual(Object.keys(ALLOWANCE_BOUNDS).sort());
  });
});
