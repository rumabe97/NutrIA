import { describe, expect, it } from 'vitest';

import { hasUsableMethod, METHOD_RULES, minimumSteps } from 'core/domain/Method';

function dish(cookMinutes: number, stepCount: number): { cookMinutes: number; steps: readonly unknown[] } {
  return { cookMinutes, steps: Array.from({ length: stepCount }, (_, index) => ({ text: `step ${index}` })) };
}

describe('minimumSteps', () => {
  it('asks more of a dish that is cooked', () => {
    expect(minimumSteps(20)).toBe(METHOD_RULES.minStepsCooked);
    expect(minimumSteps(0)).toBe(METHOD_RULES.minStepsUncooked);
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
});
