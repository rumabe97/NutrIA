import { describe, expect, it } from 'vitest';

import { dishGroups } from 'core/domain/MealFit';
import { STARCH_RULES, starchBase, starchCap, starchCrowded, starchExcess, starchIndex, starchMeals } from 'core/domain/Variety';

import type { StarchMeal } from 'core/domain/Variety';

function dish(...items: [string, number][]) {
  return { ingredients: items.map(([slug, grams]) => ({ grams, slug })), servings: 1 };
}

describe('starchBase', () => {
  it('names a plate by its starch, read with 0079’s food groups', () => {
    expect(starchBase(dish(['espaguetis-secos', 80], ['tomate', 100]))).toBe('pasta');
    expect(starchBase(dish(['arroz-blanco-cocido', 150], ['merluza', 120]))).toBe('rice');
    expect(starchBase(dish(['cuscus-cocido', 150], ['pollo', 120]))).toBe('grains');
    expect(starchBase(dish(['boniato', 200], ['pollo', 120]))).toBe('potato');
    expect(starchBase(dish(['lentejas-cocidas', 200]))).toBe('legume');
    expect(starchBase(dish(['pan-integral', 60], ['tomate', 50]))).toBe('bread');
    expect(starchBase(dish(['pechuga-de-pollo', 150], ['brocoli', 200]))).toBeNull();
  });

  it('calls a dish pasta or rice exactly when meal fit does: the spoonful in a soup is neither', () => {
    // 50 g of cooked rice is about 17 g dry, under FOOD_GROUP_GRAMS' 20.
    const soup = dish(['arroz-blanco-cocido', 50], ['caldo-de-pollo', 300]);

    expect(dishGroups(soup).has('rice')).toBe(false);
    expect(starchBase(soup)).toBeNull();
    expect(starchBase(dish(['arroz-blanco-cocido', 150]))).toBe('rice');
  });

  it('names a plate of two groups by the first of pasta, rice, grains, legume, potato', () => {
    expect(starchBase(dish(['arroz-blanco-cocido', 150], ['garbanzos-cocidos', 100]))).toBe('rice');
    expect(starchBase(dish(['pasta-cocida', 200], ['alubias-blancas-cocidas', 100]))).toBe('pasta');
    expect(starchBase(dish(['lentejas-cocidas', 150], ['patata', 150]))).toBe('legume');
  });

  it('reads bread per serving, and never over another base', () => {
    expect(starchBase({ ingredients: [{ grams: 60, slug: 'pan-integral' }], servings: 2 })).toBeNull();
    expect(starchBase({ ingredients: [{ grams: 120, slug: 'pan-integral' }], servings: 2 })).toBe('bread');
    expect(starchBase(dish(['pan-rallado', 60], ['pollo', 120]))).toBeNull();
    expect(starchBase(dish(['patata', 200], ['pan-blanco', 60]))).toBe('potato');
  });
});

describe('the starch of a real fortnight (production plan v15)', () => {
  // Read as no starch at all while the threshold was 40 g dry: pasta six times
  // in fourteen days, two of them running, and the rule saw none.
  const pasta = dish(['pasta-integral-cocida', 80], ['gambas', 100]);
  const gnocchi = dish(['noquis', 70], ['pechuga-de-pollo', 100]);
  const couscous = dish(['cuscus-cocido', 70], ['lomo-de-cerdo', 120]);

  it('names each plate by its starch', () => {
    expect(starchBase(pasta)).toBe('pasta');
    expect(starchBase(dish(['noquis', 180], ['pechuga-de-pollo', 100]))).toBe('pasta');
    expect(starchBase(gnocchi)).toBe('pasta');
    expect(starchBase(couscous)).toBe('grains');
  });

  it('counts them against the cap and the days running', () => {
    const index = starchIndex([
      { ...pasta, slug: 'pasta-gambas' },
      { ...gnocchi, slug: 'noquis-pollo' }
    ]);
    const meals = starchMeals(
      [
        { dayIndex: 0, dishSlug: 'pasta-gambas', slot: 'dinner' },
        { dayIndex: 1, dishSlug: 'noquis-pollo', slot: 'dinner' }
      ],
      index
    );

    expect(meals).toEqual([
      { base: 'pasta', dayIndex: 0 },
      { base: 'pasta', dayIndex: 1 }
    ]);
    expect(starchExcess(meals, 14)).toBe(1);
    expect(starchCrowded('pasta', 2, meals, 14)).toBe(true);
  });
});

