import { describe, expect, it } from 'vitest';

import {
  allergenKeysForConditions,
  CONDITION_EXCLUSIONS,
  CONDITION_SUGGESTIONS,
  conditionImplications,
  supervisionRecommended,
  supplementProteinG
} from 'core/domain/Health';

import type { ConditionKey, HealthCondition, Medication, Supplement } from 'core/entities/Health';

function condition(conditionKey: ConditionKey | null, label = 'algo'): HealthCondition {
  return { id: '11111111-2222-4333-8444-555555555555', conditionKey, label };
}

function supplement(proteinGPerServing: number | null, servingsPerDay = 1): Supplement {
  return { id: '11111111-2222-4333-8444-555555555555', name: 'Proteína', proteinGPerServing, servingsPerDay };
}

const NOTHING: ReadonlyMap<ConditionKey, readonly string[]> = new Map();

describe('the signed-off maps', () => {
  /**
   * Pinned exactly, both of them.
   *
   * This is not a change-detector for its own sake: the contents are a clinical
   * sign-off recorded in `docs/decisions/0008-condition-exclusions.md`, and an
   * addition made without one should fail a test rather than pass a review.
   * Changing these expectations is the deliberate act of saying the decision
   * changed.
   */
  it('applies exactly one condition automatically: coeliac disease excludes gluten', () => {
    expect([...CONDITION_EXCLUSIONS.entries()]).toEqual([['coeliac', ['gluten']]]);
  });

  it('offers exactly one, because tolerating some lactose is normal and we do not decide the degree', () => {
    expect([...CONDITION_SUGGESTIONS.entries()]).toEqual([['lactose_intolerance', ['lactose']]]);
  });

  it('keeps the two apart — nothing is both applied and offered', () => {
    const applied = new Set(CONDITION_EXCLUSIONS.keys());

    expect([...CONDITION_SUGGESTIONS.keys()].filter(key => applied.has(key))).toEqual([]);
  });

  it('infers nothing for the conditions ruled out as individualised prescriptions', () => {
    // Diabetes, hypertension, kidney disease and gout all have well-known
    // dietary advice, and all of it is a quantity target set with a clinician.
    // A meal planner that acted on them would be writing a prescription.
    const ruledOut = [condition('type_2_diabetes'), condition('hypertension'), condition('chronic_kidney_disease'), condition('gout')];

    expect(allergenKeysForConditions(ruledOut, CONDITION_EXCLUSIONS)).toEqual([]);
    expect(allergenKeysForConditions(ruledOut, CONDITION_SUGGESTIONS)).toEqual([]);
  });
});

describe('conditionImplications', () => {
  it('names the condition responsible, so a screen can say why', () => {
    const map = new Map<ConditionKey, readonly string[]>([['coeliac', ['gluten']]]);

    expect(conditionImplications([condition('coeliac', 'Celiaquía')], map)).toEqual([{ allergenKey: 'gluten', conditionLabel: 'Celiaquía' }]);
  });

  it('reports the same allergen once per condition that implies it', () => {
    // Deduplication belongs to the safety profile, which cares about the set.
    // The display cares about the causes, and there may be two.
    const map = new Map<ConditionKey, readonly string[]>([
      ['coeliac', ['gluten']],
      ['ibs', ['gluten']]
    ]);

    expect(conditionImplications([condition('coeliac', 'Celiaquía'), condition('ibs', 'SII')], map)).toHaveLength(2);
  });
});

describe('allergenKeysForConditions', () => {
  it('infers nothing from a condition with no signed-off mapping', () => {
    expect(allergenKeysForConditions([condition('type_2_diabetes')], NOTHING)).toEqual([]);
  });

  it('infers nothing from free text, whatever it says', () => {
    // The one thing that must never happen: reading an unrecognised word and
    // deciding what it implies about someone's food.
    expect(allergenKeysForConditions([condition(null, 'alergia al trigo severa')], new Map([['coeliac', ['gluten']]]))).toEqual([]);
  });

  it('returns the allergen keys a signed-off mapping names', () => {
    const map = new Map<ConditionKey, readonly string[]>([['coeliac', ['gluten']]]);

    expect(allergenKeysForConditions([condition('coeliac')], map)).toEqual(['gluten']);
  });

  it('deduplicates when two conditions imply the same allergen', () => {
    const map = new Map<ConditionKey, readonly string[]>([
      ['coeliac', ['gluten']],
      ['ibs', ['gluten', 'lactose']]
    ]);

    expect([...allergenKeysForConditions([condition('coeliac'), condition('ibs')], map)].sort()).toEqual(['gluten', 'lactose']);
  });

  it('is empty for someone who recorded nothing', () => {
    expect(allergenKeysForConditions([], new Map([['coeliac', ['gluten']]]))).toEqual([]);
  });
});

describe('supervisionRecommended', () => {
  it('is false when nothing is recorded', () => {
    expect(supervisionRecommended([], [])).toBe(false);
  });

  it('is raised by a condition', () => {
    expect(supervisionRecommended([condition('gout')], [])).toBe(true);
  });

  it('is raised by a medication', () => {
    const medication: Medication = { id: '11111111-2222-4333-8444-555555555555', name: 'Sintrom' };

    expect(supervisionRecommended([], [medication])).toBe(true);
  });

  it('does not grade what was recorded', () => {
    // Two conditions are not "more supervised" than one, and no key counts for
    // more than another. Grading severity is the medical reasoning this product
    // refuses to do, and a boolean is the shape of that refusal.
    expect(supervisionRecommended([condition('pregnancy')], [])).toBe(supervisionRecommended([condition('gerd'), condition('gout')], []));
  });
});

describe('supplementProteinG', () => {
  it('is zero without supplements', () => {
    expect(supplementProteinG([])).toBe(0);
  });

  it('multiplies protein per serving by servings per day', () => {
    expect(supplementProteinG([supplement(25, 2)])).toBe(50);
  });

  it('counts a supplement with no declared protein as zero rather than guessing one', () => {
    expect(supplementProteinG([supplement(null, 3)])).toBe(0);
  });

  it('sums across supplements and rounds once, at the end', () => {
    expect(supplementProteinG([supplement(20.5, 1), supplement(4.2, 2)])).toBe(29);
  });
});
