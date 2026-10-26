import { describe, expect, it } from 'vitest';

import { INGREDIENT_SEED } from 'database/seed/ingredients';

import { COARSE_LABEL_TARGETS, resolvePantryLabel } from 'core/domain/Pantry';
import { normaliseForMatching } from 'core/domain/Safety';

/**
 * The coarse map against the real catalogue.
 *
 * `Pantry.test.ts` proves the resolver's shape on a fixture; this proves the
 * map's *contents*, which a fixture cannot: a target slug that is renamed or
 * dropped from the seed leaves *«tengo arroz»* covering no shopping row at all,
 * and nothing else in the product would notice — the entry is kept either way,
 * which is exactly what the failure looks like.
 */
describe('the coarse words name rows the catalogue really has', () => {
  const catalogue = INGREDIENT_SEED.map(ingredient => ({ id: ingredient.slug, name: ingredient.name, slug: ingredient.slug }));
  const seeded = new Set(INGREDIENT_SEED.map(ingredient => ingredient.slug));

  it.each(COARSE_LABEL_TARGETS)('%s is in the seed', slug => {
    expect(seeded.has(slug)).toBe(true);
  });

  it('resolves every coarse word against the catalogue as production has it', () => {
    // The map's keys are not exported, so this asks the resolver itself — which
    // is the thing that has to work — for the words the PRD names.
    for (const word of ['arroz', 'pasta', 'atun', 'pan', 'leche', 'aceite', 'harina', 'azucar', 'lentejas', 'garbanzos']) {
      expect(resolvePantryLabel(word, catalogue), word).not.toBeNull();
    }
  });

  it('leaves a word the catalogue already answers to the exact match, so the map never shadows a real row', () => {
    // `sal`, `huevo`, `cebolla`, `tomate` and `patata` are catalogue rows in
    // their own right. A coarse entry for one of them would be a second answer
    // to a question that already has one.
    for (const word of ['sal', 'huevo', 'cebolla', 'tomate', 'patata']) {
      const resolved = resolvePantryLabel(word, catalogue);

      expect(resolved, word).toBe(word);
    }
  });

  it('answers nothing for a word with thirty-eight candidates and no default', () => {
    expect(resolvePantryLabel('queso', catalogue)).toBeNull();
    expect(INGREDIENT_SEED.filter(ingredient => normaliseForMatching(ingredient.slug).startsWith('queso')).length).toBeGreaterThan(20);
  });
});
