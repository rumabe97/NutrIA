import { describe, expect, it } from 'vitest';

import {
  breaksDishRule,
  breaksPatternDish,
  FOREIGN_UNMAPPED_CUISINES,
  freeFromExclusions,
  isEnforceableDislike,
  isLegumeSlug,
  leaningSlugs,
  NO_PREFERENCE_EXCLUSIONS,
  PATTERN_EXCLUDED_SLUGS,
  PATTERN_EXCLUSIONS,
  resolvePreferences,
  timeAllowance,
  withinTime
} from 'core/domain/Preference';
import { rotatePool } from 'core/domain/Variety';
import { makeCatalogueIngredient, makeDish } from '#test/fixtures';

import { INGREDIENT_SEED } from '../../../../database/src/seed/ingredients';

import type { CatalogueIngredient } from 'core/entities/Plan';
import type { FoodClass } from 'database/schema/food';

function food(slug: string, name: string, classes: readonly FoodClass[] = []): CatalogueIngredient {
  return makeCatalogueIngredient({ id: `i-${slug}`, classes, name, slug });
}

/** A slice of the real catalogue: the rows a fish-hater, a vegetarian and a vegan meet. */
const CATALOGUE = [
  food('salmon', 'Salmón', ['animal', 'fish']),
  food('salmon-ahumado', 'Salmón ahumado', ['animal', 'fish']),
  food('salmon-congelado', 'Salmón congelado', ['animal', 'fish']),
  food('salmonete', 'Salmonete', ['animal', 'fish']),
  food('merluza', 'Merluza', ['animal', 'fish']),
  food('gambas', 'Gambas', ['animal', 'shellfish']),
  food('pechuga-de-pollo', 'Pechuga de pollo', ['animal', 'meat']),
  food('lomo-de-cerdo', 'Lomo de cerdo', ['animal', 'meat', 'pork']),
  food('huevo', 'Huevo', ['animal', 'egg']),
  food('yogur-griego-natural', 'Yogur griego natural', ['animal', 'dairy']),
  food('miel', 'Miel', ['animal']),
  food('lentejas-cocidas', 'Lentejas cocidas'),
  food('arroz-blanco-cocido', 'Arroz blanco cocido')
];

function ids(result: { excludedIngredientIds: ReadonlySet<string> }): readonly string[] {
  return [...result.excludedIngredientIds].sort();
}

describe('isEnforceableDislike — the same question, asked without building a plan', () => {
  const names = CATALOGUE.map(ingredient => ({ name: ingredient.name, slug: ingredient.slug }));

  it('is false for a blank label', () => {
    expect(isEnforceableDislike('   ', names)).toBe(false);
  });

  it('is true for a group word, whatever its case or accent', () => {
    expect(isEnforceableDislike('Pescado', names)).toBe(true);
  });

  it('is true for a catalogue row named exactly, by name or by slug', () => {
    expect(isEnforceableDislike('Salmón', names)).toBe(true);
    expect(isEnforceableDislike('lomo-de-cerdo', names)).toBe(true);
  });

  it('is false for a label the catalogue does not know', () => {
    expect(isEnforceableDislike('comida picante', names)).toBe(false);
  });
});

