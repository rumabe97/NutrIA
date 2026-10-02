import { describe, expect, it } from 'vitest';

import { toCatalogue } from 'core/entities/Plan';
import { makeCatalogueIngredient } from '#test/fixtures';

import { cuisineFamily, dishGroups, FOOD_GROUP_SLUGS, foodGroupOf, groupFits } from './Cuisine';
import { fitSlots } from './MealFit';

import type { CuisineFamily, FoodGroup } from './Cuisine';
import type { MealSlot } from 'core/entities/Plan';

describe('cuisineFamily — Table 1 of 0079', () => {
  // Every value Table 1 lists, so a value that moves family is a failing test, and a new one costs a line.
  const TABLE_1: Readonly<Record<CuisineFamily, readonly string[]>> = {
    arab: ['Marroquí', 'moroccan', 'Magrebí', 'Árabe', 'Libanesa', 'Oriente Medio', 'levantina', 'Turca'],
    asian: ['Asiática', 'asian', 'Oriental', 'China', 'Japonesa', 'Coreana', 'Tailandesa', 'Vietnamita', 'India', 'indio', 'indian', 'Hawaiana'],
    italian: ['Italiana', 'italian'],
    latin: ['Mexicana', 'mexican', 'Latina', 'Peruana', 'Venezolana', 'Colombiana', 'Argentina', 'Cubana', 'Caribeña'],
    other: [
      'Internacional',
      'Fusión',
      'moderna',
      'sana',
      'continental',
      'europea',
      'centroeuropea',
      'Francesa',
      'Americana',
      'estadounidense',
      'Nórdica',
      'escandinava',
      'tropical',
      'klingon'
    ],
    spanish: [
      'Mediterránea',
      'mediterranean',
      'Española',
      'spanish',
      'España',
      'Mediterránea (España)',
      'Mediterránea, España, Italia',
      'Griega',
      'greek',
      'Tapa',
      'Vasca',
      'Riojana',
      'Gallega',
      'Madrileña',
      'Valenciana',
      'Catalana',
      'Asturiana',
      'Aragonesa',
      'Manchega',
      'Andaluza',
      'Castellana',
      'Extremeña',
      'Canaria',
      'Murciana',
      'Navarra',
      'Cántabra',
      'Leonesa'
    ]
  };

  it.each(Object.entries(TABLE_1).flatMap(([family, values]) => values.map(value => [value, family] as const)))(
    'reads "%s" as %s',
    (value, family) => {
      expect(cuisineFamily(value)).toBe(family);
    }
  );

  it('judges no cuisine as other, which takes the Spanish table', () => {
    expect(cuisineFamily(null)).toBe('other');
    expect(cuisineFamily(undefined)).toBe('other');
    expect(cuisineFamily('')).toBe('other');
  });
});

describe('the food groups of Table 2', () => {
  it('keeps the rows Table 2 says are not rice out of rice', () => {
    for (const slug of [
      'tortitas-de-arroz',
      'arroz-con-leche',
      'arroz-hinchado',
      'harina-de-arroz',
      'bebida-de-arroz',
      'papel-de-arroz',
      'quinoa-hinchada',
      'pasta-de-curry-rojo'
    ]) {
      expect(foodGroupOf(slug)).toBeNull();
    }
  });

  it('places each row in one group at most', () => {
    const all = Object.values(FOOD_GROUP_SLUGS).flatMap(slugs => [...slugs]);

    expect(new Set(all).size).toBe(all.length);
    expect(FOOD_GROUP_SLUGS.pulses.size).toBe(23);
  });

  it('reads a cooked grain dry, per serving, against 40 g', () => {
    // 150 g cooked rice is 50 g dry; 90 g cooked is 30 g, a garnish.
    expect(dishGroups({ ingredients: [{ grams: 150, slug: 'arroz-blanco-cocido' }] })).toEqual(new Set(['rice']));
    expect(dishGroups({ ingredients: [{ grams: 90, slug: 'arroz-blanco-cocido' }] })).toEqual(new Set());
    // A pot for two of 80 g dry is 40 g each.
    expect(dishGroups({ ingredients: [{ grams: 80, slug: 'arroz-bomba-crudo' }], servings: 2 })).toEqual(new Set(['rice']));
    expect(dishGroups({ ingredients: [{ grams: 78, slug: 'arroz-bomba-crudo' }], servings: 2 })).toEqual(new Set());
  });

  it('needs 100 g of potato, and any amount of a stewed pulse', () => {
    expect(dishGroups({ ingredients: [{ grams: 99, slug: 'patata' }] })).toEqual(new Set());
    expect(dishGroups({ ingredients: [{ grams: 100, slug: 'patata' }] })).toEqual(new Set(['potato']));
    expect(dishGroups({ ingredients: [{ grams: 10, slug: 'lentejas-cocidas' }] })).toEqual(new Set(['pulses']));
  });

  it('counts a group row without grams as the group — it can only narrow for not knowing', () => {
    expect(dishGroups({ ingredients: [{ slug: 'arroz-blanco-cocido' }] })).toEqual(new Set(['rice']));
  });
});

