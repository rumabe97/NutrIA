import { describe, expect, it } from 'vitest';

import { answerNamesAnAllergen, forbiddenFoods } from 'core/domain/Assistant';

import type { NetAllergen, NetIngredient } from 'core/domain/Assistant';
import type { SafetyProfile } from 'core/entities/Safety';

const ALLERGENS: readonly NetAllergen[] = [
  { id: 'a-egg', names: ['huevo', 'egg'] },
  { id: 'a-nuts', names: ['frutos de cáscara', 'tree nuts'] },
  { id: 'a-gluten', names: ['gluten'] },
  { id: 'a-tea', names: ['té'] },
  { id: 'a-nameless', names: [] }
];

const INGREDIENTS: readonly NetIngredient[] = [
  { id: 'i-egg', allergens: [{ allergenId: 'a-egg', presence: 'contains' }], names: ['huevo', 'egg'] },
  { id: 'i-mayo', allergens: [{ allergenId: 'a-egg', presence: 'contains' }], names: ['mayonesa', 'mayonnaise'] },
  { id: 'i-macadamia', allergens: [{ allergenId: 'a-nuts', presence: 'contains' }], names: ['nuez de macadamia', 'macadamia nut'] },
  { id: 'i-walnuts', allergens: [{ allergenId: 'a-nuts', presence: 'contains' }], names: ['nueces'] },
  { id: 'i-almonds', allergens: [{ allergenId: 'a-nuts', presence: 'contains' }], names: ['almendras'] },
  { id: 'i-chocolate', allergens: [{ allergenId: 'a-nuts', presence: 'may_contain' }], names: ['chocolate'] },
  { id: 'i-bread', allergens: [{ allergenId: 'a-gluten', presence: 'contains' }], names: ['pan', 'bread'] },
  { id: 'i-peas', allergens: [], names: ['guisantes'] },
  { id: 'i-potato', allergens: [], names: ['patata', 'potato'] },
  { id: 'i-nameless', allergens: [], names: [] }
];

function profile(overrides: Partial<SafetyProfile> = {}): SafetyProfile {
  return {
    allergenIds: new Set(['a-egg', 'a-nuts', 'a-tea', 'a-nameless']),
    crossContaminationAllergenIds: new Set(),
    excludedIngredientIds: new Set(['i-potato', 'i-peas', 'i-nameless']),
    intoleranceAllergenIds: new Set(),
    unenforceableLabels: ['kiwi dorado'],
    ...overrides
  };
}

function displays(foods: ReturnType<typeof forbiddenFoods>): readonly string[] {
  return foods.map(food => food.display);
}

describe('forbiddenFoods', () => {
  it('draws the line where the plate gate does: declared allergens, what contains them, and what the person excluded', () => {
    const foods = displays(forbiddenFoods(profile(), INGREDIENTS, ALLERGENS));

    expect(foods).toEqual([
      'huevo',
      'frutos de cáscara',
      'huevo',
      'mayonesa',
      'nuez de macadamia',
      'nueces',
      'almendras',
      'guisantes',
      'patata',
      'kiwi dorado'
    ]);
  });

  it('leaves out what only may contain an allergen, unless the person reacts to traces', () => {
    expect(displays(forbiddenFoods(profile(), INGREDIENTS, ALLERGENS))).not.toContain('chocolate');
    expect(displays(forbiddenFoods(profile({ crossContaminationAllergenIds: new Set(['a-nuts']) }), INGREDIENTS, ALLERGENS))).toContain('chocolate');
  });

  it('counts an intolerance as the plate gate does, blocking by default', () => {
    expect(displays(forbiddenFoods(profile({ intoleranceAllergenIds: new Set(['a-gluten']) }), INGREDIENTS, ALLERGENS))).toContain('pan');
  });

  /** Never sent to a model (prompt 4.0.0): searched for, after the answer, and withheld on — never told. */
  it('searches for an allergy that matched no catalogue row, and never tells the model about it', () => {
    const kiwi = forbiddenFoods(profile(), INGREDIENTS, ALLERGENS).find(food => food.display === 'kiwi dorado');

    expect(kiwi?.told).toBe(false);
  });

  it('drops a word too short to search for safely, and a food with no name at all', () => {
    expect(displays(forbiddenFoods(profile(), INGREDIENTS, ALLERGENS))).not.toContain('té');
  });
});

/**
 * The longest table in the phase, on purpose: this is the only net in the
 * product with nothing stronger behind it.
 */
describe('answerNamesAnAllergen', () => {
  const forbidden = forbiddenFoods(profile(), INGREDIENTS, ALLERGENS);

  it.each([
    ['a food it cannot eat, even to say use something else', 'En vez de huevo, usa plátano maduro.', 'huevo'],
    ['its plural', 'Unos huevos revueltos con espinacas.', 'huevo'],
    ['its name in the other language', 'Add a spoon of mayonnaise.', 'mayonesa'],
    ['a food that contains it', 'Una mayonesa casera queda mejor.', 'mayonesa'],
    ['the plural of a word ending in z', 'Añade unas nueces de macadamia.', 'nuez de macadamia'],
    ['the singular of a word ending in ces', 'Una nuez picada por encima.', 'nueces'],
    ['the singular of a word ending in s', 'Una almendra tostada.', 'almendras'],
    ['the singular of a word ending in es', 'Un guisante no hace daño.', 'guisantes'],
    ['the way people write it, from the curated list', 'Unas papas cocidas.', 'patata'],
    ['an allergen named outright', 'Evita los frutos de cáscara.', 'frutos de cáscara'],
    ['a free-text allergy nobody could match', 'Termina con un kiwi dorado.', 'kiwi dorado'],
    ['upper case and accents', 'HUEVO DURO', 'huevo']
  ])('withholds %s', (_case, answer, display) => {
    expect(answerNamesAnAllergen(answer, forbidden)?.display).toBe(display);
  });

  it.each([
    ['the same question answered the way the prompt asks', 'Puedes usar plátano maduro o semillas de lino.'],
    ['a word that merely contains a forbidden one', 'Sírvelo en una huevera de cerámica.'],
    ['what the person may eat', 'Un pan integral con tomate.']
  ])('shows %s', (_case, answer) => {
    expect(answerNamesAnAllergen(answer, forbidden)).toBeNull();
  });
});
