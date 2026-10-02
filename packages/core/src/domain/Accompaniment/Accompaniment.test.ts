import { describe, expect, it } from 'vitest';

import { toCatalogue } from 'core/entities/Plan';
import { NO_PREFERENCE_EXCLUSIONS, PATTERN_EXCLUDED_SLUGS, resolvePreferences } from 'core/domain/Preference';
import { dishSafety, toSafetyProfile } from 'core/domain/Safety';
import { makeAccompanimentRows, makeCatalogueIngredient } from '#test/fixtures';

import {
  accompanimentName,
  accompanimentPreparation,
  accompanimentRows,
  ACCOMPANIMENTS,
  isComposed,
  larderFor,
  NO_ACCOMPANIMENT,
  portionsBeside,
  setsBeside,
  setsOf
} from './Accompaniment';

import type { AccompanimentDiner, AccompanimentPortion } from './Accompaniment';
import type { CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { SafetyProfile } from 'core/entities/Safety';

const SLUGS = [...new Set(ACCOMPANIMENTS.flatMap(entry => entry.portions.flat().map(item => item.slug)))];

const MILK = 'a-milk';
const NUTS = 'a-nuts';
const GLUTEN = 'a-gluten';
const SESAME = 'a-sesame';
const SOY = 'a-soy';

function contains(allergenId: string) {
  return { allergenId, presence: 'contains' as const };
}

function traces(allergenId: string) {
  return { allergenId, presence: 'may_contain' as const };
}

/** The links the real catalogue carries for these rows, as far as these tests need them. */
const ALLERGENS: Readonly<Record<string, Partial<CatalogueIngredient>>> = {
  almendras: { allergens: [contains(NUTS)] },
  hummus: { allergens: [contains(SESAME)] },
  miso: { allergens: [contains(SOY), traces(GLUTEN)] },
  // Fruit by its own months, as `seasons.ts` gives them.
  naranja: { seasonMonths: [1, 2, 3, 4, 5, 11, 12] },
  nueces: { allergens: [contains(NUTS)] },
  'pan-blanco': { allergens: [contains(GLUTEN)] },
  'pan-de-centeno': { allergens: [contains(GLUTEN)] },
  'pan-de-masa-madre': { allergens: [contains(GLUTEN)] },
  'pan-de-pita': { allergens: [contains(GLUTEN)] },
  // A seeded loaf's warning, on a plain bread, to prove the gate reads traces beside a plate as on it.
  'pan-integral': { allergens: [contains(GLUTEN), traces(SESAME)] },
  'queso-de-burgos': { allergens: [contains(MILK)] },
  requeson: { allergens: [contains(MILK)] },
  'salsa-de-soja-baja-en-sal': { allergens: [contains(SOY), contains(GLUTEN)] },
  sandia: { seasonMonths: [6, 7, 8, 9] },
  sesamo: { allergens: [contains(SESAME)] },
  'tofu-sedoso': { allergens: [contains(SOY)] },
  'yogur-griego-natural': { allergens: [contains(MILK)] },
  'yogur-natural-desnatado': { allergens: [contains(MILK)] }
};

const rows = makeAccompanimentRows(SLUGS, ALLERGENS);
const catalogue = toCatalogue(rows);
const NOBODY: SafetyProfile = toSafetyProfile([], []);

function diner(safety: SafetyProfile = NOBODY, preferences: AccompanimentDiner['preferences'] = NO_PREFERENCE_EXCLUSIONS): AccompanimentDiner {
  return { catalogue, preferences, safety };
}

function keysOf(portions: readonly AccompanimentPortion[]): Set<string> {
  return new Set(portions.map(portion => portion.accompaniment.key));
}

const SPANISH_STEW = { cuisine: 'Española', ingredients: [{ grams: 150, slug: 'merluza' }], servings: 1 };
const OCTOBER = 10;

describe('Table 3, as written', () => {
  it('uses only rows the catalogue holds, and never the seeded bread', () => {
    expect(SLUGS).not.toContain('pan-de-semillas');
    expect(larderFor(diner()).portions.length).toBe(ACCOMPANIMENTS.flatMap(entry => entry.portions).length);
  });

  it('prices each portion from the catalogue, to a tenth', () => {
    const bread = larderFor(diner()).portions.find(portion => portion.accompaniment.key === 'pan-blanco' && portion.grams === 60);

    expect(bread?.macros.kcal).toBe(159);
  });

  it('leaves a portion whose row the catalogue does not know', () => {
    const without = toCatalogue(rows.filter(row => row.slug !== 'canonigos'));

    expect(keysOf(larderFor({ ...diner(), catalogue: without }).portions).has('ensalada-de-invierno')).toBe(false);
  });
});

describe('larderFor — what one person may ever be offered (0079 § 3d)', () => {
  it('keeps yoghurt and cheese from somebody allergic to milk', () => {
    const keys = keysOf(larderFor(diner(toSafetyProfile([{ allergenId: MILK, crossContaminationSensitive: false }], []))).portions);

    for (const key of ['yogur-natural-desnatado', 'yogur-griego-natural', 'queso-de-burgos', 'requeson']) {
      expect(keys.has(key)).toBe(false);
    }

    expect(keys.has('naranja')).toBe(true);
  });

  it('keeps walnuts and almonds from somebody allergic to tree nuts', () => {
    const keys = keysOf(larderFor(diner(toSafetyProfile([], [{ allergenId: NUTS }]))).portions);

    expect(keys.has('nueces')).toBe(false);
    expect(keys.has('almendras')).toBe(false);
  });

  it('keeps every wheat bread, pita and the soy-sauce greens from a coeliac, and the miso only from one sensitive to traces', () => {
    const coeliac = keysOf(larderFor(diner(toSafetyProfile([{ allergenId: GLUTEN, crossContaminationSensitive: false }], []))).portions);
    const sensitive = keysOf(larderFor(diner(toSafetyProfile([{ allergenId: GLUTEN, crossContaminationSensitive: true }], []))).portions);

    for (const key of ['pan-blanco', 'pan-integral', 'pan-de-centeno', 'pan-de-masa-madre', 'pan-de-pita', 'pak-choi-salteado']) {
      expect(coeliac.has(key)).toBe(false);
    }

    expect(coeliac.has('pan-sin-gluten')).toBe(true);
    expect(coeliac.has('sopa-de-miso')).toBe(true);
    expect(sensitive.has('sopa-de-miso')).toBe(false);
  });

  it('keeps hummus and the cucumber salad from a sesame allergy, and the seeded bread from whoever minds its traces', () => {
    const allergic = keysOf(larderFor(diner(toSafetyProfile([{ allergenId: SESAME, crossContaminationSensitive: false }], []))).portions);
    const sensitive = keysOf(larderFor(diner(toSafetyProfile([{ allergenId: SESAME, crossContaminationSensitive: true }], []))).portions);

    expect(allergic.has('hummus')).toBe(false);
    expect(allergic.has('ensalada-de-pepino')).toBe(false);
    expect(allergic.has('pan-integral')).toBe(true);
    expect(sensitive.has('pan-integral')).toBe(false);
  });

  it('offers nothing a gate would refuse beside a plate', () => {
    const safety = toSafetyProfile(
      [MILK, NUTS, GLUTEN, SESAME, SOY].map(allergenId => ({ allergenId, crossContaminationSensitive: true })),
      []
    );

    for (const portion of larderFor(diner(safety)).portions) {
      expect(dishSafety(portion.items, catalogue, safety)).toEqual({ kind: 'safe' });
    }
  });

  it('takes out for traditional Spanish every row 0077 excludes, and with it each foreign accompaniment', () => {
    const preferences = resolvePreferences({
      allergenIdsByKey: new Map(),
      dietaryPatterns: ['traditional_spanish'],
      dislikedLabels: [],
      ingredients: rows
    });
    const larder = larderFor(diner(NOBODY, preferences));
    const keys = keysOf(larder.portions);

    for (const key of [
      'tortilla-de-maiz',
      'pan-de-pita',
      'hummus',
      'sopa-de-miso',
      'ensalada-de-pepino',
      'pak-choi-salteado',
      'pico-de-gallo',
      'frijoles',
      'tabule'
    ]) {
      expect(keys.has(key)).toBe(false);
    }

    const forbidden = PATTERN_EXCLUDED_SLUGS.traditional_spanish ?? new Set<string>();

    expect(larder.portions.flatMap(portion => portion.items).filter(item => forbidden.has(item.slug))).toEqual([]);
    expect(keys.has('pan-blanco')).toBe(true);
    expect(keys.has('gazpacho')).toBe(true);
  });

  it('takes out every accompaniment holding a food they dislike, whole', () => {
    const preferences = resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [], dislikedLabels: ['pepino'], ingredients: rows });
    const keys = keysOf(larderFor(diner(NOBODY, preferences)).portions);

    for (const key of ['gazpacho', 'ensalada-de-pepino', 'ensalada-marroqui', 'tabule']) {
      expect(keys.has(key)).toBe(false);
    }

    expect(keys.has('ensalada-verde')).toBe(true);
  });

  it('takes out an accompaniment that names an allergy the catalogue could not resolve, though its rows do not', () => {
    const keys = keysOf(larderFor(diner({ ...NOBODY, unenforceableLabels: ['gazpacho', 'Tabulé'] })).portions);

    expect(keys.has('gazpacho')).toBe(false);
    expect(keys.has('tabule')).toBe(false);
    expect(keys.has('ensalada-mixta')).toBe(true);
  });

  it('takes out whatever shares a word with an allergy the catalogue could not resolve', () => {
    const safety: SafetyProfile = { ...NOBODY, unenforceableLabels: ['canónigos frescos'] };

    expect(keysOf(larderFor(diner(safety)).portions).has('ensalada-de-invierno')).toBe(false);
  });
});

