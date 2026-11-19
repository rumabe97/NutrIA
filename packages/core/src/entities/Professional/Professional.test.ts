import { describe, expect, it } from 'vitest';
import { badgeChannel, badgeCheckKind, practiceRestrictionKind, priceUnit } from 'database/schema';

import {
  acceptAgreementSchema,
  BADGE_CHANNELS,
  BADGE_CHECK_KINDS,
  hideProfessionalProfileSchema,
  liftRestrictionSchema,
  openPracticeSchema,
  PRACTICE_CLOSE_NOTICE_DAYS,
  PRACTICE_RESTRICTION_KINDS,
  practiceRestrictionSchema,
  PRICE_UNITS,
  PROFESSIONAL_AGREEMENT_VERSION,
  professionalBadgeCheckSchema,
  professionalBadgeCodeSchema,
  professionalHoursSchema,
  professionalProfileSchema,
  professionalSchema,
  PROFILE_DISPLAY_NAME_MAX,
  PROFILE_STUDIES_MAX,
  restrictPracticeSchema,
  saveProfessionalProfileSchema
} from './Professional';

/*
 * PRD 025 criterion 2 — PRD 004 criterion 1 inverted on purpose. The body that
 * opens a practice is the only one an account sends to become a practitioner,
 * and it carries a birth date and nothing else: no badge, no date or checker of
 * one, no `practiceOpen`, no `includedClients`, no number, no user. What it
 * strips is the criterion. (Replaces `grantProfessionalSchema`'s "strips
 * anything else the body carries", retired with the 004 grant.)
 */
describe('openPracticeSchema — no body sets the badge, `practiceOpen` or `includedClients`', () => {
  it('keeps a birth date, and nothing else', () => {
    const parsed = openPracticeSchema.parse({
      badge: true,
      badgeCheckedAt: '2026-11-19T00:00:00.000Z',
      birthDate: '1990-04-02',
      checkedBy: 'usr-owner',
      collegiateNumber: 'MAD00123',
      includedClients: 99,
      practiceOpen: true,
      role: 'admin',
      userId: 'usr-somebody-else'
    });

    expect(parsed).toEqual({ birthDate: '1990-04-02' });
  });

  it('takes an empty body: a birth date is asked only of an account with none on record', () => {
    expect(openPracticeSchema.parse({})).toEqual({});
  });

  it.each([
    ['not a date', 'yesterday'],
    ['a date and a time', '1990-04-02T00:00:00Z'],
    ['an impossible day', '1990-02-30']
  ])('refuses a birth date that is %s', (_label, birthDate) => {
    expect(openPracticeSchema.safeParse({ birthDate }).success).toBe(false);
  });
});

describe('saveProfessionalProfileSchema', () => {
  const body = { displayName: 'Ana · asesora de alimentación' };

  it('fills what was left out as nothing, and an empty studies box as none', () => {
    expect(saveProfessionalProfileSchema.parse({ ...body, studies: '   ' })).toEqual({
      displayName: 'Ana · asesora de alimentación',
      hours: null,
      priceCents: null,
      priceUnit: null,
      studies: null
    });
  });

  it('wants a price with its unit, or neither', () => {
    expect(saveProfessionalProfileSchema.safeParse({ ...body, priceCents: 4500 }).success).toBe(false);
    expect(saveProfessionalProfileSchema.safeParse({ ...body, priceUnit: 'month' }).success).toBe(false);
    expect(saveProfessionalProfileSchema.safeParse({ ...body, priceCents: 4500, priceUnit: 'month' }).success).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['two lines', 'Ana\nPérez'],
    ['markup', '<b>Ana</b>'],
    ['too long', 'A'.repeat(PROFILE_DISPLAY_NAME_MAX + 1)]
  ])('refuses a name that is %s', (_label, displayName) => {
    expect(saveProfessionalProfileSchema.safeParse({ displayName }).success).toBe(false);
  });

  it('drops anything that is not the profile — a queue date, a seen mark, a hidden flag, an account', () => {
    const parsed = saveProfessionalProfileSchema.parse({ ...body, hiddenAt: null, queuedAt: null, seenAt: '2026-11-19', userId: 'usr-x' });

    expect(Object.keys(parsed).sort()).toEqual(['displayName', 'hours', 'priceCents', 'priceUnit', 'studies']);
  });
});

describe('hideProfessionalProfileSchema (textos/06 § X)', () => {
  it('takes one or several reasons, the word quoted, the facts and the notice', () => {
    expect(hideProfessionalProfileSchema.parse({ reasons: ['badge_word', 'promises'], word: 'nutricionista' })).toEqual({
      afterNotice: false,
      reasons: ['badge_word', 'promises'],
      word: 'nutricionista'
    });
  });

  it('takes the facts alone', () => {
    expect(hideProfessionalProfileSchema.safeParse({ facts: 'Anuncia un curso de otra web.' }).success).toBe(true);
  });

  it.each([
    ['nothing said', {}],
    ['a word reason without its word', { reasons: ['unchecked_title'] }],
    ['a reason twice', { reasons: ['promises', 'promises'] }],
    ['a reason the statement does not have', { reasons: ['ugly'] }],
    ['markup in the facts', { facts: '<a href="x">x</a>' }]
  ])('refuses %s', (_label, input) => {
    expect(hideProfessionalProfileSchema.safeParse(input).success).toBe(false);
  });
});

describe('restrictPracticeSchema (textos/06 § W bis.1)', () => {
  it('takes the facts, a clause and a source', () => {
    expect(restrictPracticeSchema.parse({ clause: 2, facts: 'Se presenta como médico.', source: 'own_review' })).toEqual({
      clause: 2,
      facts: 'Se presenta como médico.',
      source: 'own_review'
    });
  });

  it('names an authority exactly when one is the source', () => {
    expect(restrictPracticeSchema.safeParse({ authority: 'La AEPD', facts: 'x', source: 'authority' }).success).toBe(true);
    expect(restrictPracticeSchema.safeParse({ facts: 'x', source: 'authority' }).success).toBe(false);
    expect(restrictPracticeSchema.safeParse({ authority: 'La AEPD', facts: 'x', source: 'notice' }).success).toBe(false);
  });

  it.each([
    ['no facts', { source: 'own_review' }],
    ['a clause the agreement does not have', { clause: 15, facts: 'x', source: 'own_review' }],
    ['a date of its own: a close always runs its 30 days', { effectiveAt: '2026-11-20', facts: 'x', source: 'own_review' }]
  ])('refuses or ignores %s', (_label, input) => {
    const parsed = restrictPracticeSchema.safeParse(input);

    expect(parsed.success && 'effectiveAt' in parsed.data).toBe(false);
  });

  it('a lift takes the facts found, or nothing', () => {
    expect(liftRestrictionSchema.parse({})).toEqual({});
    expect(liftRestrictionSchema.parse({ facts: 'los hechos no se confirmaron' })).toEqual({ facts: 'los hechos no se confirmaron' });
  });

  it('gives a close thirty days', () => {
    expect(PRACTICE_CLOSE_NOTICE_DAYS).toBe(30);
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
