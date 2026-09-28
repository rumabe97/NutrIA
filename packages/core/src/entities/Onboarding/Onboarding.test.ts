import { describe, expect, it } from 'vitest';

import { ONBOARDING_STEPS, REQUIRED_ONBOARDING_STEPS } from 'core/entities/Onboarding';

/**
 * Pinned as a literal, not as the constant compared with itself
 * (invariant-reviewer-2, `0067`): `REQUIRED_ONBOARDING_STEPS` is computed from
 * `ONBOARDING_STEPS.indexOf('review')`, and a test that re-derives the same
 * expression would pass even if the derivation itself were wrong — a slice
 * off by one, `review` renamed, `allergies` moved past it. The literal is
 * what a change to either has to answer to.
 */
describe('REQUIRED_ONBOARDING_STEPS', () => {
  it('is exactly the seven data steps — allergies in, review and create-plan out', () => {
    expect(REQUIRED_ONBOARDING_STEPS).toEqual(['about-you', 'goal', 'body-activity', 'how-you-eat', 'food-preferences', 'allergies', 'cooking']);
  });

  it('does not carry `lifestyle` — removed, and never required', () => {
    expect(ONBOARDING_STEPS).not.toContain('lifestyle');
    expect(REQUIRED_ONBOARDING_STEPS).not.toContain('lifestyle');
  });
});