describe('portionsBeside — what may go beside one plate, at one meal, in one month', () => {
  const larder = larderFor(diner());

  it('serves season as a hard filter: no summer salad in December, the winter one instead', () => {
    const december = keysOf(portionsBeside(larder, SPANISH_STEW, 'lunch', 12));
    const july = keysOf(portionsBeside(larder, SPANISH_STEW, 'lunch', 7));

    expect(december.has('gazpacho')).toBe(false);
    expect(december.has('ensalada-mixta')).toBe(false);
    expect(december.has('ensalada-de-invierno')).toBe(true);
    expect(december.has('naranja')).toBe(true);
    expect(december.has('sandia')).toBe(false);
    expect(july.has('gazpacho')).toBe(true);
    expect(july.has('naranja')).toBe(false);
  });

  it("follows the dish's family: plain rice and miso beside an Asian dish, bread and gazpacho beside a Spanish one", () => {
    const asian = keysOf(portionsBeside(larder, { ...SPANISH_STEW, cuisine: 'Japonesa' }, 'dinner', 7));
    const spanish = keysOf(portionsBeside(larder, SPANISH_STEW, 'dinner', 7));

    expect(asian.has('arroz-blanco')).toBe(true);
    expect(asian.has('sopa-de-miso')).toBe(true);
    expect(asian.has('gazpacho')).toBe(false);
    expect(spanish.has('arroz-blanco')).toBe(false);
    expect(spanish.has('pan-blanco')).toBe(true);
    expect(spanish.has('hummus')).toBe(false);
  });

  it('keeps nuts and cheese for breakfast, and the tabulé for lunch', () => {
    const arab = { ...SPANISH_STEW, cuisine: 'Marroquí' };

    expect(keysOf(portionsBeside(larder, SPANISH_STEW, 'lunch', OCTOBER)).has('nueces')).toBe(false);
    expect(keysOf(portionsBeside(larder, SPANISH_STEW, 'breakfast', OCTOBER)).has('nueces')).toBe(true);
    expect(keysOf(portionsBeside(larder, arab, 'lunch', 7)).has('tabule')).toBe(true);
    expect(keysOf(portionsBeside(larder, arab, 'dinner', 7)).has('tabule')).toBe(false);
  });

  it('does not repeat what the plate already is: bread beside bread, rice beside rice, fruit beside fruit', () => {
    const sandwich = { ...SPANISH_STEW, ingredients: [...SPANISH_STEW.ingredients, { grams: 60, slug: 'pan-blanco' }] };
    const riceBowl = { cuisine: 'Japonesa', ingredients: [{ grams: 200, slug: 'arroz-blanco-cocido' }], servings: 1 };
    const fruitPlate = { ...SPANISH_STEW, ingredients: [{ grams: 150, slug: 'manzana' }] };

    expect([...keysOf(portionsBeside(larder, sandwich, 'lunch', OCTOBER))].some(key => key.startsWith('pan-'))).toBe(false);
    expect(keysOf(portionsBeside(larder, riceBowl, 'dinner', OCTOBER)).has('arroz-blanco')).toBe(false);
    expect(keysOf(portionsBeside(larder, fruitPlate, 'lunch', OCTOBER)).has('platano')).toBe(false);
    expect(keysOf(portionsBeside(larder, SPANISH_STEW, 'lunch', OCTOBER)).has('platano')).toBe(true);
  });

  it('judges kosher on the whole meal: no yoghurt beside meat, yoghurt beside fish', () => {
    const kosher = { ...NO_PREFERENCE_EXCLUSIONS, keepsMeatFromDairy: true };
    const meatCatalogue = toCatalogue([...rows, makeCatalogueIngredient({ id: 'i-ternera', classes: ['animal', 'meat'], slug: 'ternera' })]);
    const kosherLarder = larderFor({ catalogue: meatCatalogue, preferences: kosher, safety: NOBODY });
    const meat = { cuisine: null, ingredients: [{ grams: 150, slug: 'ternera' }], servings: 1 };

    expect([...keysOf(portionsBeside(kosherLarder, meat, 'lunch', OCTOBER))].some(key => key.startsWith('yogur'))).toBe(false);
    expect(keysOf(portionsBeside(kosherLarder, SPANISH_STEW, 'lunch', OCTOBER)).has('yogur-griego-natural')).toBe(true);
    // The same meat plate for somebody who does not keep them apart.
    expect(keysOf(portionsBeside(larderFor({ ...diner(), catalogue: meatCatalogue }), meat, 'lunch', OCTOBER)).has('yogur-griego-natural')).toBe(
      true
    );
  });
});

