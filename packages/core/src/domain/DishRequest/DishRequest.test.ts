import { describe, expect, it } from 'vitest';

import { dishVocabulary, MAX_DISH_REQUEST, storableName } from 'core/domain/DishRequest';

import type { Catalogue, CatalogueIngredient } from 'core/entities/Plan';

function ingredient(name: string, slug: string): CatalogueIngredient {
  return {
    id: slug,
    allergens: [],
    carbsPer100g: 0,
    category: 'other',
    classes: [],
    defaultUnit: 'g',
    fatPer100g: 0,
    fiberPer100g: 0,
    gramsPerUnit: null,
    kcalPer100g: 0,
    name,
    proteinPer100g: 0,
    slug
  } as unknown as CatalogueIngredient;
}

const CATALOGUE: Catalogue = new Map(
  [
    ingredient('Patata', 'patata'),
    ingredient('Huevo', 'huevo'),
    ingredient('Cebolla', 'cebolla'),
    ingredient('Chorizo', 'chorizo'),
    ingredient('Costilla de cerdo', 'costilla-de-cerdo')
  ].map(each => [each.slug, each])
);

const LIBRARY = ['Tortilla de patatas con gambas y espinacas', 'Patatas a la riojana con costilla y chorizo'];
const VOCABULARY = dishVocabulary(CATALOGUE, LIBRARY);
const NOBODY = { health: [], name: 'Probe' };

describe('the vocabulary a stored dish name may use', () => {
  it('is built from the catalogue, the library and the cooking words, so it grows with the library', () => {
    expect(VOCABULARY.has('patata')).toBe(true);
    // From the library's own names, not from the catalogue.
    expect(VOCABULARY.has('tortilla')).toBe(true);
    expect(VOCABULARY.has('riojana')).toBe(true);
    // A cooking word nobody had to write into a recipe.
    expect(VOCABULARY.has('plancha')).toBe(true);
    // And nothing it was never given.
    expect(VOCABULARY.has('metformina')).toBe(false);
  });

  it('is accent- and case-blind, because a name is written however somebody writes it', () => {
    expect(storableName('TORTILLA DE PATATAS', VOCABULARY, NOBODY)).toEqual({ ok: true });
    expect(storableName('Tortilla de patatás', VOCABULARY, NOBODY)).toEqual({ ok: true });
  });
});

describe('storableName', () => {
  it('stores a dish named out of food and cooking words', () => {
    expect(storableName('Tortilla de patatas con cebolla', VOCABULARY, NOBODY)).toEqual({ ok: true });
    expect(storableName('Patatas a la riojana con chorizo', VOCABULARY, NOBODY)).toEqual({ ok: true });
    expect(storableName('Huevo a la plancha con patata asada', VOCABULARY, NOBODY)).toEqual({ ok: true });
  });

  /*
   * The risk this exists for: the model echoing the request into the name it
   * writes, which is how a typed word reaches the shared library and the
   * picture prompt that goes to Google. Each of these is a name a model could
   * plausibly return if somebody typed it.
   */
  it('refuses a name that says a person', () => {
    expect(storableName('Tortilla de patatas para mi hijo', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'says_a_person' });
    expect(storableName('Omelette for my daughter', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'says_a_person' });
    expect(storableName('Tortilla como a ti te gusta', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'says_a_person' });
  });

  it('refuses a name carrying this account’s own name or its health words, whatever the vocabulary says', () => {
    const person = { health: ['Diabetes tipo 2', 'Metformina'], name: 'Ana Velasco' };

    expect(storableName('Tortilla de patatas para la diabetes', VOCABULARY, person)).toEqual({ ok: false, reason: 'says_a_person' });
    expect(storableName('Tortilla de patatas de Velasco', VOCABULARY, person)).toEqual({ ok: false, reason: 'says_a_person' });
    // The same name is fine for somebody those words are not about.
    expect(storableName('Tortilla de patatas de Velasco', dishVocabulary(CATALOGUE, [...LIBRARY, 'Velasco']), NOBODY)).toEqual({ ok: true });
  });

  it('refuses a name with a word this product has never used for food', () => {
    expect(storableName('Tortilla de patatas con metformina', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'unknown_words' });
    expect(storableName('Tortilla de patatas, celiaquia desde 2019', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'unknown_words' });
  });

  it('refuses anything that is not the shape of a name', () => {
    expect(storableName('', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'not_a_name' });
    expect(storableName('   ', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'not_a_name' });
    expect(storableName('Tortilla de patatas\ny otra cosa', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'not_a_name' });
    expect(storableName('¿Tortilla de patatas?', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'not_a_name' });
    expect(storableName('Tortilla de patatas ana@correo.com', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'not_a_name' });
    expect(storableName(`Tortilla ${'de patatas '.repeat(20)}`, VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'not_a_name' });
  });

  it('allows a number, because a dish name may count what is in it', () => {
    expect(storableName('Tortilla de 3 huevos', VOCABULARY, NOBODY)).toEqual({ ok: true });
  });

  /*
   * The cost of erring towards dropping, stated rather than hidden: a real dish
   * is refused for one word this product has never used. That is the right
   * direction — a refused dish is a sentence, a stored one is in front of
   * everybody for ever and on its way to Google in a picture prompt — and it
   * gets rarer as the library grows, because the library is the vocabulary.
   */
  it('refuses a real dish whose word the library has never seen, and that is the price', () => {
    expect(storableName('Shakshuka de huevo', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'unknown_words' });
    expect(storableName('Shakshuka de huevo', dishVocabulary(CATALOGUE, [...LIBRARY, 'Shakshuka clásica']), NOBODY)).toEqual({ ok: true });
  });

  /*
   * The catalogue names an ingredient in the singular and a dish names it in
   * the plural. Matched word for word, the vocabulary refused half the real
   * names in the library — which is how this test came to exist.
   */
  it('reads a plural as the singular the catalogue holds, and the other way round', () => {
    expect(storableName('Tortilla de patatas con cebollas', VOCABULARY, NOBODY)).toEqual({ ok: true });
    expect(storableName('Tortilla de patata con huevo', VOCABULARY, NOBODY)).toEqual({ ok: true });
    expect(storableName('Costillas con patatas', VOCABULARY, NOBODY)).toEqual({ ok: true });
    // And it loosens the vocabulary only: an unknown word stays unknown either way.
    expect(storableName('Tortilla de metforminas', VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'unknown_words' });
  });

  it('holds the length bound it publishes', () => {
    expect(storableName('a'.repeat(MAX_DISH_REQUEST + 1), VOCABULARY, NOBODY)).toEqual({ ok: false, reason: 'not_a_name' });
  });
});