describe('resolvePreferences — a dislike names a food, not one row', () => {
  it('excludes the named row and everything made of it, and nothing that merely starts alike', () => {
    // The reported bug in miniature: "salmón" left smoked and frozen salmon on the list.
    const result = resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [], dislikedLabels: ['Salmón'], ingredients: CATALOGUE });

    expect(ids(result)).toEqual(['i-salmon', 'i-salmon-ahumado', 'i-salmon-congelado']);
    expect(result.unenforceableLabels).toEqual([]);
  });

  it('expands a group word to its whole class', () => {
    // The reported bug as reported: "pescado" must reach every fish, salmon included.
    const result = resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [], dislikedLabels: ['pescado'], ingredients: CATALOGUE });

    expect(ids(result)).toEqual(['i-merluza', 'i-salmon', 'i-salmon-ahumado', 'i-salmon-congelado', 'i-salmonete']);
  });

  it('reads a group word however it was typed, and takes plurals and accents', () => {
    for (const label of ['Pescado', 'PESCADOS', ' pescado ']) {
      expect(
        ids(resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [], dislikedLabels: [label], ingredients: CATALOGUE })).length
      ).toBe(5);
    }

    expect(
      ids(resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [], dislikedLabels: ['lácteos'], ingredients: CATALOGUE }))
    ).toEqual(['i-yogur-griego-natural']);
  });

  /*
   * The preferences form says "pescado" leaves shellfish in and to add
   * "marisco" (019 phase 7): both halves of that sentence are this rule, in
   * either language the form is written in.
   */
  it('keeps shellfish out of "pescado" and takes it out with "marisco", and the same in English', () => {
    const excluded = (label: string) =>
      ids(resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [], dislikedLabels: [label], ingredients: CATALOGUE }));

    expect(excluded('pescado')).not.toContain('i-gambas');
    expect(excluded('marisco')).toEqual(['i-gambas']);
    expect(excluded('Fish')).toEqual(excluded('pescado'));
    expect(excluded('shellfish')).toEqual(['i-gambas']);
    expect(excluded('fish and shellfish')).toEqual([...excluded('pescado'), 'i-gambas'].sort());
  });

  it('reports what it could not resolve rather than pretending to enforce it', () => {
    const result = resolvePreferences({
      allergenIdsByKey: new Map(),
      dietaryPatterns: [],
      dislikedLabels: ['comida picante', 'salmón'],
      ingredients: CATALOGUE
    });

    expect(result.unenforceableLabels).toEqual(['comida picante']);
    expect(ids(result)).toEqual(['i-salmon', 'i-salmon-ahumado', 'i-salmon-congelado']);
  });

  it('reports a blank label as unenforceable rather than matching everything', () => {
    const result = resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [], dislikedLabels: ['   '], ingredients: CATALOGUE });

    expect(result.unenforceableLabels).toEqual(['']);
    expect(ids(result)).toEqual([]);
  });
});

describe('resolvePreferences — likes are a weight, not a rule', () => {
  it('resolves a liked label to the catalogue slugs it names, group words included', () => {
    const result = resolvePreferences({
      allergenIdsByKey: new Map(),
      dietaryPatterns: [],
      dislikedLabels: [],
      ingredients: CATALOGUE,
      likedLabels: ['pescado']
    });

    expect([...result.preferredIngredientSlugs].sort()).toEqual(['merluza', 'salmon', 'salmon-ahumado', 'salmon-congelado', 'salmonete']);
  });

  it('leaves preferences empty when nothing liked was said, or nothing liked resolves', () => {
    expect(
      resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [], dislikedLabels: [], ingredients: CATALOGUE }).preferredIngredientSlugs
        .size
    ).toBe(0);
    expect(
      resolvePreferences({
        allergenIdsByKey: new Map(),
        dietaryPatterns: [],
        dislikedLabels: [],
        ingredients: CATALOGUE,
        likedLabels: ['comida picante']
      }).preferredIngredientSlugs.size
    ).toBe(0);
  });
});

