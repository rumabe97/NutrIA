import { describe, expect, it } from 'vitest';
import { badgeChannel, badgeCheckKind, practiceRestrictionKind, priceUnit } from 'database/schema';

import {
  acceptAgreementSchema,
  BADGE_CHANNELS,
  BADGE_CHECK_KINDS,
  grantProfessionalSchema,
  PRACTICE_RESTRICTION_KINDS,
  practiceRestrictionSchema,
  PRICE_UNITS,
  PROFESSIONAL_AGREEMENT_VERSION,
  professionalBadgeCheckSchema,
  professionalBadgeCodeSchema,
  professionalHoursSchema,
  professionalProfileSchema,
  professionalSchema,
  PROFILE_STUDIES_MAX
} from './Professional';

/*
 * Not a restatement of the schema: this body is the one thing that can make an
 * account a professional (`0059`), so what it refuses is a rule worth pinning —
 * and what it strips is the acceptance criterion that no other field rides in.
 */
describe('grantProfessionalSchema', () => {
  it.each(['MAD00123', 'CV-0456', '12/3456', 'abc', 'A'.repeat(20)])('accepts %s', value => {
    expect(grantProfessionalSchema.parse({ collegiateNumber: value })).toEqual({ collegiateNumber: value });
  });

  it('trims before it measures', () => {
    expect(grantProfessionalSchema.parse({ collegiateNumber: '  MAD00123  ' })).toEqual({ collegiateNumber: 'MAD00123' });
  });

  it.each([
    ['too short', 'ab'],
    ['too long', 'A'.repeat(21)],
    ['a space inside', 'MAD 00123'],
    ['punctuation the registers do not use', 'MAD.00123'],
    ['only spaces', '      '],
    ['empty', '']
  ])('refuses %s', (_label, value) => {
    expect(grantProfessionalSchema.safeParse({ collegiateNumber: value }).success).toBe(false);
  });

  it('refuses a body with no number: the grant is never a declaration', () => {
    expect(grantProfessionalSchema.safeParse({}).success).toBe(false);
  });

  it('strips anything else the body carries — a role, a practice, a client count', () => {
    const parsed = grantProfessionalSchema.parse({ collegiateNumber: 'MAD00123', includedClients: 99, practiceOpen: true, role: 'admin' });

    expect(parsed).toEqual({ collegiateNumber: 'MAD00123' });
  });
});

/* The agreement is accepted at the version the professional read (`docs/legal/textos/01`), never another. */
describe('acceptAgreementSchema', () => {
  it('is at 1.1.0 (PLAN 011 phase 6): a new version is a deliberate change, and asks every professional again', () => {
    expect(PROFESSIONAL_AGREEMENT_VERSION).toBe('1.1.0');
  });

  it('accepts the current version', () => {
    expect(acceptAgreementSchema.parse({ version: PROFESSIONAL_AGREEMENT_VERSION })).toEqual({ version: PROFESSIONAL_AGREEMENT_VERSION });
  });

  it.each([
    ['an older version', '0.9.0'],
    ['a later one', '2.0.0'],
    ['nothing', undefined],
    ['a boolean', true]
  ])('refuses %s', (_label, version) => {
    expect(acceptAgreementSchema.safeParse({ version }).success).toBe(false);
  });
});

/*
 * The database sits below core and repeats these lists as Postgres enums; a
 * value on one side only is an "invalid input value for enum" at runtime that no
 * type-check sees (the `Kitchen.test.ts` pattern).
 */
describe('the badge, profile and restriction lists match the database (project 025)', () => {
  it('names the same check kinds, channels, price units and restrictions, in order', () => {
    expect(badgeCheckKind.enumValues).toEqual([...BADGE_CHECK_KINDS]);
    expect(badgeChannel.enumValues).toEqual([...BADGE_CHANNELS]);
    expect(priceUnit.enumValues).toEqual([...PRICE_UNITS]);
    expect(practiceRestrictionKind.enumValues).toEqual([...PRACTICE_RESTRICTION_KINDS]);
  });

  it('has three channels, all read from the public register: the college-issued e-mail was dropped (C12)', () => {
    expect(BADGE_CHANNELS).toEqual(['register_email', 'post', 'phone']);
  });
});

