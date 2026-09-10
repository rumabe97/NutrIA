import { describe, expect, it } from 'vitest';

import { shapeFor, slotsIn, weightsFor } from './MealShape';

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
