import { describe, expect, it } from 'vitest';

import { swapOffered } from './mealSwap';

const open = { allowanceKnown: true, away: false, mealStatus: 'planned', offline: false, planStatus: 'active' } as const;

describe('swapOffered', () => {
  it('offers the swap on a meal still to come of the plan being lived', () => {
    expect(swapOffered(open)).toBe(true);
  });

  it.each(['completed', 'skipped'])('does not offer it on a meal marked %s', mealStatus => {
    expect(swapOffered({ ...open, mealStatus })).toBe(false);
  });

  it.each(['completed', 'archived', 'scheduled', 'pending_review'])('does not offer it on a plan that is %s', planStatus => {
    expect(swapOffered({ ...open, planStatus })).toBe(false);
  });

  it('does not offer it while the plan is paused', () => {
    expect(swapOffered({ ...open, away: true })).toBe(false);
  });

  it('does not offer it when the allowance could not be read', () => {
    expect(swapOffered({ ...open, allowanceKnown: false })).toBe(false);
  });

  it('does not offer it offline', () => {
    expect(swapOffered({ ...open, offline: true })).toBe(false);
  });
});
