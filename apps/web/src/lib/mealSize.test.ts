import { describe, expect, it } from 'vitest';

import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';
import { mealCount, mealSizeAction, mealSizeBody, mealSizeKey } from './mealSize';

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

  it('says the change and the result, in each language', () => {
    const suggestion = { change: 'snack_to_normal', largestMainKcal: 874, slot: 'afternoon_snack' } as const;

    expect(mealSizeBody(esES, 'es-ES', 2, 1100, suggestion)).toContain(
      'Si pasas la merienda de ligera a normal, tu comida principal bajaría a unas 870 kcal.'
    );
    expect(mealSizeAction(esES, 'es-ES', suggestion)).toBe('Cambiar la merienda');
    expect(mealSizeAction(enGB, 'en-GB', { change: 'add_breakfast', largestMainKcal: 800 })).toBe('Add a breakfast');
  });

  it('offers no action when no change would bring it under', () => {
    expect(mealSizeAction(esES, 'es-ES', null)).toBeNull();
    expect(mealSizeBody(enGB, 'en-GB', 2, 1100, null)).toContain('would not bring it any lower');
  });
});
