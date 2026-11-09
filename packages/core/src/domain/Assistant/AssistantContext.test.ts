import { describe, expect, it } from 'vitest';

import { ASSISTANT_MAX_DAYS, ASSISTANT_MAX_NAMES, assistantContext, assistantFigures } from 'core/domain/Assistant';

import type { AssistantContextInput, AssistantDayInput } from 'core/domain/Assistant';

const TARGETS = { carbsG: 240.4, fatG: 68.6, fiberG: 30.04, kcal: 2079.4, proteinG: 129.5 };

function day(date: string): AssistantDayInput {
  return {
    date,
    meals: [
      {
        accompaniments: ['Pan integral', ' Pan integral ', ''],
        dish: ' Lentejas estofadas ',
        macros: { carbsG: 62, fatG: 21, fiberG: 9.44, kcal: 652.4, proteinG: 45 },
        slot: 'lunch'
      },
      { accompaniments: [], dish: 'Merluza', macros: { carbsG: 10, fatG: 9, fiberG: 1, kcal: 300, proteinG: 38 }, slot: 'dinner' }
    ],
    targets: TARGETS
  };
}

function input(overrides: Partial<AssistantContextInput> = {}): AssistantContextInput {
  return {
    cookingTimeMinutes: 30,
    cuisines: ['Mediterránea'],
    days: [day('2026-11-10')],
    dietaryPatterns: ['omnivore'],
    dislikedNames: [],
    excludedFoods: ['huevo'],
    goal: 'maintenance',
    kitchen: null,
    language: 'Spanish',
    likedFoods: [],
    lovedNames: [],
    slotShares: new Map([
      ['lunch', 0.33],
      ['dinner', 0.3]
    ]),
    targets: TARGETS,
    ...overrides
  };
}

describe('assistantFigures', () => {
  it('rounds the way a person reads a label: whole kilocalories and grams, fibre to a tenth', () => {
    expect(assistantFigures(TARGETS)).toEqual({ carbsG: 240, fatG: 69, fiberG: 30, kcal: 2079, proteinG: 130 });
    expect(assistantFigures({ carbsG: 0, fatG: 0, fiberG: 9.44, kcal: 0, proteinG: 0 }).fiberG).toBe(9.4);
  });
});

describe('assistantContext', () => {
  /**
   * The 2026-11-06 production read summed meals and their accompaniments and
   * reported a day 24 % over its target that was 1.5 % under it. Accompaniments
   * reach this type as names only, so the total cannot count them twice.
   */
  it('totals a day from its meals alone, because a meal already carries its accompaniments', () => {
    const [built] = assistantContext(input()).days;

    expect(built?.totals).toEqual({ carbsG: 72, fatG: 30, fiberG: 10.4, kcal: 952, proteinG: 83 });
    expect(built?.meals[0]?.accompaniments).toEqual(['Pan integral']);
  });

  it('keeps a day’s own targets, which an event day has different from the fortnight’s', () => {
    const party = { ...day('2026-11-11'), targets: { ...TARGETS, kcal: 2600 } };

    expect(assistantContext(input({ days: [party] })).days[0]?.targets.kcal).toBe(2600);
  });

  it('orders days oldest first and carries no more than a fortnight', () => {
    const many = Array.from({ length: 20 }, (_, index) => day(`2026-11-${String(30 - index).padStart(2, '0')}`));
    const built = assistantContext(input({ days: many }));

    expect(built.days).toHaveLength(ASSISTANT_MAX_DAYS);
    expect(built.days[0]?.date).toBe('2026-11-11');
  });

  it('trims a dish’s name and leaves an empty plan as a context, not an error', () => {
    expect(assistantContext(input()).days[0]?.meals[0]?.dish).toBe('Lentejas estofadas');
    expect(assistantContext(input({ days: [] })).days).toEqual([]);
  });

  it('turns the meal shape into whole percentages and drops a slot nobody eats', () => {
    const shares = new Map([
      ['lunch', 0.333],
      ['supper', 0]
    ] as const);

    expect(assistantContext(input({ slotShares: shares })).slotShares).toEqual({ lunch: 33 });
  });

  it('makes the same person the same prompt: names distinct, trimmed, ordered and bounded', () => {
    const loved = Array.from({ length: 60 }, (_, index) => `Plato ${String(index).padStart(2, '0')}`);
    const built = assistantContext(input({ cuisines: [' Japonesa', 'Mediterránea', 'Japonesa', ''], lovedNames: loved }));

    expect(built.cuisines).toEqual(['Japonesa', 'Mediterránea']);
    expect(built.lovedNames).toHaveLength(ASSISTANT_MAX_NAMES);
    expect(built.lovedNames[0]).toBe('Plato 00');
  });
});
