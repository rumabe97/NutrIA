import { describe, expect, it } from 'vitest';

import { matchCustomAllergen, normaliseForMatching, resolveCustomAllergens, toMatchIndex } from 'core/domain/Safety';

import type { MatchableIngredient } from 'core/domain/Safety';

/** A slice of the real seeded catalogue, names and slugs verbatim. */
const CATALOGUE: readonly MatchableIngredient[] = [
  { id: 'ing-brocoli', name: 'Brócoli', slug: 'brocoli' },
  { id: 'ing-brocoli-congelado', name: 'Brócoli congelado', slug: 'brocoli-congelado' },
  { id: 'ing-cacahuetes', name: 'Cacahuetes', slug: 'cacahuetes' },
  { id: 'ing-gambas', name: 'Gambas', slug: 'gambas' },
  { id: 'ing-kiwi', name: 'Kiwi', slug: 'kiwi' },
  { id: 'ing-mejillon', name: 'Mejillón', slug: 'mejillon' },
  { id: 'ing-pimiento-rojo', name: 'Pimiento rojo', slug: 'pimiento-rojo' },
  { id: 'ing-platano', name: 'Plátano', slug: 'platano' }
];

const INDEX = toMatchIndex(CATALOGUE);

describe('normaliseForMatching', () => {
  it('folds accents and case so a person and the catalogue meet in the middle', () => {
    expect(normaliseForMatching('Brócoli')).toBe('brocoli');
    expect(normaliseForMatching('MEJILLÓN')).toBe('mejillon');
  });

  it('flattens the punctuation that separates a slug from a name', () => {
    expect(normaliseForMatching('pimiento-rojo')).toBe('pimiento rojo');
    expect(normaliseForMatching('Pimiento rojo')).toBe('pimiento rojo');
  });

  it('trims and collapses whitespace someone typed', () => {
    expect(normaliseForMatching('  kiwi   ')).toBe('kiwi');
  });
});

describe('matchCustomAllergen', () => {
  it('matches the catalogue name exactly, accents and all', () => {
    expect(matchCustomAllergen('Brócoli', INDEX)).toBe('ing-brocoli');
  });

  it('matches the slug too, since a name and its slug normalise alike', () => {
    expect(matchCustomAllergen('pimiento-rojo', INDEX)).toBe('ing-pimiento-rojo');
  });

  it('matches a curated synonym', () => {
    expect(matchCustomAllergen('cacahuete', INDEX)).toBe('ing-cacahuetes');
    expect(matchCustomAllergen('maní', INDEX)).toBe('ing-cacahuetes');
    expect(matchCustomAllergen('banana', INDEX)).toBe('ing-platano');
  });

  it('refuses a word naming a group rather than an ingredient', () => {
    // `marisco` covers gambas, mejillón, almeja, calamar and pulpo. Resolving it
    // to one of them would exclude that one and leave the rest on the plate under
    // an interface saying the allergy was enforced. No match is the safe answer.
    expect(matchCustomAllergen('marisco', INDEX)).toBeNull();
    expect(matchCustomAllergen('frutos secos', INDEX)).toBeNull();
    expect(matchCustomAllergen('lácteos', INDEX)).toBeNull();
  });

  it('refuses a near miss rather than guessing', () => {
    expect(matchCustomAllergen('brocolis', INDEX)).toBeNull();
    expect(matchCustomAllergen('kiwii', INDEX)).toBeNull();
    expect(matchCustomAllergen('gamba de rio', INDEX)).toBeNull();
  });

  it('refuses a substring of a catalogue name', () => {
    // 'pimiento' is inside 'pimiento rojo'. Substring matching would resolve it,
    // and would just as happily resolve 'te' against half the catalogue.
    expect(matchCustomAllergen('pimiento', INDEX)).toBeNull();
  });

  it('matches nothing for empty or punctuation-only text', () => {
    expect(matchCustomAllergen('   ', INDEX)).toBeNull();
    expect(matchCustomAllergen('---', INDEX)).toBeNull();
  });
});

describe('toMatchIndex', () => {
  it('keeps two similarly named ingredients apart', () => {
    expect(matchCustomAllergen('brocoli', INDEX)).toBe('ing-brocoli');
    expect(matchCustomAllergen('brocoli congelado', INDEX)).toBe('ing-brocoli-congelado');
  });

  it('drops a key two different ingredients claim rather than picking one', () => {
    const clashing = toMatchIndex([
      { id: 'ing-a', name: 'Kiwi', slug: 'kiwi-verde' },
      { id: 'ing-b', name: 'Kiwi', slug: 'kiwi-amarillo' }
    ]);

    expect(matchCustomAllergen('kiwi', clashing)).toBeNull();
    // The unambiguous keys still work — only the contested one is withdrawn.
    expect(matchCustomAllergen('kiwi-verde', clashing)).toBe('ing-a');
  });
});

describe('resolveCustomAllergens', () => {
  it('keeps the text as typed while resolving a normalised copy', () => {
    expect(resolveCustomAllergens(['  Brócoli '], CATALOGUE)).toEqual([{ ingredientId: 'ing-brocoli', label: 'Brócoli' }]);
  });

  it('records an unmatched entry rather than dropping it', () => {
    // Storing it is the point: it has to reach the screen that says we cannot
    // guarantee it, and the prompt that names it as forbidden.
    expect(resolveCustomAllergens(['marisco'], CATALOGUE)).toEqual([{ ingredientId: null, label: 'marisco' }]);
  });

  it('separates matched from unmatched in one list', () => {
    const resolved = resolveCustomAllergens(['kiwi', 'marisco'], CATALOGUE);

    expect(resolved).toHaveLength(2);
    expect(resolved.filter(entry => entry.ingredientId !== null)).toHaveLength(1);
  });

  it('drops blanks and repeats of the same word', () => {
    expect(resolveCustomAllergens(['kiwi', '  ', 'KIWI', 'Kiwi'], CATALOGUE)).toEqual([{ ingredientId: 'ing-kiwi', label: 'kiwi' }]);
  });

  it('does nothing at all with an empty list', () => {
    expect(resolveCustomAllergens([], CATALOGUE)).toEqual([]);
  });
});
