import { describe, expect, it } from 'vitest';

import { alternativesFor } from 'core/domain/Substitution';
import { toSafetyProfile } from 'core/domain/Safety';

import type { SubstituteCandidate } from 'core/domain/Substitution';

const lentils = { carbsPer100g: 16.3, fatPer100g: 0.4, kcalPer100g: 116, proteinPer100g: 9 };

function candidate(name: string, overrides: Partial<SubstituteCandidate> = {}): SubstituteCandidate {
  return { id: name, allergens: [], carbsPer100g: 20, fatPer100g: 1, kcalPer100g: 130, name, proteinPer100g: 8, ratio: 1, ...overrides };
}

const nobody = toSafetyProfile([], []);

describe('alternativesFor', () => {
  it('drops a substitute the person is allergic to, rather than warning about it', () => {
    const seitan = candidate('Seitán', { allergens: [{ allergenId: 'gluten', presence: 'contains' }] });
    const tofu = candidate('Tofu firme', { allergens: [{ allergenId: 'soy', presence: 'contains' }] });
    const coeliac = toSafetyProfile([{ allergenId: 'gluten', crossContaminationSensitive: false }], []);

    expect(alternativesFor(lentils, 100, [seitan, tofu], coeliac).map(a => a.name)).toEqual(['Tofu firme']);
  });

  it('drops a trace-level substitute only for someone sensitive to traces', () => {
    const traces = candidate('Anacardos', { allergens: [{ allergenId: 'peanuts', presence: 'may_contain' }] });
    const allergic = toSafetyProfile([{ allergenId: 'peanuts', crossContaminationSensitive: false }], []);
    const sensitive = toSafetyProfile([{ allergenId: 'peanuts', crossContaminationSensitive: true }], []);

    expect(alternativesFor(lentils, 100, [traces], allergic)).toHaveLength(1);
    expect(alternativesFor(lentils, 100, [traces], sensitive)).toHaveLength(0);
  });

  it('honours a free-text allergy that resolved to the substitute itself', () => {
    const chickpeas = candidate('Garbanzos cocidos', { id: 'chickpeas' });
    const profile = toSafetyProfile([], [], [{ ingredientId: 'chickpeas', label: 'garbanzos' }]);

    expect(alternativesFor(lentils, 100, [chickpeas], profile)).toHaveLength(0);
  });

  it('puts the nutritionally closest substitute first', () => {
    const far = candidate('Salmón', { fatPer100g: 12, kcalPer100g: 200, proteinPer100g: 20 });
    const near = candidate('Alubias blancas', { carbsPer100g: 18, fatPer100g: 0.5, kcalPer100g: 120, proteinPer100g: 8.5 });

    expect(alternativesFor(lentils, 100, [far, near], nobody).map(a => a.name)).toEqual(['Alubias blancas', 'Salmón']);
  });

  it('shows at most three, and scales the weight by the ratio', () => {
    const many = ['a', 'b', 'c', 'd'].map(name => candidate(name));
    const shown = alternativesFor(lentils, 150, many, nobody);

    expect(shown).toHaveLength(3);
    expect(alternativesFor(lentils, 150, [candidate('Harina', { ratio: 2 })], nobody)).toEqual([{ grams: 300, name: 'Harina' }]);
  });
});
