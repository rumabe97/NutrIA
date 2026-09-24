import { describe, expect, it } from 'vitest';

import { acceptInvitationSchema, CARE_CONSENT_VERSION, CARE_HEALTH_SHARED, CARE_SHARED, inviteClientSchema } from './Care';

describe('what a link shares', () => {
  /*
   * Pinned together on purpose. A client agreed to *this* list at *this*
   * version; changing one without the other would store a consent to a list
   * nobody read. Changing either is a new version and new copy (Phase 8).
   */
  it('is this list at this version', () => {
    expect(CARE_CONSENT_VERSION).toBe('1.0.0');
    expect(CARE_SHARED).toEqual(['profile', 'targets', 'mealPlans', 'progress', 'checkIns']);
    expect(CARE_HEALTH_SHARED).toEqual(['conditions', 'medications', 'supplements']);
  });

  it('keeps health out of the main list', () => {
    expect(CARE_SHARED.some(item => (CARE_HEALTH_SHARED as readonly string[]).includes(item))).toBe(false);
  });
});

describe('inviteClientSchema', () => {
  it('trims and lowercases the address before checking it', () => {
    expect(inviteClientSchema.parse({ email: '  Ana@Example.COM ' })).toEqual({ email: 'ana@example.com' });
  });

  it('refuses what is not an address', () => {
    for (const email of ['', 'ana', 'ana@', '@example.com', `${'a'.repeat(250)}@example.com`]) {
      expect(inviteClientSchema.safeParse({ email }).success).toBe(false);
    }
  });

  it('carries the address and nothing else', () => {
    expect(inviteClientSchema.parse({ email: 'ana@example.com', professionalId: 'usr-x', sharesHealth: true })).toEqual({ email: 'ana@example.com' });
  });
});

describe('acceptInvitationSchema', () => {
  it('takes the current version and a yes or no to the health line', () => {
    expect(acceptInvitationSchema.parse({ consentVersion: CARE_CONSENT_VERSION, sharesHealth: true })).toEqual({
      consentVersion: CARE_CONSENT_VERSION,
      sharesHealth: true
    });
  });

  it('refuses another version, and a missing health answer', () => {
    expect(acceptInvitationSchema.safeParse({ consentVersion: '0.9.0', sharesHealth: false }).success).toBe(false);
    expect(acceptInvitationSchema.safeParse({ consentVersion: CARE_CONSENT_VERSION }).success).toBe(false);
  });
});