describe('resolvePreferences — a way of eating', () => {
  it('keeps fish and shellfish off a vegetarian plate, and meat off a pescatarian one', () => {
    const vegetarian = resolvePreferences({
      allergenIdsByKey: new Map(),
      dietaryPatterns: ['vegetarian'],
      dislikedLabels: [],
      ingredients: CATALOGUE
    });

    expect(ids(vegetarian)).toEqual([
      'i-gambas',
      'i-lomo-de-cerdo',
      'i-merluza',
      'i-pechuga-de-pollo',
      'i-salmon',
      'i-salmon-ahumado',
      'i-salmon-congelado',
      'i-salmonete'
    ]);
    // Eggs, dairy and honey stay: a vegetarian eats them.
    expect(vegetarian.excludedIngredientIds.has('i-huevo')).toBe(false);
    expect(vegetarian.excludedIngredientIds.has('i-yogur-griego-natural')).toBe(false);

    const pescatarian = resolvePreferences({
      allergenIdsByKey: new Map(),
      dietaryPatterns: ['pescatarian'],
      dislikedLabels: [],
      ingredients: CATALOGUE
    });

    expect(ids(pescatarian)).toEqual(['i-lomo-de-cerdo', 'i-pechuga-de-pollo']);
  });

  it('leaves a vegan nothing of animal origin, honey included', () => {
    const result = resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: ['vegan'], dislikedLabels: [], ingredients: CATALOGUE });

    expect(result.excludedIngredientIds.has('i-miel')).toBe(true);
    expect(ids(result)).not.toContain('i-lentejas-cocidas');
    expect(ids(result)).not.toContain('i-arroz-blanco-cocido');
  });

  it('excludes nothing for a pattern that is a direction rather than a rule', () => {
    // Halal and kosher are enforced now, as far as the catalogue can say
    // (see below); how meat was slaughtered it cannot, and does not claim to.
    for (const pattern of ['omnivore', 'flexitarian']) {
      expect(PATTERN_EXCLUSIONS[pattern]).toBeUndefined();
      expect(
        resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [pattern], dislikedLabels: [], ingredients: CATALOGUE })
          .excludedIngredientIds.size
      ).toBe(0);
    }
  });

  it('adds a way of eating and a dislike together', () => {
    const result = resolvePreferences({
      allergenIdsByKey: new Map(),
      dietaryPatterns: ['vegetarian'],
      dislikedLabels: ['huevo'],
      ingredients: CATALOGUE
    });

    expect(result.excludedIngredientIds.has('i-huevo')).toBe(true);
    expect(result.excludedIngredientIds.has('i-pechuga-de-pollo')).toBe(true);
  });

  it('carries the cooking-time limit, and nothing when none was set', () => {
    expect(
      resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [], dislikedLabels: [], ingredients: CATALOGUE, maxMinutesPerDish: 25 })
        .maxMinutesPerDish
    ).toBe(25);
    expect(
      resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [], dislikedLabels: [], ingredients: CATALOGUE }).maxMinutesPerDish
    ).toBeNull();
  });

  it('is empty when nothing was said', () => {
    expect(
      resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: [], dislikedLabels: [], ingredients: CATALOGUE }).excludedIngredientIds.size
    ).toBe(0);
    expect(NO_PREFERENCE_EXCLUSIONS.excludedIngredientIds.size).toBe(0);
  });
});

describe('withinTime — the minutes they said they have', () => {
  const dish = (prepMinutes: number, cookMinutes: number) => ({ cookMinutes, prepMinutes });

  it('counts prep and cooking together, against the limit and its margin', () => {
    // Thirty minutes admits forty: a fifth more, rounded up to the next ten.
    expect(withinTime(dish(10, 30), 30)).toBe(true);
    expect(withinTime(dish(10, 31), 30)).toBe(false);
  });

  /**
   * The minutes on a dish are an estimate, and a strict limit dropped dishes for
   * a minute over it. The owner's rule: a fifth more, always rounded up to ten.
   */
  it('allows a fifth more than the limit, rounded up to the next ten minutes', () => {
    expect(timeAllowance(30)).toBe(40);
    expect(timeAllowance(55)).toBe(70);
    expect(timeAllowance(28)).toBe(40);
    expect(timeAllowance(15)).toBe(20);
    expect(timeAllowance(60)).toBe(80);
    // An exact multiple of ten is not pushed to the next one.
    expect(timeAllowance(25)).toBe(30);
    expect(timeAllowance(50)).toBe(60);
  });

  it('lets everything through when no limit was set', () => {
    expect(withinTime(dish(60, 120), null)).toBe(true);
  });
});

/**
 * A religious way of eating is never named to the model (owner, 2026-09-25):
 * what the catalogue can express is enforced here instead.
 */
