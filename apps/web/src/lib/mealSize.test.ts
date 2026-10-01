import { describe, expect, it } from 'vitest';

import { mealCount, mealSizeKey } from './mealSize';

import type { MealShape } from 'core/entities/Profile';

const shape: MealShape = { afternoon_snack: 'off', breakfast: 'off', dinner: 'normal', lunch: 'large', morning_snack: 'off', supper: 'off' };

describe('mealSize', () => {
  it('counts the meals that are not off', () => {
    expect(mealCount(shape)).toBe(2);
  });

  it('keys an answer on the figure and the shape, so either changing asks again', () => {
    const key = mealSizeKey(900, shape);

    expect(mealSizeKey(950, shape)).not.toBe(key);
    expect(mealSizeKey(900, { ...shape, breakfast: 'light' })).not.toBe(key);
    expect(mealSizeKey(900, { ...shape })).toBe(key);
  });
});