describe('setsBeside — a whole-meal rule judged on the whole table', () => {
  it('drops a set whose sides break kosher together, though each passes beside the plate alone', () => {
    // A bread with meat in it — a jamón roll — is not in Table 3; a future row like it must not meet a yoghurt.
    const meatyBread = toCatalogue(rows.map(row => (row.slug === 'pan-blanco' ? { ...row, classes: ['animal', 'meat'] as const } : row)));
    const kosher = { ...NO_PREFERENCE_EXCLUSIONS, keepsMeatFromDairy: true };
    const larder = larderFor({ catalogue: meatyBread, preferences: kosher, safety: NOBODY });
    const portions = keysOf(portionsBeside(larder, SPANISH_STEW, 'lunch', OCTOBER));
    const sets = setsBeside(larder, SPANISH_STEW, 'lunch', OCTOBER);
    const holds = (key: string) => (set: (typeof sets)[number]) => set.portions.some(portion => portion.accompaniment.key === key);

    expect(portions.has('pan-blanco')).toBe(true);
    expect(portions.has('yogur-griego-natural')).toBe(true);
    expect(sets.some(set => holds('pan-blanco')(set) && holds('yogur-griego-natural')(set))).toBe(false);
    expect(sets.some(holds('pan-blanco'))).toBe(true);
    expect(sets.some(holds('yogur-griego-natural'))).toBe(true);
  });
});