describe('resolvePreferences — halal and kosher, in code', () => {
  const RELIGIOUS = [
    ...CATALOGUE,
    food('vino-blanco', 'Vino blanco'),
    food('vino-tinto', 'Vino tinto'),
    food('vino-sin-alcohol', 'Vino sin alcohol'),
    food('cerveza-sin-alcohol', 'Cerveza sin alcohol'),
    food('vinagre-de-vino-tinto', 'Vinagre de vino tinto'),
    food('vinagre-de-jerez', 'Vinagre de Jerez'),
    food('gelatina-neutra', 'Gelatina neutra', ['animal']),
    food('manteca-de-cerdo', 'Manteca de cerdo', ['animal', 'meat', 'pork']),
    food('rape', 'Rape', ['animal', 'fish']),
    food('pez-espada', 'Pez espada', ['animal', 'fish']),
    food('filete-de-panga-congelado', 'Filete de panga congelado', ['animal', 'fish']),
    food('turron-de-jijona', 'Turrón de Jijona')
  ];

  it('takes pork, alcohol and gelatine out for halal, and leaves vinegar, alcohol-free drinks, fish and other meat', () => {
    const excluded = ids(resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: ['halal'], dislikedLabels: [], ingredients: RELIGIOUS }));

    expect(excluded).toEqual(['i-gelatina-neutra', 'i-lomo-de-cerdo', 'i-manteca-de-cerdo', 'i-vino-blanco', 'i-vino-tinto']);
  });

  it('takes pork, shellfish, scaleless fish, alcohol and gelatine out for kosher', () => {
    const excluded = ids(
      resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: ['kosher'], dislikedLabels: [], ingredients: RELIGIOUS })
    );

    expect(excluded).toEqual([
      'i-filete-de-panga-congelado',
      'i-gambas',
      'i-gelatina-neutra',
      'i-lomo-de-cerdo',
      'i-manteca-de-cerdo',
      'i-pez-espada',
      'i-rape',
      'i-vino-blanco',
      'i-vino-tinto'
    ]);
  });

  it('matches whole slug words only: turrón is not rum, and salmonete stays for kosher', () => {
    const excluded = ids(
      resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: ['kosher'], dislikedLabels: [], ingredients: RELIGIOUS })
    );

    expect(excluded).not.toContain('i-turron-de-jijona');
    expect(excluded).not.toContain('i-salmonete');
  });

  it('keeps meat from dairy only for kosher', () => {
    expect(
      resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: ['kosher'], dislikedLabels: [], ingredients: RELIGIOUS }).keepsMeatFromDairy
    ).toBe(true);
    expect(
      resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: ['halal'], dislikedLabels: [], ingredients: RELIGIOUS }).keepsMeatFromDairy
    ).toBe(false);
    expect(NO_PREFERENCE_EXCLUSIONS.keepsMeatFromDairy).toBe(false);
  });
});

describe('breaksDishRule — meat with dairy', () => {
  const catalogue = new Map(CATALOGUE.map(ingredient => [ingredient.slug, ingredient]));
  const kosher = { keepsMeatFromDairy: true };
  const dish = (...slugs: string[]) => slugs.map(slug => ({ slug }));

  it('refuses a dish with meat and dairy together for someone who keeps them apart', () => {
    expect(breaksDishRule(dish('pechuga-de-pollo', 'yogur-griego-natural'), catalogue, kosher)).toBe(true);
    expect(breaksDishRule(dish('lomo-de-cerdo', 'yogur-griego-natural'), catalogue, kosher)).toBe(true);
  });

  it('allows either alone, and fish with dairy', () => {
    expect(breaksDishRule(dish('pechuga-de-pollo', 'arroz-blanco-cocido'), catalogue, kosher)).toBe(false);
    expect(breaksDishRule(dish('yogur-griego-natural', 'miel'), catalogue, kosher)).toBe(false);
    expect(breaksDishRule(dish('salmon', 'yogur-griego-natural'), catalogue, kosher)).toBe(false);
  });

  it('says nothing for anybody else', () => {
    expect(breaksDishRule(dish('pechuga-de-pollo', 'yogur-griego-natural'), catalogue, { keepsMeatFromDairy: false })).toBe(false);
  });
});

