import { describe, expect, it } from 'vitest';

import {
  bestEffortExclusions,
  matchCustomAllergen,
  mentionsUnresolvedAllergy,
  normaliseForMatching,
  resolveCustomAllergens,
  toMatchIndex
} from 'core/domain/Safety';

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

describe('bestEffortExclusions — what an unresolved allergy takes out, never claimed as enforced', () => {
  const rows: readonly MatchableIngredient[] = [
    { id: 'nueces', name: 'Nueces', slug: 'nueces' },
    { id: 'nueces-pecanas', name: 'Nueces pecanas', slug: 'nueces-pecanas' },
    { id: 'macadamia', name: 'Macadamia', slug: 'macadamia' },
    { id: 'arroz', name: 'Arroz', slug: 'arroz' },
    { id: 'pan-de-centeno', name: 'Pan de centeno', slug: 'pan-de-centeno' }
  ];

  it('removes every row sharing a whole word with the label, whatever its case or accents', () => {
    expect([...bestEffortExclusions(['Nueces de MACADAMIA'], rows)].sort()).toEqual(['macadamia', 'nueces', 'nueces-pecanas']);
  });

  it('ignores the words that name no food, and keeps the three-letter foods', () => {
    expect([...bestEffortExclusions(['con de'], rows)]).toEqual([]);
    expect([...bestEffortExclusions(['pan de centeno'], rows)]).toEqual(['pan-de-centeno']);
    expect([...bestEffortExclusions(['ajo'], [...rows, { id: 'ajo', name: 'Ajo', slug: 'ajo' }])]).toEqual(['ajo']);
  });

  it('folds singular and plural both ways: nuez meets nueces, gambas meets gamba', () => {
    const more = [
      ...rows,
      { id: 'gamba-roja', name: 'Gamba roja', slug: 'gamba-roja' },
      { id: 'tomates-cherry', name: 'Tomates cherry', slug: 'tomates-cherry' }
    ];

    expect([...bestEffortExclusions(['nuez'], more)].sort()).toEqual(['nueces', 'nueces-pecanas']);
    expect([...bestEffortExclusions(['gambas'], more)]).toEqual(['gamba-roja']);
    expect([...bestEffortExclusions(['tomate'], more)]).toEqual(['tomates-cherry']);
  });

  it('keeps a one-word label whatever its length', () => {
    expect([...bestEffortExclusions(['té'], [{ id: 'te-verde', name: 'Té verde', slug: 'te-verde' }])]).toEqual(['te-verde']);
  });

  it('removes nothing for nothing', () => {
    expect(bestEffortExclusions([], rows).size).toBe(0);
    expect(bestEffortExclusions(['   '], rows).size).toBe(0);
  });

  it('matches whole words, not runs of letters: "arrocería" is not "arroz"', () => {
    expect([...bestEffortExclusions(['arroceria'], rows)]).toEqual([]);
  });
});

describe('mentionsUnresolvedAllergy — the name and the method, checked in code', () => {
  const dish = (name: string, ...steps: string[]) => ({ name, steps: steps.map(text => ({ text })) });

  it('refuses a dish whose name, steps or cue name the allergy, in any number and accent', () => {
    expect(mentionsUnresolvedAllergy(dish('Ensalada con nueces'), ['nuez'])).toBe(true);
    expect(mentionsUnresolvedAllergy(dish('Ensalada', 'Añadir las NUECES al final'), ['nuez'])).toBe(true);
    expect(mentionsUnresolvedAllergy({ name: 'Ensalada', steps: [{ cue: 'hasta que la nuez se dore', text: 'Tostar' }] }, ['nueces'])).toBe(true);
  });

  it('lets a dish through that names none of it, and does nothing without a label', () => {
    expect(mentionsUnresolvedAllergy(dish('Ensalada verde', 'Aliñar y servir'), ['nuez'])).toBe(false);
    expect(mentionsUnresolvedAllergy(dish('Ensalada con nueces'), [])).toBe(false);
  });
});