describe('STARCH_RULES — pasta and rice four times a fortnight, never on days running', () => {
  const pasta = (dayIndex: number): StarchMeal => ({ base: 'pasta', dayIndex });
  const rice = (dayIndex: number): StarchMeal => ({ base: 'rice', dayIndex });

  it('caps each at four in fourteen days, scaled for a shorter plan', () => {
    expect(STARCH_RULES.perFortnight).toBe(4);
    expect(starchCap(14)).toBe(4);
    expect(starchCap(7)).toBe(2);
    expect(starchCap(1)).toBe(1);
  });

  it('counts each meal past the cap', () => {
    expect(starchExcess([1, 3, 5, 7].map(pasta), 14)).toBe(0);
    expect(starchExcess([1, 3, 5, 7, 9].map(pasta), 14)).toBe(1);
    expect(starchExcess([1, 3, 5, 7, 9, 11].map(pasta), 14)).toBe(2);
    // Each base has a cap of its own.
    expect(starchExcess([...[1, 3, 5, 7].map(pasta), ...[2, 4, 6, 8].map(rice)], 14)).toBe(0);
  });

  it('counts the same base on two days running, or twice on one day', () => {
    expect(starchExcess([pasta(1), pasta(2)], 14)).toBe(1);
    expect(starchExcess([pasta(1), pasta(1)], 14)).toBe(1);
    expect(starchExcess([pasta(1), rice(2)], 14)).toBe(0);
  });

  it('never counts potato, a legume, a grain or bread', () => {
    const meals: StarchMeal[] = Array.from({ length: 14 }, (_none, day) => [
      { base: 'potato' as const, dayIndex: day + 1 },
      { base: 'legume' as const, dayIndex: day + 1 }
    ]).flat();

    expect(starchExcess(meals, 14)).toBe(0);
    expect(starchCrowded('potato', 2, meals, 14)).toBe(false);
  });

  it('crowds a pasta beside a pasta, or one past the cap', () => {
    expect(starchCrowded('pasta', 2, [pasta(1)], 14)).toBe(true);
    expect(starchCrowded('pasta', 2, [pasta(3)], 14)).toBe(true);
    expect(starchCrowded('pasta', 2, [pasta(2)], 14)).toBe(true);
    expect(starchCrowded('pasta', 3, [pasta(1)], 14)).toBe(false);
    expect(starchCrowded('rice', 2, [pasta(1)], 14)).toBe(false);
    expect(starchCrowded('pasta', 13, [1, 4, 7, 10].map(pasta), 14)).toBe(true);
    expect(starchCrowded('pasta', 13, [1, 4, 7].map(pasta), 14)).toBe(false);
  });

  it('reads a placement’s own base before the pool’s, and counts a dish outside both as nothing', () => {
    const index = starchIndex([
      { ingredients: [{ grams: 80, slug: 'espaguetis-secos' }], servings: 1, slug: 'espaguetis' },
      { ingredients: [{ grams: 200, slug: 'patata' }], servings: 1, slug: 'patatas' }
    ]);

    expect(
      starchMeals(
        [
          { dayIndex: 1, dishSlug: 'espaguetis', slot: 'lunch' },
          { dayIndex: 2, dishSlug: 'patatas', slot: 'lunch' },
          { dayIndex: 3, dishSlug: 'not-in-pool', slot: 'lunch' },
          { dayIndex: 4, dishSlug: 'not-in-pool', slot: 'lunch', starch: 'rice' },
          { dayIndex: 5, dishSlug: 'espaguetis', slot: 'lunch', starch: null }
        ],
        index
      )
    ).toEqual([
      { base: 'pasta', dayIndex: 1 },
      { base: 'rice', dayIndex: 4 }
    ]);
  });
});
