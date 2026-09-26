import { describe, expect, it } from 'vitest';

import { dishSafety } from 'core/domain/Safety';
import { toCatalogue } from 'core/entities/Plan';
import { ALLERGEN_IDS, makeCatalogueIngredient, makeSafetyProfile } from '#test/fixtures';

import { repairSlug } from './SlugRepair';

describe('repairSlug — a near miss of a slug the prompt showed', () => {
  const shown = ['perejil', 'tomate', 'limon', 'judia-verde', 'queso-fresco', 'aguacate'];

  it('repairs a trailing qualifier from the fixed list', () => {
    expect(repairSlug('perejil-fresco', shown)).toBe('perejil');
    expect(repairSlug('tomates-frescos', shown)).toBe('tomate');
    expect(repairSlug('aguacate-natural', shown)).toBe('aguacate');
  });

  it('repairs a plural or a singular, word by word, and folds accents and case', () => {
    expect(repairSlug('limones', shown)).toBe('limon');
    expect(repairSlug('judias-verdes', shown)).toBe('judia-verde');
    expect(repairSlug('Limón', shown)).toBe('limon');
  });

  it('repairs towards a shown slug that carries the qualifier itself', () => {
    expect(repairSlug('quesos-frescos', ['queso-fresco'])).toBe('queso-fresco');
  });

  it('repairs nothing when two shown slugs read the same — a guess is left unknown', () => {
    expect(repairSlug('perejil-fresco', ['perejil', 'perejiles'])).toBeNull();
    expect(repairSlug('quesos', ['queso', 'queso-fresco'])).toBeNull();
  });

  it('never repairs towards a slug the prompt did not show', () => {
    expect(repairSlug('gambas-frescas', shown)).toBeNull();
    expect(repairSlug('perejil-fresco', [])).toBeNull();
  });

  it('drops no other word, and nothing but one qualifier from the end', () => {
    expect(repairSlug('perejil-picado', shown)).toBeNull();
    expect(repairSlug('fresco-perejil', shown)).toBeNull();
    expect(repairSlug('tomate-cherry', shown)).toBeNull();
    // A qualifier alone is a slug of its own, not an empty one.
    expect(repairSlug('natural', shown)).toBeNull();
    expect(repairSlug('', shown)).toBeNull();
  });

  /*
   * The repair returns a slug and nothing else: the allergy gate then reads
   * it as it reads any slug, so a repaired allergen is still refused.
   */
  it('hands back a slug the allergy gate still refuses when it is an allergen', () => {
    const pan = makeCatalogueIngredient({
      id: 'ing-pan',
      allergens: [{ allergenId: ALLERGEN_IDS.gluten, presence: 'contains' }],
      name: 'Pan',
      slug: 'pan'
    });
    const repaired = repairSlug('pan-fresco', ['pan']);

    expect(repaired).toBe('pan');
    expect(dishSafety([{ slug: repaired ?? '' }], toCatalogue([pan]), makeSafetyProfile()).kind).toBe('unsafe');
  });
});