describe('resolvePreferences — gluten-free and lactose-free, by the allergy gate’s tags', () => {
  const byKey = new Map([
    ['gluten', 'a-gluten'],
    ['lactose', 'a-lactose'],
    ['milk', 'a-milk']
  ]);
  const tagged = (slug: string, allergens: CatalogueIngredient['allergens']) =>
    makeCatalogueIngredient({ id: `i-${slug}`, allergens, name: slug, slug });
  const ROWS = [
    tagged('pan-de-trigo', [{ allergenId: 'a-gluten', presence: 'contains' }]),
    tagged('copos-de-avena', [{ allergenId: 'a-gluten', presence: 'may_contain' }]),
    tagged('leche-entera', [
      { allergenId: 'a-milk', presence: 'contains' },
      { allergenId: 'a-lactose', presence: 'contains' }
    ]),
    tagged('mantequilla', [{ allergenId: 'a-milk', presence: 'contains' }]),
    tagged('leche-sin-lactosa', [{ allergenId: 'a-milk', presence: 'contains' }]),
    tagged('chocolate-negro', [{ allergenId: 'a-milk', presence: 'may_contain' }]),
    tagged('arroz', [])
  ];

  it('takes out gluten, traces included, for gluten-free', () => {
    expect(ids(resolvePreferences({ allergenIdsByKey: byKey, dietaryPatterns: ['gluten_free'], dislikedLabels: [], ingredients: ROWS }))).toEqual([
      'i-copos-de-avena',
      'i-pan-de-trigo'
    ]);
  });

  it('takes out what contains milk or lactose for lactose-free — not traces, and not what says it is lactose-free', () => {
    expect(ids(resolvePreferences({ allergenIdsByKey: byKey, dietaryPatterns: ['lactose_free'], dislikedLabels: [], ingredients: ROWS }))).toEqual([
      'i-leche-entera',
      'i-mantequilla'
    ]);
  });

  it('excludes nothing by tag from an allergen catalogue that lacks those keys', () => {
    expect(
      resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: ['gluten_free', 'lactose_free'], dislikedLabels: [], ingredients: ROWS })
        .excludedIngredientIds.size
    ).toBe(0);
  });
});

describe('freeFromExclusions — a substitute built for one restriction, offered only to whoever has it', () => {
  const byKey = new Map([
    ['gluten', 'a-gluten'],
    ['lactose', 'a-lactose'],
    ['milk', 'a-milk']
  ]);
  const ROWS = [
    food('pan-sin-gluten', 'Pan sin gluten'),
    food('pasta-sin-gluten', 'Pasta sin gluten'),
    food('leche-sin-lactosa', 'Leche sin lactosa'),
    food('arroz-blanco-cocido', 'Arroz blanco cocido')
  ];
  const needs = (over: Partial<{ dietaryPatterns: readonly string[]; restrictedAllergenIds: ReadonlySet<string> }> = {}) => ({
    allergenIdsByKey: byKey,
    dietaryPatterns: [],
    restrictedAllergenIds: new Set<string>(),
    ...over
  });

  it('offers neither substitute to somebody with no restriction at all', () => {
    expect(ids({ excludedIngredientIds: freeFromExclusions(ROWS, needs()) })).toEqual([
      'i-leche-sin-lactosa',
      'i-pan-sin-gluten',
      'i-pasta-sin-gluten'
    ]);
  });

  it('keeps the gluten-free rows for a declared gluten allergy or intolerance, and still excludes the lactose one', () => {
    expect(ids({ excludedIngredientIds: freeFromExclusions(ROWS, needs({ restrictedAllergenIds: new Set(['a-gluten']) })) })).toEqual([
      'i-leche-sin-lactosa'
    ]);
  });

  it('keeps the gluten-free rows for a gluten-free way of eating', () => {
    expect(ids({ excludedIngredientIds: freeFromExclusions(ROWS, needs({ dietaryPatterns: ['gluten_free'] })) })).toEqual(['i-leche-sin-lactosa']);
  });

  it('keeps lactose-free milk for a lactose intolerance, by either allergen key', () => {
    expect(ids({ excludedIngredientIds: freeFromExclusions(ROWS, needs({ restrictedAllergenIds: new Set(['a-lactose']) })) })).toEqual([
      'i-pan-sin-gluten',
      'i-pasta-sin-gluten'
    ]);
    expect(ids({ excludedIngredientIds: freeFromExclusions(ROWS, needs({ restrictedAllergenIds: new Set(['a-milk']) })) })).toEqual([
      'i-pan-sin-gluten',
      'i-pasta-sin-gluten'
    ]);
  });

  it('keeps lactose-free milk for a lactose-free way of eating', () => {
    expect(ids({ excludedIngredientIds: freeFromExclusions(ROWS, needs({ dietaryPatterns: ['lactose_free'] })) })).toEqual([
      'i-pan-sin-gluten',
      'i-pasta-sin-gluten'
    ]);
  });

  it('an unrelated restriction does not exempt the other substitute', () => {
    // Lactose-free does not unlock gluten-free bread, and a gluten allergy does
    // not unlock lactose-free milk.
    expect(ids({ excludedIngredientIds: freeFromExclusions(ROWS, needs({ dietaryPatterns: ['lactose_free'] })) })).toContain('i-pan-sin-gluten');
    expect(ids({ excludedIngredientIds: freeFromExclusions(ROWS, needs({ restrictedAllergenIds: new Set(['a-gluten']) })) })).toContain(
      'i-leche-sin-lactosa'
    );
  });

  it('excludes nothing where the row is not a free-from substitute', () => {
    expect(freeFromExclusions([food('arroz-blanco-cocido', 'Arroz')], needs()).size).toBe(0);
  });
});

