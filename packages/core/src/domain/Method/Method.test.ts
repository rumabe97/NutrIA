import { describe, expect, it } from 'vitest';

import { hasUsableMethod, isMethodComplete, METHOD_RULES, minimumSteps } from 'core/domain/Method';

function dish(cookMinutes: number, stepCount: number): { cookMinutes: number; steps: readonly unknown[] } {
  return { cookMinutes, steps: Array.from({ length: stepCount }, (_, index) => ({ text: `step ${index}` })) };
}

function withMethod(
  cookMinutes: number,
  steps: readonly { readonly cue?: string; readonly minutes?: number; readonly text: string }[]
): { cookMinutes: number; steps: readonly { readonly cue?: string; readonly minutes?: number; readonly text: string }[] } {
  return { cookMinutes, steps };
}

describe('minimumSteps', () => {
  it('asks more of a dish that is cooked, and more again of one that cooks a while', () => {
    expect(minimumSteps(0)).toBe(METHOD_RULES.minStepsUncooked);
    expect(minimumSteps(9)).toBe(METHOD_RULES.minStepsCooked);
    expect(minimumSteps(METHOD_RULES.longCookMinutes)).toBe(METHOD_RULES.minStepsCookedLong);
    expect(minimumSteps(45)).toBe(METHOD_RULES.minStepsCookedLong);
  });
});

describe('hasUsableMethod', () => {
  it('rejects a dish with no method at all', () => {
    expect(hasUsableMethod(dish(0, 0))).toBe(false);
  });

  it('accepts one honest sentence for something assembled', () => {
    expect(hasUsableMethod(dish(0, 1))).toBe(true);
  });

  it('rejects a single step for something that goes on the heat', () => {
    expect(hasUsableMethod(dish(25, 1))).toBe(false);
  });

  it('accepts a cooked dish that says how', () => {
    expect(hasUsableMethod(dish(25, 4))).toBe(true);
  });

  it('rejects three steps for a dish that cooks a quarter of an hour — that is three actions per sentence', () => {
    expect(hasUsableMethod(dish(25, 3))).toBe(false);
    expect(hasUsableMethod(dish(10, 3))).toBe(true);
  });
});

/**
 * The gap eleven library recipes had: stamped by the current prompt, with
 * enough steps (`hasUsableMethod`) but not one cue between them.
 */
describe('isMethodComplete', () => {
  it('asks nothing of an assembled dish beyond having a method at all', () => {
    expect(isMethodComplete(withMethod(0, [{ text: 'Spoon the yoghurt over the fruit' }]))).toBe(true);
    expect(isMethodComplete(withMethod(0, []))).toBe(false);
  });

  it('rejects a cooked dish with no cue anywhere, however many minutes are recorded', () => {
    expect(
      isMethodComplete(
        withMethod(20, [
          { minutes: 3, text: 'Sear the pork' },
          { minutes: 4, text: 'Add the mushrooms' },
          { minutes: 3, text: 'Stir in the rice' },
          { minutes: 2, text: 'Plate' }
        ])
      )
    ).toBe(false);
  });

  it('treats an empty or blank cue as no cue', () => {
    expect(
      isMethodComplete(
        withMethod(20, [
          { cue: '', minutes: 3, text: 'Sear' },
          { minutes: 4, text: 'Add' },
          { minutes: 3, text: 'Stir' },
          { cue: '   ', minutes: 2, text: 'Plate' }
        ])
      )
    ).toBe(false);
  });

  it('rejects a briefly cooked dish with a cue on every step but no duration anywhere', () => {
    expect(
      isMethodComplete(
        withMethod(8, [
          { cue: 'until golden', text: 'Toast the bread' },
          { cue: 'until melted', text: 'Melt the cheese on top' }
        ])
      )
    ).toBe(false);
  });

  it('accepts a cooked dish with a cue and a duration somewhere, without demanding both on every step', () => {
    expect(
      isMethodComplete(
        withMethod(10, [{ cue: 'until browned', minutes: 3, text: 'Sear the pork' }, { minutes: 4, text: 'Add the mushrooms' }, { text: 'Plate' }])
      )
    ).toBe(true);
  });

  it('rejects a cooked dish that has neither enough steps nor a cue', () => {
    expect(isMethodComplete(withMethod(25, [{ text: 'Cook it' }]))).toBe(false);
  });
});
