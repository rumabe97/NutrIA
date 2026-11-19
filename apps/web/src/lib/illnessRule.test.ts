import { describe, expect, it } from 'vitest';

import { illnessEndedBody, unverifiedProfessional } from './illnessRule';

describe('illnessEndedBody', () => {
  it('explains a declaration with its own sentence and the sweep with the badge one', () => {
    expect(illnessEndedBody({ reason: 'declared' })).toBe('illnessEndedBody');
    expect(illnessEndedBody({ reason: 'badge_lost' })).toBe('illnessEndedBadgeBody');
  });

  it('gives each ending its own sentence, never the same one for both', () => {
    expect(illnessEndedBody({ reason: 'declared' })).not.toBe(illnessEndedBody({ reason: 'badge_lost' }));
  });
});

describe('unverifiedProfessional', () => {
  it('names the practitioner of a link without the badge', () => {
    expect(unverifiedProfessional({ professionalName: 'Ana Pérez', professionalVerified: false })).toEqual({ name: 'Ana Pérez' });
  });

  /* PRD 025: a name that may not be shown comes as null, and the warning stands without it. */
  it('still warns when the practitioner’s name may not be shown', () => {
    expect(unverifiedProfessional({ professionalName: null, professionalVerified: false })).toEqual({ name: null });
  });

  it('warns about nobody under a verified practitioner', () => {
    expect(unverifiedProfessional({ professionalName: 'Ana Pérez', professionalVerified: true })).toBeNull();
  });

  it('warns about nobody without a link, or when the care read failed', () => {
    expect(unverifiedProfessional(null)).toBeNull();
    expect(unverifiedProfessional(undefined)).toBeNull();
  });
});
