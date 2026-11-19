import { describe, expect, it } from 'vitest';
import { careConsentScope, careLinkEndedBy } from 'database/schema';

import {
  acceptInvitationSchema,
  CARE_CONSENT_SCOPES,
  CARE_CONSENT_VERSION,
  CARE_HEALTH_SHARED,
  CARE_LINK_ENDED_BY,
  CARE_RULE_ENDINGS,
  CARE_SHARED,
  CARE_SHARED_PLAN,
  endedByForPractitioner,
  inviteClientSchema,
  reconsentLinkSchema,
  setLinkHealthSchema
} from './Care';

describe('what a link shares', () => {
  /*
   * Pinned together on purpose. A client agreed to *this* list at *this*
   * version; changing one without the other would store a consent to a list
   * nobody read. Changing either is a new version and new copy (Phase 8).
   */
  it('is this list at this version', () => {
    expect(CARE_CONSENT_VERSION).toBe('3.0.0');
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
  it('takes the list read, the current version and a yes or no to the health line', () => {
    expect(acceptInvitationSchema.parse({ consentScope: 'full', consentVersion: CARE_CONSENT_VERSION, sharesHealth: true })).toEqual({
      consentScope: 'full',
      consentVersion: CARE_CONSENT_VERSION,
      sharesHealth: true
    });
  });

  it('refuses another version, and a missing health answer', () => {
    expect(acceptInvitationSchema.safeParse({ consentVersion: '0.9.0', sharesHealth: false }).success).toBe(false);
    // The version before `textos/05` § B: the list it named did not say the professional writes plans.
    expect(acceptInvitationSchema.safeParse({ consentVersion: '1.0.0', sharesHealth: false }).success).toBe(false);
    expect(acceptInvitationSchema.safeParse({ consentVersion: CARE_CONSENT_VERSION }).success).toBe(false);
  });
});

describe('setLinkHealthSchema', () => {
  it('takes a yes or no to the health line, and nothing else', () => {
    expect(setLinkHealthSchema.parse({ linkId: 'x', sharesHealth: true, status: 'ended' })).toEqual({ sharesHealth: true });
  });

  it('refuses a missing answer or one that is not a boolean', () => {
    expect(setLinkHealthSchema.safeParse({}).success).toBe(false);
    expect(setLinkHealthSchema.safeParse({ sharesHealth: 'false' }).success).toBe(false);
  });
});

describe('what a link consented to (project 025)', () => {
  it('is the badged list or the plan only, as the database names them', () => {
    expect(CARE_CONSENT_SCOPES).toEqual(['full', 'plan']);
    expect(careConsentScope.enumValues).toEqual([...CARE_CONSENT_SCOPES]);
  });

  it('lists what an un-badged practitioner sees, in the order the client reads it (`textos/05` § F.3)', () => {
    expect(CARE_SHARED_PLAN).toEqual(['profile', 'plans', 'status']);
  });

  it('requires the list the client read — nothing is presumed from its absence — and takes nothing but the two lists', () => {
    expect(acceptInvitationSchema.parse({ consentScope: 'plan', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false })).toEqual({
      consentScope: 'plan',
      consentVersion: CARE_CONSENT_VERSION,
      sharesHealth: false
    });
    expect(acceptInvitationSchema.safeParse({ consentVersion: CARE_CONSENT_VERSION, sharesHealth: false }).success).toBe(false);
    expect(acceptInvitationSchema.safeParse({ consentScope: 'everything', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false }).success).toBe(
      false
    );
  });

  it('re-consents only at the current version', () => {
    expect(reconsentLinkSchema.parse({ consentScope: 'plan', consentVersion: CARE_CONSENT_VERSION })).toEqual({
      consentVersion: CARE_CONSENT_VERSION
    });
    expect(reconsentLinkSchema.safeParse({ consentVersion: '1.0.0' }).success).toBe(false);
    expect(reconsentLinkSchema.safeParse({}).success).toBe(false);
  });
});

/*
 * Legal F4 (PRD 025 criterion 22, PLAN phase 5 step 5): a practitioner may only
 * ever be told that they ended a link or that the client did — every other
 * cause, the illness rule's `badge_lost` included, reads as `client`, because a
 * distinct label would tell them which client has something on record.
 */
describe('who ended a link, as a practitioner may read it', () => {
  it('names every value the database holds, the illness rule’s two appended last', () => {
    expect(careLinkEndedBy.enumValues).toEqual([...CARE_LINK_ENDED_BY]);
    expect(CARE_LINK_ENDED_BY.slice(-2)).toEqual(['badge_lost', 'declared']);
    expect(CARE_RULE_ENDINGS).toEqual(['badge_lost', 'declared']);
  });

  it.each(CARE_LINK_ENDED_BY.map(value => [value, value === 'professional' ? 'professional' : 'client'] as const))(
    '`%s` reads as `%s`',
    (value, shown) => {
      expect(endedByForPractitioner(value)).toBe(shown);
    }
  );
});
