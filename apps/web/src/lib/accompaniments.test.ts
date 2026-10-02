import { describe, expect, it } from 'vitest';

import { accompanimentPhrase, accompanimentTitle } from './accompaniments';
import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';

import type { MealAccompaniment } from './accompaniments';

const bread: MealAccompaniment = { grams: 60, ingredients: [{ grams: 60, name: 'Pan blanco' }], kcal: 174, key: 'pan-blanco', name: 'Pan blanco' };
const orange: MealAccompaniment = { grams: 130, ingredients: [{ grams: 130, name: 'Naranja' }], kcal: 61, key: 'naranja', name: 'Naranja' };

describe('accompanimentPhrase', () => {
  it('weighs a bread and counts a fruit, in each language', () => {
    expect(accompanimentPhrase(bread, esES, 'es-ES')).toBe('pan (60 g)');
    expect(accompanimentPhrase(orange, esES, 'es-ES')).toBe('una naranja');
    expect(accompanimentPhrase(bread, enGB, 'en-GB')).toBe('bread (60 g)');
    expect(accompanimentPhrase(orange, enGB, 'en-GB')).toBe('an orange');
  });

  it('reads as the API name when the dictionary has no word for the key', () => {
    expect(accompanimentPhrase({ ...bread, key: 'something-new', name: 'Pan nuevo' }, esES, 'es-ES')).toBe('Pan nuevo');
  });

  it('starts a title with a capital', () => {
    expect(accompanimentTitle(orange, esES, 'es-ES')).toBe('Una naranja');
  });

  it('has the same keys in both languages', () => {
    expect(Object.keys(enGB.meal.accompanimentNames)).toEqual(Object.keys(esES.meal.accompanimentNames));
  });
});
