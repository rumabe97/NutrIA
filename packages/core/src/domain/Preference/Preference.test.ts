import { describe, expect, it } from 'vitest';

import {
  breaksDishRule,
  isEnforceableDislike,
  NO_PREFERENCE_EXCLUSIONS,
  PATTERN_EXCLUSIONS,
  resolvePreferences,
  timeAllowance,
  withinTime
} from 'core/domain/Preference';
import { makeCatalogueIngredient } from '#test/fixtures';

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
    const result = resolvePreferences({ dietaryPatterns: [], dislikedLabels: ['Salmón'], ingredients: CATALOGUE });

    expect(ids(result)).toEqual(['i-salmon', 'i-salmon-ahumado', 'i-salmon-congelado']);
    expect(result.unenforceableLabels).toEqual([]);
  });

  it('expands a group word to its whole class', () => {
    // The reported bug as reported: "pescado" must reach every fish, salmon included.
    const result = resolvePreferences({ dietaryPatterns: [], dislikedLabels: ['pescado'], ingredients: CATALOGUE });

    expect(ids(result)).toEqual(['i-merluza', 'i-salmon', 'i-salmon-ahumado', 'i-salmon-congelado', 'i-salmonete']);
  });

  it('reads a group word however it was typed, and takes plurals and accents', () => {
    for (const label of ['Pescado', 'PESCADOS', ' pescado ']) {
      expect(ids(resolvePreferences({ dietaryPatterns: [], dislikedLabels: [label], ingredients: CATALOGUE })).length).toBe(5);
    }

    expect(ids(resolvePreferences({ dietaryPatterns: [], dislikedLabels: ['lácteos'], ingredients: CATALOGUE }))).toEqual(['i-yogur-griego-natural']);
  });

  it('reports what it could not resolve rather than pretending to enforce it', () => {
    const result = resolvePreferences({ dietaryPatterns: [], dislikedLabels: ['comida picante', 'salmón'], ingredients: CATALOGUE });

    expect(result.unenforceableLabels).toEqual(['comida picante']);
    expect(ids(result)).toEqual(['i-salmon', 'i-salmon-ahumado', 'i-salmon-congelado']);
  });

  it('reports a blank label as unenforceable rather than matching everything', () => {
    const result = resolvePreferences({ dietaryPatterns: [], dislikedLabels: ['   '], ingredients: CATALOGUE });

    expect(result.unenforceableLabels).toEqual(['']);
    expect(ids(result)).toEqual([]);
  });
});

describe('resolvePreferences — likes are a weight, not a rule', () => {
  it('resolves a liked label to the catalogue slugs it names, group words included', () => {
    const result = resolvePreferences({ dietaryPatterns: [], dislikedLabels: [], ingredients: CATALOGUE, likedLabels: ['pescado'] });

    expect([...result.preferredIngredientSlugs].sort()).toEqual(['merluza', 'salmon', 'salmon-ahumado', 'salmon-congelado', 'salmonete']);
  });

  it('leaves preferences empty when nothing liked was said, or nothing liked resolves', () => {
    expect(resolvePreferences({ dietaryPatterns: [], dislikedLabels: [], ingredients: CATALOGUE }).preferredIngredientSlugs.size).toBe(0);
    expect(
      resolvePreferences({ dietaryPatterns: [], dislikedLabels: [], ingredients: CATALOGUE, likedLabels: ['comida picante'] })
        .preferredIngredientSlugs.size
    ).toBe(0);
  });
});

describe('resolvePreferences — a way of eating', () => {
  it('keeps fish and shellfish off a vegetarian plate, and meat off a pescatarian one', () => {
    const vegetarian = resolvePreferences({ dietaryPatterns: ['vegetarian'], dislikedLabels: [], ingredients: CATALOGUE });

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

    const pescatarian = resolvePreferences({ dietaryPatterns: ['pescatarian'], dislikedLabels: [], ingredients: CATALOGUE });

    expect(ids(pescatarian)).toEqual(['i-lomo-de-cerdo', 'i-pechuga-de-pollo']);
  });

  it('leaves a vegan nothing of animal origin, honey included', () => {
    const result = resolvePreferences({ dietaryPatterns: ['vegan'], dislikedLabels: [], ingredients: CATALOGUE });

    expect(result.excludedIngredientIds.has('i-miel')).toBe(true);
    expect(ids(result)).not.toContain('i-lentejas-cocidas');
    expect(ids(result)).not.toContain('i-arroz-blanco-cocido');
  });

  it('excludes nothing for a pattern that is a direction rather than a rule', () => {
    // Halal and kosher are enforced now, as far as the catalogue can say
    // (see below); how meat was slaughtered it cannot, and does not claim to.
    for (const pattern of ['omnivore', 'flexitarian']) {
      expect(PATTERN_EXCLUSIONS[pattern]).toBeUndefined();
      expect(resolvePreferences({ dietaryPatterns: [pattern], dislikedLabels: [], ingredients: CATALOGUE }).excludedIngredientIds.size).toBe(0);
    }
  });

  it('adds a way of eating and a dislike together', () => {
    const result = resolvePreferences({ dietaryPatterns: ['vegetarian'], dislikedLabels: ['huevo'], ingredients: CATALOGUE });

    expect(result.excludedIngredientIds.has('i-huevo')).toBe(true);
    expect(result.excludedIngredientIds.has('i-pechuga-de-pollo')).toBe(true);
  });

  it('carries the cooking-time limit, and nothing when none was set', () => {
    expect(resolvePreferences({ dietaryPatterns: [], dislikedLabels: [], ingredients: CATALOGUE, maxMinutesPerDish: 25 }).maxMinutesPerDish).toBe(25);
    expect(resolvePreferences({ dietaryPatterns: [], dislikedLabels: [], ingredients: CATALOGUE }).maxMinutesPerDish).toBeNull();
  });

  it('is empty when nothing was said', () => {
    expect(resolvePreferences({ dietaryPatterns: [], dislikedLabels: [], ingredients: CATALOGUE }).excludedIngredientIds.size).toBe(0);
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
    const excluded = ids(resolvePreferences({ dietaryPatterns: ['halal'], dislikedLabels: [], ingredients: RELIGIOUS }));

    expect(excluded).toEqual(['i-gelatina-neutra', 'i-lomo-de-cerdo', 'i-manteca-de-cerdo', 'i-vino-blanco', 'i-vino-tinto']);
  });

  it('takes pork, shellfish, scaleless fish, alcohol and gelatine out for kosher', () => {
    const excluded = ids(resolvePreferences({ dietaryPatterns: ['kosher'], dislikedLabels: [], ingredients: RELIGIOUS }));

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
    const excluded = ids(resolvePreferences({ dietaryPatterns: ['kosher'], dislikedLabels: [], ingredients: RELIGIOUS }));

    expect(excluded).not.toContain('i-turron-de-jijona');
    expect(excluded).not.toContain('i-salmonete');
  });

  it('keeps meat from dairy only for kosher', () => {
    expect(resolvePreferences({ dietaryPatterns: ['kosher'], dislikedLabels: [], ingredients: RELIGIOUS }).keepsMeatFromDairy).toBe(true);
    expect(resolvePreferences({ dietaryPatterns: ['halal'], dislikedLabels: [], ingredients: RELIGIOUS }).keepsMeatFromDairy).toBe(false);
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