describe('resolvePreferences — traditional Spanish, by exact slug (0077)', () => {
  const spanish = PATTERN_EXCLUDED_SLUGS.traditional_spanish ?? new Set<string>();
  const seed = INGREDIENT_SEED.map(row => food(row.slug, row.name, row.classes ?? []));

  function resolve(ingredients: readonly CatalogueIngredient[], dietaryPatterns: readonly string[] = ['traditional_spanish']) {
    return resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns, dislikedLabels: [], ingredients });
  }

  it('holds the 157 rows of the decision, every one of them in the seed', () => {
    const seedSlugs = new Set(INGREDIENT_SEED.map(row => row.slug));

    expect(spanish.size).toBe(157);
    expect([...spanish].filter(slug => !seedSlugs.has(slug))).toEqual([]);
  });

  it('excludes every slug of the list from the real catalogue', () => {
    const excluded = resolve(seed).excludedIngredientIds;

    expect([...spanish].filter(slug => !excluded.has(`i-${slug}`))).toEqual([]);
    expect(excluded.size).toBe(157);
  });

  it('is exact, not a run: seta-ostra survives salsa-de-ostras, and the owner’s keeps stay', () => {
    const excluded = resolve(seed).excludedIngredientIds;

    for (const kept of [
      'seta-ostra',
      'copos-de-avena',
      'aguacate',
      'arroz-basmati-crudo',
      'kefir',
      'queso-batido-desnatado',
      'lentejas-cocidas',
      'merluza'
    ]) {
      expect(
        seed.some(row => row.slug === kept),
        kept
      ).toBe(true);
      expect(excluded.has(`i-${kept}`), kept).toBe(false);
    }
  });

  it('ignores a slug the catalogue does not hold, and excludes nothing without the pattern', () => {
    expect(ids(resolve(CATALOGUE))).toEqual([]);
    expect(ids(resolve([...CATALOGUE, food('tofu-firme', 'Tofu firme')], ['omnivore']))).toEqual([]);
    expect(ids(resolve([...CATALOGUE, food('tofu-firme', 'Tofu firme')]))).toEqual(['i-tofu-firme']);
  });
});

