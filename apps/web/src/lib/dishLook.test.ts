import { describe, expect, it } from 'vitest';

import { dishMoment } from './dishLook';

import type { MealSlot } from 'core/entities/Plan';

/** `MEAL_SLOTS`, written out: this app takes types from `core`, not values. The type keeps the two in step. */
const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'];

describe('dishMoment', () => {
  it('gives every slot the product has a moment of its own mapping', () => {
    expect(MEAL_SLOTS.map(slot => [slot, dishMoment(slot)])).toEqual([
      ['breakfast', 'morning'],
      ['morning_snack', 'snack'],
      ['lunch', 'midday'],
      ['afternoon_snack', 'snack'],
      ['dinner', 'evening'],
      ['supper', 'evening']
    ]);
  });

  it('draws an unknown or missing slot as a plate, never as nothing', () => {
    expect(dishMoment('brunch')).toBe('midday');
    expect(dishMoment(undefined)).toBe('midday');
    expect(dishMoment(null)).toBe('midday');
  });
});
