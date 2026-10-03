import { describe, expect, it } from 'vitest';

import { PLATE_FOOD_MAX, PLATE_FOOD_SCALE, plateFood, plateFoodMax, plateFoods } from 'core/domain/PlateFood';
import { makeCatalogue, makeCatalogueIngredient } from '#test/fixtures';

describe('PLATE_FOOD_MAX', () => {
  it('holds the ceilings of 0008 § D', () => {
    // Written out, so this fails if a ceiling is loosened, not only if it is ignored.
    expect(PLATE_FOOD_MAX).toEqual({ fish: 300, grain: 160, legume: 400, meat: 250, potato: 400 });
    expect(PLATE_FOOD_SCALE).toEqual({ fromKcal: 1100 });
  });
});

describe('plateFood', () => {
  it('reads a cooked grain dry, by its yield', () => {
    expect(plateFood('arroz-blanco-cocido', 480, undefined)).toEqual({ food: 'grain', grams: 160 });
    expect(plateFood('pasta-cocida', 230, undefined)?.grams).toBeCloseTo(100, 6);
  });

  it('knows a legume by its slug and potato by the list', () => {
    expect(plateFood('garbanzos-cocidos', 300, undefined)).toEqual({ food: 'legume', grams: 300 });
    expect(plateFood('boniato', 200, undefined)?.food).toBe('potato');
    expect(plateFood('patatas-gajo-congeladas', 200, undefined)?.food).toBe('potato');
    expect(plateFood('harina-de-patata', 200, undefined)).toBeNull();
  });

  it('knows meat and fish by their classes', () => {
    expect(plateFood('lomo', 100, makeCatalogueIngredient({ classes: ['pork'], slug: 'lomo' }))?.food).toBe('meat');
    expect(plateFood('pollo', 100, makeCatalogueIngredient({ classes: ['meat'], slug: 'pollo' }))?.food).toBe('meat');
    expect(plateFood('gamba', 100, makeCatalogueIngredient({ classes: ['shellfish'], slug: 'gamba' }))?.food).toBe('fish');
    expect(plateFood('merluza', 100, makeCatalogueIngredient({ classes: ['fish'], slug: 'merluza' }))?.food).toBe('fish');
    expect(plateFood('queso', 100, makeCatalogueIngredient({ classes: ['dairy'], slug: 'queso' }))).toBeNull();
    expect(plateFood('desconocido', 100, undefined)).toBeNull();
  });
});

describe('plateFoods', () => {
  it('sums every ingredient of one food, and leaves out what it holds none of', () => {
    const catalogue = makeCatalogue([
      makeCatalogueIngredient({ id: 'a', classes: ['pork'], slug: 'chorizo' }),
      makeCatalogueIngredient({ id: 'b', classes: ['meat'], slug: 'ternera' })
    ]);

    expect(
      plateFoods(
        [
          { grams: 80, slug: 'chorizo' },
          { grams: 200, slug: 'ternera' },
          { grams: 300, slug: 'patata' }
        ],
        catalogue
      )
    ).toEqual({ meat: 280, potato: 300 });
  });
});

describe('plateFoodMax', () => {
  it('keeps the ceiling up to 1,100 kcal of share', () => {
    expect(plateFoodMax('potato', 'lunch', 900)).toBe(400);
    expect(plateFoodMax('potato', 'lunch', 1100)).toBe(400);
  });

  it('scales a meal past 1,100 kcal by share ÷ 1,100', () => {
    expect(plateFoodMax('meat', 'lunch', 2200)).toBe(500);
    expect(plateFoodMax('potato', 'dinner', 1320)).toBeCloseTo(480, 6);
    expect(plateFoodMax('grain', 'breakfast', 1650)).toBeCloseTo(240, 6);
  });

  it('never scales a snack or supper', () => {
    for (const slot of ['morning_snack', 'afternoon_snack', 'supper'] as const) {
      expect(plateFoodMax('fish', slot, 2200)).toBe(300);
    }
  });
});
