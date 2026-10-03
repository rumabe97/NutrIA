import { describe, expect, it } from 'vitest';

import { SNACK_KIND_SLOTS, SNACK_RULES, snackCheck, snackKind } from 'core/domain/Variety';
import { makeCatalogue, makeCatalogueIngredient, makeDish } from '#test/fixtures';

const catalogue = makeCatalogue([
  makeCatalogueIngredient({ id: 'i-yogur', category: 'dairy', slug: 'yogur-proteico' }),
  makeCatalogueIngredient({ id: 'i-skyr', category: 'dairy', slug: 'skyr' }),
  makeCatalogueIngredient({ id: 'i-requeson', category: 'dairy', slug: 'requeson' }),
  makeCatalogueIngredient({ id: 'i-burgos', category: 'dairy', slug: 'queso-de-burgos' }),
  makeCatalogueIngredient({ id: 'i-biscotes', category: 'bakery', slug: 'tostas-de-centeno' }),
  makeCatalogueIngredient({ id: 'i-jamon', category: 'protein', classes: ['animal', 'meat', 'pork'], slug: 'jamon-serrano' }),
  makeCatalogueIngredient({ id: 'i-atun', category: 'protein', slug: 'atun-al-natural' }),
  makeCatalogueIngredient({ id: 'i-uva', category: 'produce', slug: 'uva' }),
  makeCatalogueIngredient({ id: 'i-almendra', category: 'pantry', slug: 'almendras' }),
  makeCatalogueIngredient({ id: 'i-agua', category: 'beverages', slug: 'agua' })
]);

function snack(...items: [string, number][]) {
  return makeDish({ ingredients: items.map(([slug, grams]) => ({ grams, slug })), slots: ['morning_snack'] });
}

describe('snackKind', () => {
  it('names a yoghurt cup by the yoghurt, whatever fruit is on it (a real plan: six cups on fourteen mornings)', () => {
    expect(snackKind(snack(['yogur-proteico', 200], ['uva', 250], ['almendras', 15]), catalogue)).toBe('yogur');
    expect(snackKind(snack(['skyr', 170], ['uva', 80]), catalogue)).toBe('yogur');
  });

  it('calls every fresh cheese one kind, and anything on bread one kind', () => {
    expect(snackKind(snack(['requeson', 120], ['tostas-de-centeno', 30]), catalogue)).toBe('queso-fresco');
    expect(snackKind(snack(['queso-de-burgos', 80], ['uva', 100]), catalogue)).toBe('queso-fresco');
    expect(snackKind(snack(['tostas-de-centeno', 60], ['jamon-serrano', 40]), catalogue)).toBe('pan');
  });

  it('names the rest by their protein, or their first word', () => {
    expect(snackKind(snack(['atun-al-natural', 80], ['uva', 50]), catalogue)).toBe('atun');
    expect(snackKind(snack(['jamon-serrano', 60]), catalogue)).toBe('cerdo');
    expect(snackKind(snack(['almendras', 30], ['uva', 150]), catalogue)).toBe('almendras');
  });

  it('is null for a snack of fruit and water alone', () => {
    expect(snackKind(snack(['uva', 150], ['agua', 200]), catalogue)).toBeNull();
  });
});

describe('SNACK_RULES — the same kind of snack three times a fortnight', () => {
  it('is pinned, and counts only the snacks', () => {
    expect(SNACK_RULES).toEqual({ apart: false, perFortnight: 3 });
    expect([...SNACK_KIND_SLOTS].sort()).toEqual(['afternoon_snack', 'morning_snack', 'supper']);
    expect(snackCheck([{ ...snack(['skyr', 170]), slug: 'cup' }], catalogue).slots).toBe(SNACK_KIND_SLOTS);
  });
});
