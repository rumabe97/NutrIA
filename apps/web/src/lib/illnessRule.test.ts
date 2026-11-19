import { describe, expect, it } from 'vitest';

import { illnessEndedBody, unverifiedProfessional } from './illnessRule';

describe('illnessEndedBody', () => {
  it('explains a declaration with its own sentence and the sweep with the badge one', () => {
    expect(illnessEndedBody({ reason: 'declared' })).toBe('illnessEndedBody');
    expect(illnessEndedBody({ reason: 'badge_lost' })).toBe('illnessEndedBadgeBody');
  });

  it('reads an answer without a reason as the sweep, the only ending it once reported', () => {
    expect(illnessEndedBody({})).toBe('illnessEndedBadgeBody');
  });
});

describe('unverifiedProfessional', () => {
  it('names the practitioner of a link without the badge', () => {
    expect(unverifiedProfessional({ professionalName: 'Ana Pérez', professionalVerified: false })).toBe('Ana Pérez');
  });

  it('warns about nobody under a verified practitioner', () => {
    expect(unverifiedProfessional({ professionalName: 'Ana Pérez', professionalVerified: true })).toBeNull();
  });

  it('warns about nobody without a link, or when the care read failed', () => {
    expect(unverifiedProfessional(null)).toBeNull();
    expect(unverifiedProfessional(undefined)).toBeNull();
  });
});
