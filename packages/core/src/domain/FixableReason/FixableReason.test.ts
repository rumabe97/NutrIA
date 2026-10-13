import { describe, expect, it } from 'vitest';

import { actionable, whyNotFixable } from 'core/domain/FixableReason';

import type { CandidateDish, Catalogue, CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { NotFixable } from 'core/domain/FixableReason';
import type { SafetyProfile } from 'core/entities/Safety';

function ingredient(slug: string, allergenId?: string): CatalogueIngredient {
  return {
    id: slug,
    allergens: allergenId ? [{ allergenId, presence: 'contains' as const }] : [],
    carbsPer100g: 10,
    category: 'other',
    classes: [],
    defaultUnit: 'g',
    fatPer100g: 1,
    fiberPer100g: 1,
    gramsPerUnit: null,
    kcalPer100g: 100,
    name: slug,
    proteinPer100g: 5,
    slug
  } as unknown as CatalogueIngredient;
}

const CATALOGUE: Catalogue = new Map([ingredient('patata'), ingredient('gamba', 'crustaceos')].map(each => [each.slug, each]));

function dish(over: Partial<CandidateDish> = {}): CandidateDish {
  return {
    cookMinutes: 20,
    cuisine: null,
    difficulty: 'easy',
    ingredients: [{ grams: 200, slug: 'patata' }],
    name: 'Patatas a la riojana',
    prepMinutes: 10,
    servings: 1,
    slots: ['lunch', 'dinner'],
    slug: 'patatas-a-la-riojana',
    // `minimumSteps` asks more of a dish that cooks for a quarter of an hour
    // (`METHOD_RULES`), so the fixture carries a real method and the one test
    // about a missing method is the one that empties it.
    steps: [
      { text: 'Pela y trocea las patatas.' },
      { cue: 'hasta que dore', minutes: 5, text: 'Sofríe la cebolla a fuego medio durante cinco minutos.' },
      { text: 'Añade las patatas y el pimentón.' },
      { minutes: 20, text: 'Cubre con caldo y cuece durante veinte minutos.' },
      { cue: 'hasta que espese', text: 'Deja reposar y sirve.' }
    ],
    ...over
  } as CandidateDish;
}

const NO_ALLERGIES: SafetyProfile = {
  allergenIds: new Set<string>(),
  crossContaminationAllergenIds: new Set<string>(),
  excludedIngredientIds: new Set<string>(),
  intoleranceAllergenIds: new Set<string>(),
  unenforceableLabels: []
};
const CONTEXT = { catalogue: CATALOGUE, disliked: new Set<string>(), maxMinutes: null, safety: NO_ALLERGIES };
const LUNCH: MealSlot = 'lunch';

describe('whyNotFixable', () => {
  it('says a dish is fixable when nothing removes it', () => {
    expect(whyNotFixable(dish(), LUNCH, CONTEXT, false, true)).toEqual({ fixable: true });
  });

  /*
   * The owner's own case, measured: `Patatas a la riojana con costilla y chorizo`
   * is 15 + 35 minutes, his profile said 30, and the screen showed him nothing.
   * Raising that one preference unlocked 102 dishes for him.
   */
  it('names the cooking time, which is the reason that looked like an empty library', () => {
    expect(whyNotFixable(dish({ cookMinutes: 35, prepMinutes: 15 }), LUNCH, { ...CONTEXT, maxMinutes: 30 }, false, true)).toEqual({
      fixable: false,
      why: 'too_slow'
    });
    // The same dish, the same person, one preference higher.
    expect(whyNotFixable(dish({ cookMinutes: 35, prepMinutes: 15 }), LUNCH, { ...CONTEXT, maxMinutes: 60 }, false, true)).toEqual({ fixable: true });
  });

  it('names the plate, which is the commonest reason and usually means another meal fits', () => {
    expect(whyNotFixable(dish(), LUNCH, CONTEXT, false, false)).toEqual({ fixable: false, why: 'too_big_or_small' });
  });

  it('names the slot, the dislike and the way of eating', () => {
    expect(whyNotFixable(dish({ slots: ['breakfast'] }), LUNCH, CONTEXT, false, true)).toEqual({ fixable: false, why: 'wrong_slot' });
    expect(whyNotFixable(dish(), LUNCH, { ...CONTEXT, disliked: new Set(['patatas-a-la-riojana']) }, false, true)).toEqual({
      fixable: false,
      why: 'disliked'
    });
    expect(whyNotFixable(dish(), LUNCH, CONTEXT, true, true)).toEqual({ fixable: false, why: 'excluded' });
  });

  it('refuses a recipe that never says how to cook it, which is this product’s fault and not theirs', () => {
    expect(whyNotFixable(dish({ steps: [] }), LUNCH, CONTEXT, false, true)).toEqual({ fixable: false, why: 'no_method' });
  });

  /*
   * Order is the whole of the usefulness: the first reason returned is the first
   * one the person would have to deal with, and an allergen outranks everything
   * because it is the only one that is a refusal rather than a route forward.
   */
  it('puts the allergen first, whatever else is also wrong', () => {
    const unsafe: SafetyProfile = { ...NO_ALLERGIES, allergenIds: new Set(['crustaceos']) };
    const prawns = dish({ cookMinutes: 90, ingredients: [{ grams: 100, slug: 'gamba' }], slots: ['breakfast'], steps: [] });

    expect(whyNotFixable(prawns, LUNCH, { ...CONTEXT, maxMinutes: 10, safety: unsafe }, true, false)).toEqual({ fixable: false, why: 'allergen' });
  });
});

describe('actionable', () => {
  it('separates what somebody can do something about from what they cannot', () => {
    const everything: readonly NotFixable[] = ['allergen', 'excluded', 'disliked', 'too_slow', 'no_method', 'wrong_slot', 'too_big_or_small'];

    expect(everything.filter(why => actionable(why))).toEqual(['excluded', 'disliked', 'too_slow', 'too_big_or_small']);
    // Never softened into advice: an allergen is a refusal, and a recipe with no
    // method is ours to fix, not theirs.
    expect(actionable('allergen')).toBe(false);
    expect(actionable('no_method')).toBe(false);
  });
});