describe('professionalSchema (project 025)', () => {
  const row = {
    id: '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b',
    agreementAcceptedAt: null,
    agreementVersion: null,
    createdAt: new Date(),
    grantedAt: new Date(),
    grantedBy: null,
    includedClients: 0,
    practiceOpen: false,
    updatedAt: new Date(),
    userId: 'usr-pro'
  };

  it('reads a practice opened by its own account, which has no number', () => {
    expect(professionalSchema.parse({ ...row, collegiateNumber: null }).collegiateNumber).toBeNull();
  });

  it('still reads a grant of project 004 with its number', () => {
    expect(professionalSchema.parse({ ...row, collegiateNumber: 'MAD00123' }).collegiateNumber).toBe('MAD00123');
  });
});

describe('professionalHoursSchema', () => {
  const closed: { from: string; to: string }[] = [];

  it('takes seven days from Monday, each a list of ranges, an empty one closed', () => {
    const week = [
      [
        { from: '09:00', to: '14:00' },
        { from: '16:00', to: '20:00' }
      ],
      closed,
      closed,
      closed,
      closed,
      closed,
      closed
    ];

    expect(professionalHoursSchema.parse(week)).toEqual(week);
  });

  it.each([
    ['six days', Array.from({ length: 6 }, () => closed)],
    ['eight days', Array.from({ length: 8 }, () => closed)],
    ['a range that ends before it starts', [[{ from: '14:00', to: '09:00' }], closed, closed, closed, closed, closed, closed]],
    ['a time that is not HH:MM', [[{ from: '9:00', to: '14:00' }], closed, closed, closed, closed, closed, closed]],
    ['an hour past 23', [[{ from: '09:00', to: '24:00' }], closed, closed, closed, closed, closed, closed]]
  ])('refuses %s', (_label, hours) => {
    expect(professionalHoursSchema.safeParse(hours).success).toBe(false);
  });
});

describe('professionalProfileSchema', () => {
  const profile = {
    id: '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b',
    createdAt: new Date(),
    displayName: 'Ana',
    hiddenAt: null,
    hiddenReason: null,
    hours: null,
    priceCents: 4500,
    priceUnit: 'consultation',
    queuedAt: new Date(),
    seenAt: null,
    seenBy: null,
    studies: null,
    updatedAt: new Date(),
    userId: 'usr-pro'
  };

  it('reads a profile as the table holds it', () => {
    expect(professionalProfileSchema.parse(profile).displayName).toBe('Ana');
  });

  it('holds studies up to the limit the database enforces, and not one character more', () => {
    expect(professionalProfileSchema.safeParse({ ...profile, studies: 'a'.repeat(PROFILE_STUDIES_MAX) }).success).toBe(true);
    expect(professionalProfileSchema.safeParse({ ...profile, studies: 'a'.repeat(PROFILE_STUDIES_MAX + 1) }).success).toBe(false);
  });

  it('refuses a price unit the practice cannot have', () => {
    expect(professionalProfileSchema.safeParse({ ...profile, priceUnit: 'session' }).success).toBe(false);
  });
});

describe('the badge record and its code', () => {
  it('reads the backfilled pass of a project 004 grant: no channel, its reason, a due date', () => {
    const check = professionalBadgeCheckSchema.parse({
      id: '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b',
      channel: null,
      checkedAt: new Date(),
      checkedBy: null,
      createdAt: new Date(),
      dueAt: new Date(),
      kind: 'pass',
      number: 'MAD00123',
      reason: 'project 004 grant',
      register: null,
      updatedAt: new Date(),
      userId: 'usr-pro'
    });

    expect(check.kind).toBe('pass');
  });

  it('keeps a code as its hash and never a contact', () => {
    expect(Object.keys(professionalBadgeCodeSchema.shape).sort()).toEqual(
      ['attempts', 'channel', 'checkId', 'codeHash', 'createdAt', 'expiresAt', 'id', 'updatedAt', 'usedAt', 'userId'].sort()
    );
  });
});

describe('practiceRestrictionSchema', () => {
  it('reads a closing row with the date it closes', () => {
    const effectiveAt = new Date('2026-12-18T00:00:00.000Z');
    const row = practiceRestrictionSchema.parse({
      id: '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b',
      actedAt: new Date(),
      actedBy: null,
      createdAt: new Date(),
      effectiveAt,
      kind: 'closing',
      reason: 'statement of reasons',
      updatedAt: new Date(),
      userId: 'usr-pro'
    });

    expect(row.effectiveAt).toEqual(effectiveAt);
  });
});