describe('breaksPatternDish — a foreign cuisine or name (0077)', () => {
  const spanish = { refusesForeignDishes: true };

  it('refuses a mexicana dish and a wok, whatever the case or accents', () => {
    expect(breaksPatternDish({ cuisine: 'Mexicana', name: 'Pollo con arroz' }, spanish)).toBe(true);
    expect(breaksPatternDish({ cuisine: 'ASIÁTICA', name: 'Arroz salteado' }, spanish)).toBe(true);
    expect(breaksPatternDish({ cuisine: 'Oriente Medio', name: 'Garbanzos especiados' }, spanish)).toBe(true);
    expect(breaksPatternDish({ cuisine: 'mediterránea', name: 'Wok de verduras' }, spanish)).toBe(true);
    expect(breaksPatternDish({ cuisine: null, name: 'Tabulé de cuscús' }, spanish)).toBe(true);
    expect(breaksPatternDish({ cuisine: null, name: 'Fajita de pollo' }, spanish)).toBe(true);
  });

  it('lets a paella with no cuisine pass, and the Spanish and neighbouring kitchens', () => {
    expect(breaksPatternDish({ cuisine: null, name: 'Paella valenciana' }, spanish)).toBe(false);
    expect(breaksPatternDish({ cuisine: '', name: 'Paella valenciana' }, spanish)).toBe(false);

    for (const cuisine of ['mediterránea', 'Española', 'andaluza', 'italiana', 'francesa', 'griega']) {
      expect(breaksPatternDish({ cuisine, name: 'Merluza en salsa verde' }, spanish), cuisine).toBe(false);
    }
  });

  // Every value `cuisineFamily` reads as arab, asian or latin, as stored: the refusal follows the family, so none can drift out of it.
  it.each([
    'Marroquí',
    'moroccan',
    'Magrebí',
    'Árabe',
    'Libanesa',
    'Oriente Medio',
    'levantina',
    'Turca',
    'Asiática',
    'asian',
    'Oriental',
    'China',
    'Japonesa',
    'Coreana',
    'Tailandesa',
    'Vietnamita',
    'India',
    'indio',
    'indian',
    'Hawaiana',
    'Mexicana',
    'mexican',
    'Latina',
    'Peruana',
    'Venezolana',
    'Colombiana',
    'Argentina',
    'Cubana',
    'Caribeña'
  ])('refuses a %s dish of a foreign family, whatever its name', cuisine => {
    expect(breaksPatternDish({ cuisine, name: 'Pollo con verduras' }, spanish)).toBe(true);
  });

  it.each(['Americana', 'estadounidense', 'tropical', 'Nórdica', 'escandinava', 'Fusión'])(
    'refuses a %s dish, foreign though no family holds it',
    cuisine => {
      expect(breaksPatternDish({ cuisine, name: 'Pollo con verduras' }, spanish)).toBe(true);
    }
  );

  it.each([
    'Española',
    'Mediterránea',
    'mediterranean',
    'Mediterránea (España)',
    'Vasca',
    'Gallega',
    'Andaluza',
    'Canaria',
    'Tapa',
    'Italiana',
    'italian',
    'Francesa',
    'Griega',
    'greek'
  ])('lets a %s dish pass', cuisine => {
    expect(breaksPatternDish({ cuisine, name: 'Pollo con verduras' }, spanish)).toBe(false);
  });

  it('refuses no cuisine for any other way of eating', () => {
    for (const cuisine of ['Turca', 'Cubana', 'Mexicana', 'Americana']) {
      expect(breaksPatternDish({ cuisine, name: 'Pollo con verduras' }, NO_PREFERENCE_EXCLUSIONS), cuisine).toBe(false);
      expect(
        breaksPatternDish(
          { cuisine, name: 'Pollo con verduras' },
          resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: ['vegetarian', 'mediterranean'], dislikedLabels: [], ingredients: [] })
        ),
        cuisine
      ).toBe(false);
    }
  });

  it('reads tacos as Spanish unless they are the Mexican kind', () => {
    expect(breaksPatternDish({ cuisine: null, name: 'Huevos al plato con tacos de jamón' }, spanish)).toBe(false);
    expect(breaksPatternDish({ cuisine: null, name: 'Tacos de pollo' }, spanish)).toBe(true);
    expect(breaksPatternDish({ cuisine: null, name: 'Ensalada con tacos de ternera' }, spanish)).toBe(true);
    expect(breaksPatternDish({ cuisine: null, name: 'Tacos al pastor' }, spanish)).toBe(true);
  });

  it('takes whole words only: a word that contains one passes', () => {
    expect(breaksPatternDish({ cuisine: null, name: 'Pokes de calabacín' }, spanish)).toBe(false);
    expect(breaksPatternDish({ cuisine: 'indiana', name: 'Crema de calabaza' }, spanish)).toBe(false);
  });

  it('refuses nothing without the pattern, and the list is stored normalised', () => {
    expect(breaksPatternDish({ cuisine: 'mexicana', name: 'Tacos de pollo' }, { refusesForeignDishes: false })).toBe(false);
    expect(
      resolvePreferences({ allergenIdsByKey: new Map(), dietaryPatterns: ['traditional_spanish'], dislikedLabels: [], ingredients: [] })
        .refusesForeignDishes
    ).toBe(true);
    expect([...FOREIGN_UNMAPPED_CUISINES].every(cuisine => /^[a-z ]+$/.test(cuisine))).toBe(true);
  });
});

