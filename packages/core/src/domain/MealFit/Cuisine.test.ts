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

  it('reads a cooked grain dry, per serving, against 20 g (0079, threshold amended 2026-10-02)', () => {
    // 90 g cooked rice is 30 g dry, a side: rice. 57 g cooked is 19 g, a garnish.
    expect(dishGroups({ ingredients: [{ grams: 90, slug: 'arroz-blanco-cocido' }] })).toEqual(new Set(['rice']));
    expect(dishGroups({ ingredients: [{ grams: 57, slug: 'arroz-blanco-cocido' }] })).toEqual(new Set());
    // A pot for two of 40 g dry is 20 g each.
    expect(dishGroups({ ingredients: [{ grams: 40, slug: 'arroz-bomba-crudo' }], servings: 2 })).toEqual(new Set(['rice']));
    expect(dishGroups({ ingredients: [{ grams: 38, slug: 'arroz-bomba-crudo' }], servings: 2 })).toEqual(new Set());
  });

  it('counts gnocchi as pasta, read as stored', () => {
    expect(foodGroupOf('noquis')).toBe('pasta');
    expect(dishGroups({ ingredients: [{ grams: 70, slug: 'noquis' }] })).toEqual(new Set(['pasta']));
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
    ['italian', 'pasta', 'lunch', true],
    ['italian', 'pasta', 'dinner', false],
    ['italian', 'rice', 'dinner', false],
    ['italian', 'grains', 'dinner', true],
    ['italian', 'potato', 'dinner', true],
    ['asian', 'pasta', 'dinner', true],
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
    // 45 g cooked is 15 g dry, under the 20 g of a side.
    // A breakfast alone: one that also claimed lunch would lose it as a breakfast dish (017 phase 3).
    const breakfast = { ...dish(null, ['arroz-blanco-cocido', 45], ['merluza', 80]), slots: ['breakfast'] as MealSlot[] };

    expect(fitSlots(breakfast, catalogue, [])).toEqual(['breakfast']);
  });

  it('keeps an Italian pasta or risotto at lunch, as a Spanish one (0079, amended 2026-10-02)', () => {
    expect(fitSlots(dish('Italiana', ['arroz-blanco-cocido', 150], ['merluza', 120]), catalogue, [])).toEqual(['lunch']);
    expect(fitSlots(dish('Italiana', ['pasta-integral-seca', 80], ['tomate', 100]), catalogue, [])).toEqual(['lunch']);
    expect(fitSlots(dish('Italiana', ['quinoa-cocida', 150], ['merluza', 120]), catalogue, [])).toEqual(MAINS);
    expect(fitSlots(dish('China', ['arroz-blanco-cocido', 150], ['merluza', 120]), catalogue, [])).toEqual(MAINS);
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

describe('the dishes of a real fortnight that reached dinner (0079, threshold amended 2026-10-02)', () => {
  // Production plan v15: each was served at dinner while the threshold was 40 g
  // dry. The starch rows and grams are the recipes' own, one serving each.
  const catalogue = toCatalogue([]);
  const PRODUCTION: readonly { cuisine: string; group: FoodGroup; name: string; row: [string, number] }[] = [
    { cuisine: 'Italiana', group: 'pasta', name: 'Pasta Integral con Gambas, Coliflor y Mozzarella', row: ['pasta-integral-cocida', 80] },
    { cuisine: 'Mediterránea', group: 'grains', name: 'Lomo de Cerdo al Romero con Cuscús y Vegetales', row: ['cuscus-cocido', 70] },
    { cuisine: 'italiana', group: 'pasta', name: 'Ñoquis salteados con pechuga de pollo', row: ['noquis', 180] },
    { cuisine: 'Italiana', group: 'pasta', name: 'Noquis Salteados con Pollo, Berenjena y Mozzarella', row: ['noquis', 70] }
  ];

  it.each(PRODUCTION)('reads "$name" as $group', ({ group, row: [slug, grams] }) => {
    expect(dishGroups({ ingredients: [{ grams, slug }], servings: 1 })).toEqual(new Set([group]));
  });

  // Table 2 keeps Italian grains at dinner — a farro, a polenta — so the couscous is held to the Spanish family only.
  it.each(PRODUCTION)('keeps "$name" to lunch, as Spanish or Mediterranean, and as Italian if a pasta', ({ cuisine, group, row: [slug, grams] }) => {
    for (const value of [cuisine, 'Española', 'Mediterránea', ...(group === 'pasta' ? ['Italiana'] : [])]) {
      expect(fitSlots({ cuisine: value, ingredients: [{ grams, slug }], servings: 1, slots: ['lunch', 'dinner'] }, catalogue, [])).toEqual(['lunch']);
    }
  });
});