describe('setsOf — nothing, or one of each role', () => {
  it('starts with nothing and never puts two of a role together', () => {
    const portions = portionsBeside(larderFor(diner()), SPANISH_STEW, 'lunch', OCTOBER);
    const sets = setsOf(portions);

    expect(sets[0]).toBe(NO_ACCOMPANIMENT);

    for (const set of sets) {
      const used = set.portions.map(portion => portion.accompaniment.role);

      expect(new Set(used).size).toBe(used.length);
      expect(set.portions.length).toBeLessThanOrEqual(3);
      expect(set.macros.kcal).toBeCloseTo(
        set.portions.reduce((sum, portion) => sum + portion.macros.kcal, 0),
        6
      );
    }
  });

  it('counts every combination: (starch + 1) × (vegetable + 1) × (dessert + 1)', () => {
    const portions = portionsBeside(larderFor(diner()), SPANISH_STEW, 'lunch', OCTOBER);
    const count = (role: string) => portions.filter(portion => portion.accompaniment.role === role).length + 1;

    expect(setsOf(portions)).toHaveLength(count('starch') * count('vegetable') * count('dessert'));
  });
});

// The meals a portion may go beside, so a table edit that drops a meal is a failing test.
describe('the meals of Table 3', () => {
  const at = (key: string): readonly MealSlot[] => ACCOMPANIMENTS.find(entry => entry.key === key)?.slots ?? [];

  it.each([
    ['pan-blanco', ['breakfast', 'lunch', 'dinner']],
    ['naranja', ['breakfast', 'lunch', 'dinner']],
    ['nueces', ['breakfast']],
    ['queso-de-burgos', ['breakfast']],
    ['hummus', ['lunch', 'dinner']],
    ['frijoles', ['breakfast', 'lunch', 'dinner']],
    ['tabule', ['lunch']],
    ['gazpacho', ['lunch', 'dinner']]
  ] as const)('%s at %j', (key, slots) => {
    expect(at(key)).toEqual(slots);
  });
});