describe('groupFits — the grid of Table 2', () => {
  const cases: readonly [CuisineFamily, FoodGroup, MealSlot, boolean][] = [
    ['spanish', 'rice', 'lunch', true],
    ['spanish', 'rice', 'dinner', false],
    ['spanish', 'pasta', 'dinner', false],
    ['spanish', 'grains', 'dinner', false],
    ['spanish', 'potato', 'dinner', true],
    ['spanish', 'potato', 'breakfast', false],
    ['spanish', 'potato', 'morning_snack', true],
    ['spanish', 'pulses', 'dinner', false],
    ['other', 'rice', 'dinner', false],
    ['italian', 'pasta', 'dinner', true],
    ['italian', 'pulses', 'dinner', true],
    ['asian', 'rice', 'dinner', true],
    ['asian', 'rice', 'afternoon_snack', true],
    ['asian', 'rice', 'breakfast', false],
    ['latin', 'pasta', 'dinner', false],
    ['latin', 'pulses', 'breakfast', true],
    ['arab', 'grains', 'dinner', false],
    ['arab', 'potato', 'dinner', true]
  ];

  it.each(cases)('%s %s at %s: %s', (family, group, slot, fits) => {
    expect(groupFits(family, group, slot)).toBe(fits);
  });

  it('puts no group at supper', () => {
    for (const family of ['arab', 'asian', 'italian', 'latin', 'spanish'] as const) {
      for (const group of Object.keys(FOOD_GROUP_SLUGS) as FoodGroup[]) {
        expect(groupFits(family, group, 'supper')).toBe(false);
      }
    }
  });
});

describe('fitSlots by cuisine (0079, option B)', () => {
  // As the seed lists them: cooking rice lunch and dinner, lentils lunch only, potato and fish at any meal.
  const rice = makeCatalogueIngredient({ id: 'i-arroz', category: 'pantry', mealSlots: ['lunch', 'dinner'], slug: 'arroz-blanco-cocido' });
  const lentils = makeCatalogueIngredient({ id: 'i-lentejas', category: 'protein', classes: [], mealSlots: ['lunch'], slug: 'lentejas-cocidas' });
  const fish = makeCatalogueIngredient({ id: 'i-merluza', category: 'protein', classes: ['animal', 'fish'], mealSlots: [], slug: 'merluza' });
  const none = makeCatalogueIngredient({ id: 'i-none', category: 'pantry', mealSlots: ['none'], slug: 'polenta' });
  const catalogue = toCatalogue([rice, lentils, fish, none]);
  const MAINS: MealSlot[] = ['lunch', 'dinner'];

  const dish = (cuisine: string | null, ...items: [string, number][]) => ({
    cuisine,
    ingredients: items.map(([slug, grams]) => ({ grams, slug })),
    servings: 1,
    slots: MAINS
  });

  it('takes dinner from a Spanish rice dish and keeps it for an Asian one', () => {
    expect(fitSlots(dish('Mediterránea', ['arroz-blanco-cocido', 150], ['merluza', 120]), catalogue, [])).toEqual(['lunch']);
    expect(fitSlots(dish(null, ['arroz-blanco-cocido', 150], ['merluza', 120]), catalogue, [])).toEqual(['lunch']);
    expect(fitSlots(dish('Japonesa', ['arroz-blanco-cocido', 150], ['merluza', 120]), catalogue, [])).toEqual(MAINS);
  });

  it('leaves a garnish of rice where the list would not, because the table decides its rows', () => {
    const breakfast = { ...dish(null, ['arroz-blanco-cocido', 60], ['merluza', 80]), slots: ['breakfast', 'lunch'] as MealSlot[] };

    expect(fitSlots(breakfast, catalogue, [])).toEqual(['breakfast', 'lunch']);
  });

  it('widens an Italian lentil stew to dinner over the pulses list', () => {
    expect(fitSlots(dish('Italiana', ['lentejas-cocidas', 120]), catalogue, [])).toEqual(MAINS);
    expect(fitSlots(dish('Española', ['lentejas-cocidas', 120]), catalogue, [])).toEqual(['lunch']);
  });

  it('keeps a vegan Spanish lentil dinner (0062 § 4 over the pulse cell)', () => {
    expect(fitSlots(dish('Española', ['lentejas-cocidas', 120]), catalogue, ['vegan'])).toEqual(MAINS);
  });

  it('never brings back a row in no meal', () => {
    expect(fitSlots(dish('Italiana', ['polenta', 10], ['merluza', 100]), catalogue, [])).toEqual([]);
  });
});
