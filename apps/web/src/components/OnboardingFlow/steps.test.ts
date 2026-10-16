import { describe, expect, it } from 'vitest';

import { ONBOARDING_STEPS } from 'core/entities/Onboarding';

import { FLOW, TOTAL_STEPS } from './steps';

/**
 * The server's `resumeStep` is a position in `ONBOARDING_STEPS`, and
 * `/onboarding/[paso]` reads it as a position in `FLOW`. Two lists in the same
 * order is not enough — they have to agree position by position, and a step
 * added to the API's list without being added here turns the resume address
 * into a 404 for everybody whose first missing step sits after it. That is
 * exactly what the kitchen did between project 021's phase 4 and phase 5.
 */
describe('FLOW', () => {
  it('sits at the same positions as the API’s own list, up to the review step', () => {
    expect(FLOW.map(step => step.key)).toEqual(ONBOARDING_STEPS.slice(0, ONBOARDING_STEPS.indexOf('review') + 1));
  });

  it('stops at the review step: plan generation is a screen of its own, not a step of this flow', () => {
    expect(FLOW.at(-1)?.key).toBe('review');
    expect(TOTAL_STEPS).toBe(ONBOARDING_STEPS.length - 1);
  });

  it('names a dictionary key for every step, none of them repeated', () => {
    const copy = FLOW.map(step => step.copy);

    expect(new Set(copy).size).toBe(copy.length);
  });
});
