import { describe, expect, it } from 'vitest';

import { composePerServing } from 'core/domain/Composition';
import { isOversized, servingCap } from 'core/domain/Serving';
import { makeCatalogue, makeCatalogueIngredient } from '#test/fixtures';

import { failsCheck, qualityFlags } from './CatalogueQuality';

import type { QualityRecipe } from './CatalogueQuality';

const STEPS = '2.8.0';
// 200 kcal per 100 g, so grams / 50 is the kcal per serving divided by 100.
const CATALOGUE = makeCatalogue([
  makeCatalogueIngredient({ slug: 'base' }),
  makeCatalogueIngredient({ id: 'ing-night', mealSlots: ['dinner'], slug: 'cena' }),
  makeCatalogueIngredient({ id: 'ing-none', mealSlots: ['none'], slug: 'nada' })
]);

function recipe(overrides: Partial<QualityRecipe>): QualityRecipe {
  return { items: [{ grams: 100, slug: 'base' }], mealSlots: ['lunch'], servings: 1, stepsVersion: STEPS, ...overrides };
}

function flags(overrides: Partial<QualityRecipe>) {
  return qualityFlags(recipe(overrides), CATALOGUE, STEPS);
}

describe('qualityFlags', () => {
  it('flags nothing on an ordinary dish', () => {
    expect(flags({})).toEqual({ overBound: false, overCap: false, refusalLimit: false, uncosted: false, unserved: false });
  });

  it('judges the bound and the cap with the app’s own helpers, at the value they draw the line', () => {
    const lunchCap = servingCap(['lunch']);
    // 900 kcal cap → 450 g; 1.5 × 900 = 1350 kcal → 675 g.
    const atCap = recipe({ items: [{ grams: (lunchCap / 200) * 100, slug: 'base' }] });
    const overCap = recipe({ items: [{ grams: (lunchCap / 200) * 100 + 10, slug: 'base' }] });
    const overBound = recipe({ items: [{ grams: 700, slug: 'base' }] });

    expect(qualityFlags(atCap, CATALOGUE, STEPS).overCap).toBe(false);
    expect(qualityFlags(overCap, CATALOGUE, STEPS)).toMatchObject({ overBound: false, overCap: true });
    expect(qualityFlags(overBound, CATALOGUE, STEPS)).toMatchObject({ overBound: true, overCap: false });

    for (const candidate of [atCap, overCap, overBound]) {
      const dish = { ingredients: [...candidate.items], servings: candidate.servings, slots: ['lunch' as const] };

      expect(qualityFlags(candidate, CATALOGUE, STEPS).overBound).toBe(isOversized(dish, CATALOGUE));
      expect(composePerServing(dish, CATALOGUE).ok).toBe(true);
    }
  });

  it('measures a serving, not the pot: more servings of the same pot is a smaller plate', () => {
    expect(flags({ items: [{ grams: 700, slug: 'base' }], servings: 2 })).toMatchObject({ overBound: false, overCap: false });
  });

  it('takes the largest cap of the meals a dish is stored for', () => {
    // 420 kcal is over a snack's 400 but under a lunch's 900.
    const items = [{ grams: 210, slug: 'base' }];

    expect(flags({ items, mealSlots: ['afternoon_snack'] }).overCap).toBe(true);
    expect(flags({ items, mealSlots: ['afternoon_snack', 'lunch'] }).overCap).toBe(false);
  });

  it('is uncosted for an unknown ingredient and for no servings, and never judges the cap of what it cannot cost', () => {
    expect(flags({ items: [{ grams: 100, slug: 'inventado' }] })).toMatchObject({ overBound: false, overCap: false, uncosted: true });
    expect(flags({ servings: 0 }).uncosted).toBe(true);
  });

  it('has nothing to be over when it names no meal, and is never served', () => {
    expect(flags({ items: [{ grams: 5000, slug: 'base' }], mealSlots: [] })).toMatchObject({ overBound: false, overCap: false, unserved: true });
    expect(flags({ mealSlots: ['brunch'] }).unserved).toBe(true);
  });

  it('is unserved only when no meal it names fits every ingredient', () => {
    expect(flags({ items: [{ grams: 100, slug: 'cena' }], mealSlots: ['lunch'] }).unserved).toBe(true);
    expect(flags({ items: [{ grams: 100, slug: 'cena' }], mealSlots: ['lunch', 'dinner'] }).unserved).toBe(false);
    // A row the owner put in no meal is in no meal for anybody.
    expect(flags({ items: [{ grams: 100, slug: 'nada' }] }).unserved).toBe(true);
  });

  it('counts the sweep’s refusals against the current steps version only', () => {
    expect(flags({ stepsVersion: '2.8.0+3' }).refusalLimit).toBe(true);
    expect(flags({ stepsVersion: '2.8.0+2' }).refusalLimit).toBe(false);
    expect(flags({ stepsVersion: '2.7.0+3' }).refusalLimit).toBe(false);
    expect(flags({ stepsVersion: null }).refusalLimit).toBe(false);
  });
});

describe('failsCheck', () => {
  it('reads the flag each check names', () => {
    const all = { overBound: true, overCap: true, refusalLimit: true, uncosted: true, unserved: true };
    const none = { overBound: false, overCap: false, refusalLimit: false, uncosted: false, unserved: false };

    for (const check of ['over_bound', 'over_cap', 'refusal_limit', 'uncosted', 'unserved'] as const) {
      expect(failsCheck(all, check)).toBe(true);
      expect(failsCheck(none, check)).toBe(false);
    }

    expect(failsCheck({ ...none, overBound: true }, 'over_cap')).toBe(false);
    expect(failsCheck({ ...none, overBound: true }, 'over_bound')).toBe(true);
  });
});
