import { describe, expect, it } from 'vitest';

import { pantryKey, resolvePantryLabel } from 'core/domain/Pantry';

import type { MatchableIngredient } from 'core/domain/Safety';

/**
 * A slice of the catalogue shaped the way `listMatchableIngredients` returns it:
 * one row per name per locale, and several varieties of the one coarse word, so
 * the sixteen-rice problem is actually present in the fixture.
 */
const CATALOGUE: readonly MatchableIngredient[] = [
  { id: 'rice-long', name: 'Arroz largo', slug: 'arroz-largo-crudo' },
  { id: 'rice-long', name: 'Long grain rice', slug: 'arroz-largo-crudo' },
  { id: 'rice-bomba', name: 'Arroz bomba', slug: 'arroz-bomba-crudo' },
  { id: 'rice-basmati', name: 'Arroz basmati', slug: 'arroz-basmati-crudo' },
  { id: 'rice-cooked', name: 'Arroz blanco cocido', slug: 'arroz-blanco-cocido' },
  { id: 'pasta-macaroni', name: 'Macarrones', slug: 'macarrones-secos' },
  { id: 'pasta-cooked', name: 'Pasta cocida', slug: 'pasta-cocida' },
  { id: 'tuna-water', name: 'Atún al natural', slug: 'atun-al-natural' },
  { id: 'tuna-oil', name: 'Atún en aceite', slug: 'atun-en-aceite' },
  { id: 'onion', name: 'Cebolla', slug: 'cebolla' },
  { id: 'manchego', name: 'Queso manchego semicurado', slug: 'queso-manchego-semicurado' },
  { id: 'feta', name: 'Queso feta', slug: 'queso-feta' }
];

describe('resolvePantryLabel', () => {
  it('resolves the catalogue’s own name, which is what a picker sends', () => {
    expect(resolvePantryLabel('Arroz bomba', CATALOGUE)).toBe('rice-bomba');
  });

  it('resolves a slug, an accent and a stray case the same way, through the allergy matcher’s own normalisation', () => {
    expect(resolvePantryLabel('arroz-bomba-crudo', CATALOGUE)).toBe('rice-bomba');
    expect(resolvePantryLabel('ATUN AL NATURAL', CATALOGUE)).toBe('tuna-water');
    expect(resolvePantryLabel('  Atún al natural  ', CATALOGUE)).toBe('tuna-water');
  });

  it('takes the curated synonyms with it rather than keeping a second list', () => {
    // `cebollas` is in `SYNONYMS`, which this resolver reuses whole.
    expect(resolvePantryLabel('cebollas', CATALOGUE)).toBe('onion');
  });

  describe('a coarse word', () => {
    it('resolves «arroz» to the ordinary rice instead of asking which of sixteen it is', () => {
      expect(resolvePantryLabel('arroz', CATALOGUE)).toBe('rice-long');
    });

    it('takes the dry form, because a fortnight’s shopping row is named after the dry food (`0078`)', () => {
      expect(resolvePantryLabel('pasta', CATALOGUE)).toBe('pasta-macaroni');
      expect(resolvePantryLabel('pasta', CATALOGUE)).not.toBe('pasta-cooked');
    });

    it('answers nothing for a word with no ordinary answer, rather than picking one of thirty-eight cheeses', () => {
      expect(resolvePantryLabel('queso', CATALOGUE)).toBeNull();
    });

    it('answers nothing when its target has left the catalogue, instead of a row that is no longer there', () => {
      const withoutLongRice = CATALOGUE.filter(row => row.id !== 'rice-long');

      expect(resolvePantryLabel('arroz', withoutLongRice)).toBeNull();
    });
  });

  describe('an entry nothing answers', () => {
    it('is null and is never guessed from a near miss', () => {
      // No stemming, no substring, no edit distance: the three things that turn
      // a typo into a promise, refused here for the reason they are refused in
      // `matchCustomAllergen`.
      expect(resolvePantryLabel('arrozz', CATALOGUE)).toBeNull();
      expect(resolvePantryLabel('arroz largo integral de la tierra', CATALOGUE)).toBeNull();
      expect(resolvePantryLabel('sobrasada', CATALOGUE)).toBeNull();
    });

    it('is null for a word that is only punctuation, which has no key at all', () => {
      expect(resolvePantryLabel('---', CATALOGUE)).toBeNull();
    });
  });
});

describe('pantryKey', () => {
  it('is the one key the unresolved-label index and the resolver share', () => {
    expect(pantryKey('  Atún  al Natural ')).toBe('atun al natural');
    expect(pantryKey('Arroz')).toBe(pantryKey('arroz '));
  });
});