describe('resolvePreferences — the traditional Spanish lean (0077)', () => {
  const catalogue = [
    ...CATALOGUE,
    food('garbanzos-cocidos', 'Garbanzos cocidos'),
    food('pasta-de-lentejas', 'Pasta de lentejas'),
    food('seta-de-cardo', 'Seta de cardo'),
    food('judia-verde', 'Judía verde'),
    food('arroz-para-sushi', 'Arroz para sushi'),
    food('patata', 'Patata')
  ];
  const lean = (patterns: readonly string[]) =>
    resolvePreferences({
      allergenIdsByKey: new Map(),
      dietaryPatterns: patterns,
      dislikedLabels: [],
      ingredients: catalogue,
      likedLabels: ['patata']
    });

  it('leans to legumes, rice, fish, seafood and huerta, by the head of the slug', () => {
    const slugs = [...lean(['traditional_spanish']).leaningIngredientSlugs].sort();

    expect(slugs).toEqual([
      'arroz-blanco-cocido',
      'gambas',
      'garbanzos-cocidos',
      'judia-verde',
      'lentejas-cocidas',
      'merluza',
      'salmon',
      'salmon-ahumado',
      'salmon-congelado',
      'salmonete'
    ]);
  });

  it('counts a legume by the head of its slug, as the evaluator does', () => {
    expect(
      ['lentejas-cocidas', 'garbanzos-secos', 'alubias-blancas-cocidas', 'judiones', 'habas-frescas', 'judias-rojas-cocidas'].every(isLegumeSlug)
    ).toBe(true);
    expect(['pasta-de-lentejas', 'harina-de-garbanzo', 'judia-verde', 'proteina-de-guisante'].some(isLegumeSlug)).toBe(false);
  });

  it('never leans to an excluded row, and leans to nothing without the pattern', () => {
    expect(lean(['traditional_spanish']).leaningIngredientSlugs.has('arroz-para-sushi')).toBe(false);
    expect(lean(['omnivore']).leaningIngredientSlugs.size).toBe(0);
  });

  it('keeps the lean apart from the likes, and joins them for the pick', () => {
    const preferences = lean(['traditional_spanish']);

    expect([...preferences.preferredIngredientSlugs]).toEqual(['patata']);
    expect(leaningSlugs(preferences).has('patata')).toBe(true);
    expect(leaningSlugs(preferences).has('lentejas-cocidas')).toBe(true);
    expect(leaningSlugs(lean(['omnivore']))).toEqual(new Set(['patata']));
  });

  it('puts a lentil stew before an equal dish without legumes', () => {
    const stew = makeDish({
      ingredients: [{ grams: 200, slug: 'lentejas-cocidas' }],
      name: 'Lentejas estofadas',
      slots: ['lunch'],
      slug: 'lentejas-estofadas'
    });
    const plain = makeDish({ ingredients: [{ grams: 200, slug: 'huevo' }], name: 'Huevos rotos', slots: ['lunch'], slug: 'huevos-rotos' });
    const spanish = { preferIngredientSlugs: leaningSlugs(lean(['traditional_spanish'])) };
    const neutral = { preferIngredientSlugs: leaningSlugs(lean(['omnivore'])) };
    const seeds = Array.from({ length: 20 }, (_, index) => `user:${index}`);
    const first = (leaning: typeof spanish, seed: string) =>
      rotatePool([plain, stew], ['lunch'], { ...leaning, avoidSlugs: new Set(), seed }, 1).map(dish => dish.slug);

    expect(seeds.every(seed => first(spanish, seed)[0] === 'lentejas-estofadas')).toBe(true);
    expect(seeds.some(seed => first(neutral, seed)[0] === 'huevos-rotos')).toBe(true);
  });
});
