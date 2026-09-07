import { describe, expect, it } from 'vitest';

import { ALLERGEN_SEED } from './allergens';
import { INGREDIENT_SEED } from './ingredients';

const ALLERGEN_KEYS = new Set(ALLERGEN_SEED.map(a => a.key));

/** Wide enough to clear the honest table-vs-model spread, tight enough to catch a decimal slip. */
const RATIO_BAND = { max: 1.6, min: 0.6 } as const;

/** Below this the ratio is noise — a 5 kcal herb swings wildly on a rounding difference. */
const ESTIMATE_FLOOR_KCAL = 15;

describe('INGREDIENT_SEED', () => {
  it('references only allergen keys that exist in ALLERGEN_SEED', () => {
    for (const ingredient of INGREDIENT_SEED) {
      for (const link of ingredient.allergens ?? []) {
        expect(ALLERGEN_KEYS.has(link.key), `"${ingredient.slug}" references unknown allergen key "${link.key}"`).toBe(true);
      }
    }
  });

  it('has no duplicate slugs', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const ingredient of INGREDIENT_SEED) {
      if (seen.has(ingredient.slug)) {
        duplicates.push(ingredient.slug);
      }

      seen.add(ingredient.slug);
    }

    expect(duplicates).toEqual([]);
  });

  it('has only non-negative macros', () => {
    for (const ingredient of INGREDIENT_SEED) {
      expect(ingredient.carbs, `"${ingredient.slug}" carbs`).toBeGreaterThanOrEqual(0);
      expect(ingredient.fat, `"${ingredient.slug}" fat`).toBeGreaterThanOrEqual(0);
      expect(ingredient.kcal, `"${ingredient.slug}" kcal`).toBeGreaterThanOrEqual(0);
      expect(ingredient.protein, `"${ingredient.slug}" protein`).toBeGreaterThanOrEqual(0);

      if (ingredient.fiber !== undefined) {
        expect(ingredient.fiber, `"${ingredient.slug}" fiber`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // A sanity band, not a physics check.
  //
  // Its job is to catch transcription errors — a misplaced decimal, a figure
  // copied from the wrong row — which are off by 2x or 10x, not by 30%. Real
  // composition tables disagree with an Atwater estimate by considerably more
  // than 30% for legitimate reasons: they differ on whether carbohydrate is
  // reported total or available, fibre is only partly metabolised, and spices and
  // some vegetables sit well outside the model. Measured across this catalogue
  // the honest spread is [0.84, 1.43].
  //
  // A tighter band would not find more typos; it would push the data away from
  // its sources to satisfy the formula, which is the opposite of the point.
  // Entries below the floor are skipped: for a 5 kcal herb the ratio is noise.
  it('has a kcal in a sane ratio to its macros for every entry', () => {
    for (const ingredient of INGREDIENT_SEED) {
      const fiber = ingredient.fiber ?? 0;
      const availableCarbs = Math.max(ingredient.carbs - fiber, 0);
      const estimate = 4 * ingredient.protein + 4 * availableCarbs + 9 * ingredient.fat + 2 * fiber;

      if (estimate < ESTIMATE_FLOOR_KCAL) {continue;}

      const ratio = ingredient.kcal / estimate;

      expect(
        ratio,
        `"${ingredient.slug}" kcal=${ingredient.kcal} against a macro estimate of ${estimate.toFixed(1)} (ratio ${ratio.toFixed(2)}) — check for a transcription error`
      ).toBeGreaterThanOrEqual(RATIO_BAND.min);
      expect(ratio, `"${ingredient.slug}" kcal=${ingredient.kcal} against a macro estimate of ${estimate.toFixed(1)} (ratio ${ratio.toFixed(2)})`).toBeLessThanOrEqual(
        RATIO_BAND.max
      );
    }
  });
});
