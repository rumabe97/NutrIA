import { describe, expect, it } from 'vitest';

import { completedCount, completedTotals, NOTHING, shareOf } from './dayRings';

const breakfast = { id: 'b', carbsG: 50, fatG: 10, kcal: 400, proteinG: 20, status: 'planned' };
// A lunch with bread beside it: the API's figures already include the side (`MealView.kcal`).
const lunch = { id: 'l', carbsG: 90, fatG: 25, kcal: 750, proteinG: 45, status: 'completed' };
const snack = { id: 's', carbsG: 20, fatG: 5, kcal: 180, proteinG: 8, status: 'skipped' };
const dinner = { id: 'd', carbsG: 40, fatG: 20, kcal: 550, proteinG: 40, status: 'completed' };

describe('completedTotals', () => {
  it('is nothing when no meal is marked', () => {
    expect(completedTotals([breakfast, { ...lunch, status: 'planned' }])).toEqual(NOTHING);
    expect(completedTotals([])).toEqual(NOTHING);
  });

  it('sums the meals marked done, and only those', () => {
    expect(completedTotals([breakfast, lunch, snack, dinner])).toEqual({ carbsG: 130, fatG: 45, kcal: 1300, proteinG: 85 });
  });

  it('ignores a skipped meal', () => {
    expect(completedTotals([snack])).toEqual(NOTHING);
  });

  it('counts a meal with sides once, at its own figures: the sides are already inside them', () => {
    const withSides = { ...lunch, accompaniments: [{ kcal: 150 }] };

    expect(completedTotals([withSides]).kcal).toBe(750);
  });

  it('takes a mark just made over the meal’s own status, both ways', () => {
    expect(completedTotals([breakfast, lunch], { b: 'completed' }).kcal).toBe(1150);
    expect(completedTotals([breakfast, lunch], { l: 'planned' })).toEqual(NOTHING);
    expect(completedTotals([lunch], { l: 'skipped' })).toEqual(NOTHING);
  });
});

describe('completedCount', () => {
  it('counts the meals marked done, with the same overrides', () => {
    expect(completedCount([breakfast, lunch, snack, dinner])).toBe(2);
    expect(completedCount([breakfast, lunch], { b: 'completed', l: 'skipped' })).toBe(1);
  });
});

describe('shareOf', () => {
  it('is a whole percentage of the target, not capped', () => {
    expect(shareOf(684, 2246)).toBe(30);
    expect(shareOf(2700, 2246)).toBe(120);
  });

  it('is null without a target', () => {
    expect(shareOf(684, 0)).toBeNull();
    expect(shareOf(Number.NaN, 2246)).toBeNull();
  });
});