describe('what is stored and shown of an accompaniment (016 phase 4)', () => {
  const catalogue = toCatalogue(makeAccompanimentRows(SLUGS));

  it('names every composed accompaniment in both languages, and a simple one by its food', () => {
    for (const accompaniment of ACCOMPANIMENTS.filter(isComposed)) {
      expect(accompanimentName(accompaniment.key, 'es-ES', undefined)).not.toBe(accompaniment.key);
      expect(accompanimentName(accompaniment.key, 'en-GB', undefined)).not.toBe(accompaniment.key);
    }

    expect(accompanimentName('ensalada-verde', 'es-ES', undefined)).toBe('Ensalada verde');
    expect(accompanimentName('ensalada-verde', 'en-GB', undefined)).toBe('Green salad');
    expect(accompanimentName('pan-blanco', 'es-ES', 'Pan blanco')).toBe('Pan blanco');
    expect(accompanimentName('naranja', 'en-GB', 'Orange')).toBe('Orange');
  });

  /** 016 phase 6: one line of how it is made, fixed here, for every composed side and no simple one. */
  it('tells how every composed accompaniment is made in both languages, and gives a simple one no line', () => {
    const composed = ACCOMPANIMENTS.filter(isComposed);

    expect(composed).toHaveLength(18);

    for (const accompaniment of composed) {
      for (const locale of ['es-ES', 'en-GB']) {
        const line = accompanimentPreparation(accompaniment.key, locale);

        expect(line?.trim().length, `${accompaniment.key} ${locale}`).toBeGreaterThan(0);
        // One sentence: a full stop at the end and nowhere before it.
        expect(line?.endsWith('.'), `${accompaniment.key} ${locale}`).toBe(true);
        expect(line?.slice(0, -1).includes('. '), `${accompaniment.key} ${locale}`).toBe(false);
      }
    }

    for (const accompaniment of ACCOMPANIMENTS.filter(entry => !isComposed(entry))) {
      expect(accompanimentPreparation(accompaniment.key, 'es-ES')).toBeUndefined();
    }

    expect(accompanimentPreparation('ensalada-verde', 'en-GB')).toMatch(/^Wash and tear the lettuce/);
    expect(accompanimentPreparation('ensalada-verde', 'fr-FR')).toMatch(/^Lava y trocea la lechuga/);
  });

  /** The oil a line names is the oil the portion lists: a teaspoon is 5 g, two are 10 g, none is none. */
  it('names exactly the oil each composed portion carries', () => {
    for (const accompaniment of ACCOMPANIMENTS.filter(isComposed)) {
      const oil = (accompaniment.portions[0] ?? [])
        .filter(item => item.slug === 'aceite-de-oliva-virgen-extra')
        .reduce((sum, item) => sum + item.grams, 0);
      const es = accompanimentPreparation(accompaniment.key, 'es-ES') ?? '';
      const en = accompanimentPreparation(accompaniment.key, 'en-GB') ?? '';
      const expected =
        oil === 0 ? null : oil === 5 ? ['una cucharadita de aceite', 'a teaspoon of oil'] : ['dos cucharaditas de aceite', 'two teaspoons of oil'];

      if (expected) {
        expect(es, accompaniment.key).toContain(expected[0]);
        expect(en, accompaniment.key).toContain(expected[1]);
      } else {
        expect(es, accompaniment.key).not.toContain('aceite');
        expect(en, accompaniment.key).not.toContain(' oil');
      }
    }
  });

  it("stores a composed accompaniment as one row per food, in serving order, its macros the catalogue's", () => {
    const portions = larderFor({ catalogue, preferences: NO_PREFERENCE_EXCLUSIONS, safety: toSafetyProfile([], []) }).portions;
    const salad = portions.find(portion => portion.accompaniment.key === 'ensalada-verde') as AccompanimentPortion;
    const bread = portions.find(portion => portion.accompaniment.key === 'pan-blanco') as AccompanimentPortion;
    const rows = accompanimentRows(
      [salad, bread].map(portion => ({ ingredients: portion.items, key: portion.accompaniment.key, macros: portion.macros })),
      catalogue
    );

    expect(rows.map(row => [row.accompanimentKey, row.ingredientId, row.grams, row.sortOrder])).toEqual([
      ...salad.items.map((item, index) => ['ensalada-verde', `i-${item.slug}`, item.grams, index]),
      ['pan-blanco', 'i-pan-blanco', bread.items[0]?.grams, salad.items.length]
    ]);

    const saladKcal = rows.filter(row => row.accompanimentKey === 'ensalada-verde').reduce((sum, row) => sum + row.kcal, 0);

    expect(saladKcal).toBeCloseTo(salad.macros.kcal, 0);
    expect(accompanimentRows(undefined, catalogue)).toEqual([]);
    expect(() =>
      accompanimentRows([{ ingredients: [{ grams: 10, slug: 'nada' }], key: 'nada', macros: NO_ACCOMPANIMENT.macros }], catalogue)
    ).toThrow();
  });
});

/* The e2e milk and coeliac cases can only fail if an unrestricted person is offered both (016 phase 4). */
describe('larderFor — somebody with no restriction', () => {
  it('is offered a dairy side and a wheat bread', () => {
    const catalogue = toCatalogue(makeAccompanimentRows(SLUGS, ALLERGENS));
    const keys = new Set(
      larderFor({ catalogue, preferences: NO_PREFERENCE_EXCLUSIONS, safety: toSafetyProfile([], []) }).portions.map(
        portion => portion.accompaniment.key
      )
    );

    expect(['yogur-natural-desnatado', 'yogur-griego-natural', 'queso-de-burgos', 'requeson'].some(key => keys.has(key))).toBe(true);
    expect(['pan-blanco', 'pan-integral', 'pan-de-centeno', 'pan-de-masa-madre'].some(key => keys.has(key))).toBe(true);
  });
});
