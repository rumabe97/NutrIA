import { describe, expect, it } from 'vitest';

import { DINNER_FORMS, isWholeGrain, legumeDryGrams } from 'core/domain/Balance';
import { fitSlots, mealCatalogue, rowFitsMeal } from 'core/domain/MealFit';
import { toCatalogue } from 'core/entities/Plan';
import { makeCatalogueIngredient } from '#test/fixtures';

import type { MealSlot } from 'core/entities/Plan';

import { INGREDIENT_SEED } from '../../../../database/src/seed/ingredients';
import { mealSlotsFor } from '../../../../database/src/seed/ingredients/meals';

/**
 * Prompt 4.7.1 asks a dinner for a legume or a whole grain only in the forms
 * `fitSlots` keeps at a dinner. The words of the ask are `DINNER_FORMS`; this
 * serves a dinner of each through the real `fitSlots` on the real seed's meal
 * lists, so the wording and the rule cannot drift apart: a form the lists or
 * Table 2 of `0079` start refusing fails here, not as `wrong_meal` in a plan.
 * The refused forms the ask names as lunch dishes are checked the same way.
 */
const catalogue = toCatalogue(
  INGREDIENT_SEED.map(row =>
    makeCatalogueIngredient({ id: `i-${row.slug}`, category: row.category, mealSlots: [...mealSlotsFor(row)], name: row.name, slug: row.slug })
  )
);

/** One dinner of a single row, 100 g a serving (80 g of the grains: a plate's dry weight is past Table 2's 20 g either way). */
function dinnerOf(
  slug: string,
  patterns: readonly string[] = [],
  cuisine: string | null = 'Mediterránea',
  extra: readonly string[] = ['salmon']
): readonly MealSlot[] {
  return fitSlots(
    { cuisine, ingredients: [{ grams: 100, slug }, ...extra.map(other => ({ grams: 120, slug: other }))], servings: 1, slots: ['dinner'] },
    catalogue,
    patterns
  );
}

describe('the forms a dinner is asked for (prompt 4.7.1)', () => {
  const legumes = Object.values(DINNER_FORMS.legume).flat();
  const grains = Object.values(DINNER_FORMS.wholeGrain).flat();

  it('only names rows the seed has, as the group the ask is for', () => {
    for (const slug of legumes) {
      expect(catalogue.has(slug), slug).toBe(true);
      expect(legumeDryGrams(slug, 1), slug).not.toBeNull();
    }

    for (const slug of grains) {
      expect(catalogue.has(slug), slug).toBe(true);
      expect(isWholeGrain(slug), slug).toBe(true);
    }
  });

  it.each([...legumes, ...grains])('keeps %s in a dinner for an omnivore', slug => {
    expect(rowFitsMeal(slug, 'dinner')).toBe(true);
    expect(dinnerOf(slug)).toEqual(['dinner']);
  });

  it('refuses the lunch dishes the ask names, to an omnivore at dinner, and keeps them for a vegan', () => {
    for (const slug of ['lentejas-cocidas', 'garbanzos-cocidos', 'alubias-blancas-cocidas']) {
      expect(dinnerOf(slug), slug).toEqual([]);
      expect(dinnerOf(slug, ['vegan'], 'Mediterránea', []), slug).toEqual(['dinner']);
    }

    // The 4.7.0 dinner that cost a chickpea hummus: the pulse, not the hummus, is the lunch dish.
    expect(dinnerOf('garbanzos-cocidos', [], 'Moderna', ['queso-feta', 'pan-integral'])).toEqual([]);
    expect(dinnerOf('hummus', [], 'Moderna', ['queso-feta', 'pan-integral'])).toEqual(['dinner']);
  });

  it('refuses the grains the ask rules out at dinner, brown or not, wherever the cuisine is unmapped or Spanish', () => {
    for (const slug of ['arroz-integral-crudo', 'arroz-integral-cocido', 'quinoa-cruda', 'pasta-integral-seca', 'trigo-sarraceno', 'bulgur-crudo']) {
      for (const cuisine of ['Mediterránea', 'Moderna', 'Española', null]) {
        expect(dinnerOf(slug, [], cuisine), `${slug} ${String(cuisine)}`).toEqual([]);
      }

      expect(rowFitsMeal(slug, 'dinner'), slug).toBe(false);
      expect(rowFitsMeal(slug, 'lunch'), slug).toBe(true);
    }
  });

  it('does not name oats, which the lists keep to breakfast and the snacks', () => {
    expect(isWholeGrain('copos-de-avena')).toBe(true);
    expect(dinnerOf('copos-de-avena')).toEqual([]);
    expect(grains).not.toContain('copos-de-avena');
    // And a dinner's request is never shown them, which is what `poolAsks` relies on when it reads the rows it is given.
    const shown = mealCatalogue([...catalogue.values()], 'dinner', [], null).map(row => row.slug);

    expect(shown).not.toContain('copos-de-avena');
    expect(shown).toEqual(expect.arrayContaining(grains));
  });

  it('leaves potato to the fish, because Table 2 keeps it at a Spanish dinner', () => {
    expect(rowFitsMeal('patata', 'dinner')).toBe(true);
    expect(dinnerOf('patata')).toEqual(['dinner']);
  });
});
