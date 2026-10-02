import { describe, expect, it } from 'vitest';

import { LARGE_MEAL_KCAL, mainMealSize, mealShareKcal, mealSizeSuggestion, shapeFor, slotsIn, weightsFor } from './MealShape';

import { mealShapeSchema } from 'core/entities/Profile';

import type { MealShape } from 'core/entities/Profile';

const ORDINARY: MealShape = { afternoon_snack: 'off', breakfast: 'normal', dinner: 'normal', lunch: 'normal', morning_snack: 'off', supper: 'off' };

/** Each slot's percentage of the day, which is what the scheduler actually divides by. */
function share(shape: MealShape) {
  const weights = weightsFor(shape);
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);

  return new Map([...weights].map(([slot, weight]) => [slot, Math.round((weight / total) * 1000) / 10]));
}

describe('which meals somebody eats', () => {
  it('drops the ones they skip, whichever they are', () => {
    expect(slotsIn({ ...ORDINARY, breakfast: 'off' })).toEqual(['lunch', 'dinner']);
    // The thing the old question could not express: two meals always meant
    // dropping dinner, never breakfast.
    expect(slotsIn({ ...ORDINARY, dinner: 'off' })).toEqual(['breakfast', 'lunch']);
  });

  it('keeps a day in the order it is lived', () => {
    expect(
      slotsIn({ afternoon_snack: 'normal', breakfast: 'normal', dinner: 'normal', lunch: 'normal', morning_snack: 'normal', supper: 'normal' })
    ).toEqual(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper']);
  });
});

describe('how big each one is', () => {
  it('hands a light meal share to the rest of the day, and takes none of it away', () => {
    const ordinary = share(ORDINARY);
    const lightBreakfast = share({ ...ORDINARY, breakfast: 'light' });

    expect(lightBreakfast.get('breakfast')).toBeLessThan(ordinary.get('breakfast') as number);
    // The day is still a whole day: what breakfast gives up, lunch and dinner take.
    expect(lightBreakfast.get('lunch')).toBeGreaterThan(ordinary.get('lunch') as number);
    expect(lightBreakfast.get('dinner')).toBeGreaterThan(ordinary.get('dinner') as number);
    expect([...lightBreakfast.values()].reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 0);
  });

  it('gives a large meal more than a normal one of the same slot', () => {
    expect(share({ ...ORDINARY, dinner: 'large' }).get('dinner')).toBeGreaterThan(share(ORDINARY).get('dinner') as number);
  });

  it('never gives a skipped meal a share', () => {
    expect(weightsFor({ ...ORDINARY, breakfast: 'off' }).has('breakfast')).toBe(false);
  });
});

describe('a day has to have a meal in it', () => {
  it('refuses a shape where everything is skipped', () => {
    const nothing = { afternoon_snack: 'off', breakfast: 'off', dinner: 'off', lunch: 'off', morning_snack: 'off', supper: 'off' };

    // Not a taste to respect: the scheduler would build an empty plan and
    // validation would refuse it, which is an error code where a sentence
    // belongs (`0036`).
    expect(mealShapeSchema.safeParse(nothing).success).toBe(false);
  });

  it('accepts one meal a day, which is somebody describing themselves', () => {
    expect(mealShapeSchema.safeParse({ ...ORDINARY, breakfast: 'off', dinner: 'off' }).success).toBe(true);
  });
});

describe('shapeFor — the day an old answer implied', () => {
  it('reads three meals as the three meals', () => {
    expect(slotsIn(shapeFor(3, false))).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('adds the afternoon before the morning, as the old derivation did', () => {
    expect(slotsIn(shapeFor(4, true))).toEqual(['breakfast', 'lunch', 'afternoon_snack', 'dinner']);
    expect(slotsIn(shapeFor(5, true))).toEqual(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']);
  });

  it('gives somebody who wanted no snacks a supper instead', () => {
    expect(slotsIn(shapeFor(4, false))).toEqual(['breakfast', 'lunch', 'dinner', 'supper']);
  });
});

describe('how big each meal is', () => {
  const TWO_MEALS: MealShape = { ...ORDINARY, breakfast: 'off' };

  it('splits the day by the weights the scheduler sizes plates to', () => {
    const shares = mealShareKcal(TWO_MEALS, { kcal: 2100 });

    // 0.33 and 0.30 of a day with nothing else in it.
    expect(shares.get('lunch')).toBeCloseTo((2100 * 0.33) / 0.63, 6);
    expect(shares.get('dinner')).toBeCloseTo((2100 * 0.3) / 0.63, 6);
    expect(shares.has('breakfast')).toBe(false);
    expect([...shares.values()].reduce((sum, kcal) => sum + kcal, 0)).toBeCloseTo(2100, 6);
  });

  it('says a two-meal day of 2,100 kcal has large meals, and a three-meal day of 2,200 does not', () => {
    expect(mainMealSize(TWO_MEALS, { kcal: 2100 })).toEqual({ largeMeals: true, largestMainKcal: 1100 });
    expect(mainMealSize(ORDINARY, { kcal: 2200 })).toEqual({ largeMeals: false, largestMainKcal: 825 });
  });

  it('counts breakfast as a main meal and a snack as none', () => {
    const breakfastOnly: MealShape = {
      afternoon_snack: 'normal',
      breakfast: 'normal',
      dinner: 'off',
      lunch: 'off',
      morning_snack: 'off',
      supper: 'off'
    };

    expect(mainMealSize(breakfastOnly, { kcal: 1700 }).largestMainKcal).toBe(Math.round((1700 * 0.25) / 0.34));
  });

  it('is large only past 850 kcal, on the rounded figure', () => {
    // Lunch alone: the whole day is the lunch.
    const lunchOnly: MealShape = { afternoon_snack: 'off', breakfast: 'off', dinner: 'off', lunch: 'normal', morning_snack: 'off', supper: 'off' };

    expect(mainMealSize(lunchOnly, { kcal: LARGE_MEAL_KCAL })).toEqual({ largeMeals: false, largestMainKcal: 850 });
    expect(mainMealSize(lunchOnly, { kcal: 850.4 })).toEqual({ largeMeals: false, largestMainKcal: 850 });
    expect(mainMealSize(lunchOnly, { kcal: 851 })).toEqual({ largeMeals: true, largestMainKcal: 851 });
  });
});

describe('the change the large-meals note names (016 phase 3)', () => {
  // The owner's own shape: two light snacks around a normal lunch and dinner.
  const OWNER: MealShape = { afternoon_snack: 'light', breakfast: 'off', dinner: 'normal', lunch: 'normal', morning_snack: 'light', supper: 'off' };

  it('offers the owner a breakfast, which brings lunch to about 745 kcal', () => {
    // Lunch is 2,177 × 0.33 ÷ 0.715 ≈ 1,005 today; with a breakfast of 0.25 the total is 0.965.
    expect(mainMealSize(OWNER, { kcal: 2177 }).largestMainKcal).toBe(1005);
    // 2,177 × 0.33 ÷ 0.965 = 744.5, the plan's "unas 745".
    expect(mealSizeSuggestion(OWNER, { kcal: 2177 })).toEqual({ change: 'add_breakfast', largestMainKcal: 744 });
  });

  it('is null when the meals are not large', () => {
    expect(mealSizeSuggestion(ORDINARY, { kcal: 2200 })).toBeNull();
  });

  it('turns a light snack normal, the morning first, when there is already a breakfast', () => {
    const withBreakfast: MealShape = { ...OWNER, breakfast: 'light' };

    // 2,200 × 0.33 ÷ 0.84 = 864 today; a normal morning snack makes the total 0.88, and lunch 825.
    expect(mainMealSize(withBreakfast, { kcal: 2200 }).largestMainKcal).toBe(864);
    expect(mealSizeSuggestion(withBreakfast, { kcal: 2200 })).toEqual({ change: 'snack_to_normal', largestMainKcal: 825, slot: 'morning_snack' });
  });

  it('adds an afternoon snack when nothing earlier in the order is open', () => {
    const noSnacks: MealShape = {
      afternoon_snack: 'off',
      breakfast: 'normal',
      dinner: 'normal',
      lunch: 'normal',
      morning_snack: 'off',
      supper: 'off'
    };
    const kcal = 2700;

    // 2,700 × 0.33 ÷ 0.88 = 1,013; with a normal afternoon snack 2,700 × 0.33 ÷ 0.97 = 919 — still large.
    expect(mealSizeSuggestion(noSnacks, { kcal })).toBeNull();
    // 2,450: 919 today, 834 with the snack.
    expect(mealSizeSuggestion(noSnacks, { kcal: 2450 })).toEqual({ change: 'add_afternoon_snack', largestMainKcal: 834 });
  });

  it('is null when no single change gets there', () => {
    // At 2,700 the owner's lunch is 1,246: 923 with a breakfast, 1,180 and 1,172 with either snack made normal.
    expect(mealSizeSuggestion(OWNER, { kcal: 2700 })).toBeNull();
  });

  it('skips a change that does not get there and names the next that does', () => {
    // Breakfast is already eaten, so the light snack is the first change tried.
    const lightBreakfastNoSnacks: MealShape = {
      afternoon_snack: 'off',
      breakfast: 'light',
      dinner: 'normal',
      lunch: 'normal',
      morning_snack: 'light',
      supper: 'off'
    };

    // 0.125 + 0.04 + 0.33 + 0.30 = 0.795: lunch 2,100 × 0.33 ÷ 0.795 = 872. A normal morning snack: 0.835 → 830.
    expect(mealSizeSuggestion(lightBreakfastNoSnacks, { kcal: 2100 })).toEqual({
      change: 'snack_to_normal',
      largestMainKcal: 830,
      slot: 'morning_snack'
    });
    // At 2,200 that is 869, still large; the afternoon snack is added instead: 0.885 → 820.
    expect(mealSizeSuggestion(lightBreakfastNoSnacks, { kcal: 2200 })).toEqual({ change: 'add_afternoon_snack', largestMainKcal: 820 });
  });
});
