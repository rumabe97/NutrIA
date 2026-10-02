import { describe, expect, it } from 'vitest';

import { isOversized, OVERSIZED_FACTOR, SERVING_KCAL_CAP, servingCap, servingFactor } from 'core/domain/Serving';
import { makeCatalogue, makeCatalogueIngredient, makeDish } from '#test/fixtures';

import { MEAL_SLOTS } from 'core/entities/Plan';

// The fixture's base ingredient is 200 kcal per 100 g: grams = kcal / 2.
const catalogue = makeCatalogue([makeCatalogueIngredient()]);

describe('SERVING_KCAL_CAP', () => {
  /**
   * Since 4.6.0 a lunch or a dinner is one plate with bread or fruit set
   * beside it by the plan, so its dish is capped below breakfast's, which
   * stays the seed library's own ceiling.
   */
  it('caps every meal, lunch and dinner alike and every main meal above a snack', () => {
    for (const slot of MEAL_SLOTS) {
      expect(SERVING_KCAL_CAP[slot]).toBeGreaterThan(0);
    }

    expect(SERVING_KCAL_CAP.lunch).toBe(SERVING_KCAL_CAP.dinner);
    expect(SERVING_KCAL_CAP.afternoon_snack).toBeLessThan(SERVING_KCAL_CAP.lunch);
    expect(SERVING_KCAL_CAP.afternoon_snack).toBeLessThan(SERVING_KCAL_CAP.breakfast);
  });

  /**
   * Prompt 4.6.0 (project 016 § B): a main dish is one person's plate, and the
   * plan sets bread and fruit beside it. Literal figures, so a cap moved back
   * to 900 fails here rather than passing every relative assertion below.
   */
  it('designs lunch and dinner at 650 kcal a serving, and refuses one past 975', () => {
    expect(SERVING_KCAL_CAP.lunch).toBe(650);
    expect(SERVING_KCAL_CAP.dinner).toBe(650);
    expect(servingFactor(900, 'lunch')).toBeCloseTo(650 / 900, 9);
    expect(isOversized(makeDish({ ingredients: [{ grams: 976 / 2, slug: 'base' }] }), catalogue)).toBe(true);
    expect(isOversized(makeDish({ ingredients: [{ grams: 974 / 2, slug: 'base' }] }), catalogue)).toBe(false);
    expect(isOversized(makeDish({ ingredients: [{ grams: 1000 / 2, slug: 'base' }], slots: ['dinner'] }), catalogue)).toBe(true);
  });
});

describe('servingCap', () => {
  it('is the largest cap among the meals a dish is served at', () => {
    expect(servingCap(['afternoon_snack'])).toBe(SERVING_KCAL_CAP.afternoon_snack);
    expect(servingCap(['breakfast', 'afternoon_snack'])).toBe(SERVING_KCAL_CAP.breakfast);
    expect(servingCap(['dinner', 'supper'])).toBe(SERVING_KCAL_CAP.dinner);
  });
});

describe('servingFactor', () => {
  it('leaves a brief at or under its cap alone', () => {
    expect(servingFactor(600, 'lunch')).toBe(1);
    expect(servingFactor(SERVING_KCAL_CAP.lunch, 'lunch')).toBe(1);
  });

  /** The diagnosis's worst brief: 0.72 of a 3,732 kcal event day as one lunch. */
  it('brings an oversized brief down to exactly its cap', () => {
    const kcal = 2698;

    expect(kcal * servingFactor(kcal, 'lunch')).toBeCloseTo(SERVING_KCAL_CAP.lunch, 6);
    expect(900 * servingFactor(900, 'afternoon_snack')).toBeCloseTo(SERVING_KCAL_CAP.afternoon_snack, 6);
  });
});

describe('isOversized', () => {
  const lunchBound = SERVING_KCAL_CAP.lunch * OVERSIZED_FACTOR;

  it('refuses one serving past one and a half times its meal’s cap', () => {
    expect(isOversized(makeDish({ ingredients: [{ grams: (lunchBound + 2) / 2, slug: 'base' }] }), catalogue)).toBe(true);
  });

  it('keeps one serving at the bound, and one a little over the cap', () => {
    expect(isOversized(makeDish({ ingredients: [{ grams: lunchBound / 2, slug: 'base' }] }), catalogue)).toBe(false);
    expect(isOversized(makeDish({ ingredients: [{ grams: (SERVING_KCAL_CAP.lunch + 100) / 2, slug: 'base' }] }), catalogue)).toBe(false);
  });

  it('judges one serving, not the pot: the same grams over three servings are three plates', () => {
    const pot = { ingredients: [{ grams: 1300, slug: 'base' }] };

    expect(isOversized(makeDish({ ...pot, servings: 1 }), catalogue)).toBe(true);
    expect(isOversized(makeDish({ ...pot, servings: 3 }), catalogue)).toBe(false);
  });

  it('holds a snack to a snack’s cap, and a dish served at lunch too to lunch’s', () => {
    const dish = { ingredients: [{ grams: 400, slug: 'base' }] };

    expect(isOversized(makeDish({ ...dish, slots: ['afternoon_snack'] }), catalogue)).toBe(true);
    expect(isOversized(makeDish({ ...dish, slots: ['afternoon_snack', 'lunch'] }), catalogue)).toBe(false);
  });

  it('leaves a dish with a slug the catalogue does not know to the catalogue gate', () => {
    expect(isOversized(makeDish({ ingredients: [{ grams: 2000, slug: 'unicornio' }] }), catalogue)).toBe(false);
  });
});
