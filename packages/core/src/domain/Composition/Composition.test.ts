import { describe, expect, it } from 'vitest';

import { addMacros, composeMacros, composePerServing, scaleIngredients, scaleMacros, sumMacros, ZERO_MACROS } from 'core/domain/Composition';
import { makeCatalogue, makeCatalogueIngredient, makeDish } from '#test/fixtures';

const catalogue = makeCatalogue([
  makeCatalogueIngredient(),
  makeCatalogueIngredient({ id: 'ing-chicken', carbsPer100g: 0, fatPer100g: 3.6, fiberPer100g: 0, kcalPer100g: 165, name: 'Pollo', proteinPer100g: 31, slug: 'pollo' })
]);

describe('composeMacros', () => {
  it('sums per-100 g values by weight', () => {
    const result = composeMacros([{ grams: 200, slug: 'pollo' }], catalogue);

    expect(result.ok).toBe(true);

    if (result.ok) {expect(result.macros).toEqual({ carbsG: 0, fatG: 7.2, fiberG: 0, kcal: 330, proteinG: 62 });}
  });

  it('adds across several ingredients', () => {
    const result = composeMacros(
      [
        { grams: 100, slug: 'base' },
        { grams: 100, slug: 'pollo' }
      ],
      catalogue
    );

    expect(result.ok).toBe(true);

    if (result.ok) {expect(result.macros.kcal).toBe(365);}
  });

  it('reports unknown slugs instead of guessing or skipping them', () => {
    const result = composeMacros(
      [
        { grams: 100, slug: 'base' },
        { grams: 50, slug: 'unicornio' }
      ],
      catalogue
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {expect(result.unknownSlugs).toEqual(['unicornio']);}
  });

  it('deduplicates repeated unknown slugs', () => {
    const result = composeMacros(
      [
        { grams: 10, slug: 'x' },
        { grams: 10, slug: 'x' }
      ],
      catalogue
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {expect(result.unknownSlugs).toEqual(['x']);}
  });

  it('is zero for an empty ingredient list', () => {
    const result = composeMacros([], catalogue);

    expect(result.ok).toBe(true);

    if (result.ok) {expect(result.macros).toEqual(ZERO_MACROS);}
  });
});

describe('composePerServing', () => {
  it('divides a dish total by its serving count', () => {
    const dish = makeDish({ ingredients: [{ grams: 200, slug: 'base' }], servings: 2 });
    const result = composePerServing(dish, catalogue);

    expect(result.ok).toBe(true);

    // 200 g of a 200 kcal/100 g ingredient is 400 kcal for two servings.
    if (result.ok) {expect(result.macros.kcal).toBe(200);}
  });
});

describe('scaling', () => {
  it('scales macros linearly', () => {
    expect(scaleMacros({ carbsG: 10, fatG: 4, fiberG: 2, kcal: 100, proteinG: 8 }, 1.5)).toEqual({
      carbsG: 15,
      fatG: 6,
      fiberG: 3,
      kcal: 150,
      proteinG: 12
    });
  });

  it('scales ingredient grams and keeps one decimal', () => {
    expect(scaleIngredients([{ grams: 75, slug: 'base' }], 1.25)).toEqual([{ grams: 93.8, slug: 'base' }]);
  });

  it('sums a list of macros', () => {
    const one = { carbsG: 1, fatG: 1, fiberG: 1, kcal: 10, proteinG: 1 };

    expect(sumMacros([one, one, one]).kcal).toBe(30);
  });

  it('adds two macro sets', () => {
    expect(addMacros(ZERO_MACROS, { carbsG: 1, fatG: 2, fiberG: 3, kcal: 4, proteinG: 5 }).kcal).toBe(4);
  });
});
