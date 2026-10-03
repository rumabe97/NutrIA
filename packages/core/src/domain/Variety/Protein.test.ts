import { describe, expect, it } from 'vitest';

import { mainProtein, planWeek, PROTEIN_RULES, proteinCap, proteinKind } from 'core/domain/Variety';
import { makeCatalogue, makeCatalogueIngredient, makeDish } from '#test/fixtures';

const catalogue = makeCatalogue([
  makeCatalogueIngredient({ id: 'i-atun', category: 'protein', proteinPer100g: 24, slug: 'atun-al-natural' }),
  makeCatalogueIngredient({ id: 'i-ventresca', category: 'protein', proteinPer100g: 22, slug: 'ventresca-de-atun' }),
  makeCatalogueIngredient({ id: 'i-pavo', category: 'protein', proteinPer100g: 22, slug: 'pechuga-de-pavo' }),
  makeCatalogueIngredient({ id: 'i-clara', category: 'protein', proteinPer100g: 11, slug: 'clara-de-huevo' }),
  makeCatalogueIngredient({ id: 'i-huevo', category: 'protein', proteinPer100g: 13, slug: 'huevo' }),
  makeCatalogueIngredient({ id: 'i-pan', category: 'bakery', proteinPer100g: 9, slug: 'pan-integral' }),
  makeCatalogueIngredient({ id: 'i-skyr', category: 'dairy', proteinPer100g: 11, slug: 'skyr' }),
  makeCatalogueIngredient({ id: 'i-lomo', category: 'protein', classes: ['animal', 'meat', 'pork'], proteinPer100g: 22, slug: 'lomo-de-cerdo' }),
  makeCatalogueIngredient({ id: 'i-jamon', category: 'protein', classes: ['animal', 'meat', 'pork'], proteinPer100g: 30, slug: 'jamon-serrano' }),
  makeCatalogueIngredient({ id: 'i-chorizo', category: 'protein', classes: ['animal', 'meat', 'pork'], proteinPer100g: 24, slug: 'chorizo' }),
  makeCatalogueIngredient({ id: 'i-codorniz', category: 'protein', classes: ['animal', 'egg'], proteinPer100g: 13, slug: 'huevo-de-codorniz' })
]);

describe('mainProtein', () => {
  it('names a dish by the kind of its main protein, not by its cut or its tin', () => {
    expect(
      mainProtein(
        makeDish({
          ingredients: [
            { grams: 80, slug: 'atun-al-natural' },
            { grams: 60, slug: 'pan-integral' }
          ]
        }),
        catalogue
      )
    ).toBe('atun');
    expect(mainProtein(makeDish({ ingredients: [{ grams: 120, slug: 'ventresca-de-atun' }] }), catalogue)).toBe('atun');
    expect(mainProtein(makeDish({ ingredients: [{ grams: 150, slug: 'pechuga-de-pavo' }] }), catalogue)).toBe('pavo');
  });

  it('counts eggs and egg whites as one', () => {
    expect(mainProtein(makeDish({ ingredients: [{ grams: 150, slug: 'clara-de-huevo' }] }), catalogue)).toBe('huevo');
    expect(mainProtein(makeDish({ ingredients: [{ grams: 120, slug: 'huevo' }] }), catalogue)).toBe('huevo');
  });

  it('counts every cut and cure of pork as one protein (017 phase 2: pork in eight of twenty-eight mains)', () => {
    for (const slug of ['lomo-de-cerdo', 'jamon-serrano', 'chorizo']) {
      expect(mainProtein(makeDish({ ingredients: [{ grams: 120, slug }] }), catalogue)).toBe('cerdo');
    }

    expect(proteinKind('jamon-serrano', catalogue)).toBe('cerdo');
  });

  it('reads a quail egg as an egg, not as the bird', () => {
    expect(mainProtein(makeDish({ ingredients: [{ grams: 100, slug: 'huevo-de-codorniz' }] }), catalogue)).toBe('huevo');
  });

  it('takes the ingredient that carries the most protein, not the heaviest one', () => {
    // 200 g of egg is 26 g of protein; 120 g of tuna is 28.8 g.
    expect(
      mainProtein(
        makeDish({
          ingredients: [
            { grams: 200, slug: 'huevo' },
            { grams: 120, slug: 'atun-al-natural' }
          ]
        }),
        catalogue
      )
    ).toBe('atun');
  });

  it('leaves dairy and bread out of it', () => {
    expect(
      mainProtein(
        makeDish({
          ingredients: [
            { grams: 250, slug: 'skyr' },
            { grams: 80, slug: 'pan-integral' }
          ]
        }),
        catalogue
      )
    ).toBeNull();
  });
});

describe('proteinCap', () => {
  /** The numbers, pinned: loosening them is the change worth noticing. */
  it('is once a day and one meal in ten, never under two a plan', () => {
    expect(PROTEIN_RULES).toEqual({ mealsPerAppearance: 10, perDay: 1, perMainsWeek: 3, perSlot: 3 });
    expect(proteinCap(56)).toBe(6);
    expect(proteinCap(42)).toBe(5);
    expect(proteinCap(14)).toBe(2);
  });
});

describe('planWeek', () => {
  it('splits the fortnight into its two weeks, days 1–7 and 8–14', () => {
    expect([1, 7, 8, 14].map(planWeek)).toEqual([0, 0, 1, 1]);
  });
});
