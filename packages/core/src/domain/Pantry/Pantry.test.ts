import { describe, expect, it } from 'vitest';

import { cookedWith, pantryCatalogueMatches, pantryKey, platesAsBought, resolvePantryLabel } from 'core/domain/Pantry';

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

describe('platesAsBought', () => {
  it('gives the dry food the plates its cooked counterpart carries', () => {
    // `arroz-blanco-cocido` is what 28 of this library's plates carry;
    // `arroz-largo-crudo` is what «tengo arroz» resolves to and what the list
    // buys. Without the mapping the rice we cook most looks uncooked-with.
    const counted = platesAsBought(new Map([['arroz-blanco-cocido', 28]]));

    expect(counted.get('arroz-largo-crudo')).toBe(28);
  });

  it('leaves the cooked food counted under its own name as well, for somebody who types that', () => {
    const counted = platesAsBought(new Map([['arroz-blanco-cocido', 28]]));

    expect(counted.get('arroz-blanco-cocido')).toBe(28);
  });

  it('adds to a dry food that is already plated in its own right rather than replacing its count', () => {
    const counted = platesAsBought(
      new Map([
        ['arroz-blanco-cocido', 28],
        ['arroz-largo-crudo', 3]
      ])
    );

    expect(counted.get('arroz-largo-crudo')).toBe(31);
  });

  it('keeps a cooked food with no dry row under its own name, instead of dropping it on a null', () => {
    // `pasta-cocida`'s `drySlug` is null — it is bought "en seco" — so the null
    // check is load-bearing and not defensive noise.
    const counted = platesAsBought(new Map([['pasta-cocida', 3]]));

    expect(counted.get('pasta-cocida')).toBe(3);
    expect([...counted.keys()]).toEqual(['pasta-cocida']);
  });

  it('leaves a food that is nothing’s cooked form exactly as it found it', () => {
    expect([...platesAsBought(new Map([['cebolla', 5]]))]).toEqual([['cebolla', 5]]);
  });
});

describe('pantryCatalogueMatches', () => {
  it('matches the middle of a name, which is where a picker is typed as often as the start', () => {
    expect(pantryCatalogueMatches('natural', CATALOGUE)).toEqual(new Set(['tuna-water']));
  });

  it('matches a slug, since the slug is a key of the resolver’s own index', () => {
    expect(pantryCatalogueMatches('arroz-bomba', CATALOGUE)).toEqual(new Set(['rice-bomba']));
  });

  it('carries the coarse words, so the row an add would land on is the row offered', () => {
    // «arroz» is a substring of four rice names here *and* a coarse word for
    // `arroz-largo-crudo`; the one the resolver answers must be among them.
    expect(pantryCatalogueMatches('arroz', CATALOGUE)?.has('rice-long')).toBe(true);
  });

  it('carries the curated synonyms with it, as the resolver does', () => {
    expect(pantryCatalogueMatches('cebollas', CATALOGUE)).toEqual(new Set(['onion']));
  });

  it('matches a name in another locale, because the index holds every locale', () => {
    expect(pantryCatalogueMatches('long grain', CATALOGUE)).toEqual(new Set(['rice-long']));
  });

  it('offers every food for no word at all, and for a word that normalises to nothing', () => {
    expect(pantryCatalogueMatches('', CATALOGUE)).toBeNull();
    expect(pantryCatalogueMatches('🍅', CATALOGUE)).toBeNull();
  });

  it('answers nothing for a word the catalogue cannot, rather than the nearest thing', () => {
    // `queso` is deliberately absent from the coarse map — thirty-eight cheeses
    // and no default — so the two cheeses it is a substring of are the only
    // answer, and a bare «sobrasada» gets none at all.
    expect(pantryCatalogueMatches('sobrasada', CATALOGUE)?.size).toBe(0);
  });
});

describe('cookedWith', () => {
  const PLATED: ReadonlyMap<string, number> = new Map([['cebolla', 5]]);

  it('is true for a food the library cooks', () => {
    expect(cookedWith('cebolla', PLATED)).toBe(true);
  });

  it('is true for a food the library only ever serves beside a plate', () => {
    // Served every week, listed by almost no recipe: being told we cook nothing
    // with the bread would be the product lying about itself.
    expect(cookedWith('pan-integral', new Map())).toBe(true);
    expect(cookedWith('aceite-de-oliva-virgen-extra', new Map())).toBe(true);
    expect(cookedWith('sal', new Map())).toBe(true);
    expect(cookedWith('yogur-natural-desnatado', new Map())).toBe(true);
  });

  it('credits the dry food a cooked side is bought as, through the same mapping as the plates', () => {
    // `cuscus-crudo` is in the accompaniment catalogue; were it the cooked slug
    // there, the cupboard's own word would still have to be answered.
    expect(cookedWith('cuscus-crudo', new Map())).toBe(true);
  });

  it('is false for a food in the catalogue that the library neither cooks nor serves', () => {
    expect(cookedWith('sobrasada', new Map())).toBe(false);
  });

  it('takes the sides as a floor and never as an order — a side alone still counts no plates', () => {
    // The ordering reads `platesAsBought`, not this: a food the library only
    // serves as a side is answered honestly and still sorts last.
    expect(platesAsBought(new Map()).get('sal')).toBeUndefined();
    expect(cookedWith('sal', new Map())).toBe(true);
  });
});
