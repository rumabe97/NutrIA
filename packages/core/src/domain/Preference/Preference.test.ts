import { describe, expect, it } from 'vitest';

import { NO_PREFERENCE_EXCLUSIONS, PATTERN_EXCLUSIONS, resolvePreferences, withinTime } from 'core/domain/Preference';
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

  it('excludes nothing for a pattern the catalogue cannot enforce', () => {
    // Halal and kosher are about how food was raised and prepared, which no
    // column here records; claiming to enforce them would be the lie.
    for (const pattern of ['halal', 'kosher', 'omnivore', 'flexitarian']) {
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

  it('counts prep and cooking together, against the limit', () => {
    expect(withinTime(dish(10, 20), 30)).toBe(true);
    expect(withinTime(dish(10, 21), 30)).toBe(false);
  });

  it('lets everything through when no limit was set', () => {
    expect(withinTime(dish(60, 120), null)).toBe(true);
  });
});
