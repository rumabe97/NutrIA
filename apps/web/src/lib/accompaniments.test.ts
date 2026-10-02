import { ACCOMPANIMENTS } from 'core/domain/Accompaniment';
import { describe, expect, it } from 'vitest';

import { accompanimentAdds, accompanimentIsSingle, accompanimentPhrase, accompanimentTitle } from './accompaniments';
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

  it('has a phrase for every accompaniment core can offer, in both languages', () => {
    const keys = ACCOMPANIMENTS.map(accompaniment => accompaniment.key);

    expect(keys.filter(key => !(key in esES.meal.accompanimentNames))).toEqual([]);
    expect(keys.filter(key => !(key in enGB.meal.accompanimentNames))).toEqual([]);
  });

  it('says kcal once at the end of a heading, in each language', () => {
    for (const [dictionary, locale] of [
      [esES, 'es-ES'],
      [enGB, 'en-GB']
    ] as const) {
      for (const side of [bread, orange]) {
        expect(accompanimentAdds(side, dictionary, locale).split('kcal')).toHaveLength(2);
      }
    }
  });

  it('puts the weight of a lone fruit on its heading line, and not again for a weighed bread', () => {
    expect(accompanimentAdds(orange, esES, 'es-ES')).toBe('130 g · +61 kcal');
    expect(accompanimentAdds(bread, esES, 'es-ES')).toBe('+174 kcal');
  });

  it('keeps the rows of a composed side', () => {
    const salad: MealAccompaniment = {
      grams: 106,
      ingredients: [
        { grams: 80, name: 'Lechuga' },
        { grams: 5, name: 'Aceite' }
      ],
      kcal: 63,
      key: 'ensalada-verde',
      name: 'Ensalada verde'
    };

    expect(accompanimentIsSingle(salad)).toBe(false);
    expect(accompanimentIsSingle(orange)).toBe(true);
    expect(accompanimentIsSingle({ ...bread, name: 'Pan' })).toBe(false);
  });
});
