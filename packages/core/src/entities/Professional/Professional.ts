import { z } from 'zod';

/**
 * What a collegiate number may look like: letters, digits, `/` and `-`, three
 * to twenty of them. Spanish registers write them as `MAD00123`, `CV-0456` or
 * `12/3456`, and nothing longer; anything else is a typo at the door, not a
 * different register.
 */
export const COLLEGIATE_NUMBER_PATTERN = /^[A-Za-z0-9/-]{3,20}$/;

/**
 * The owner's act (`0059`): the one body that can make an account a
 * professional, and it carries only the collegiate number. Required, never a
 * declaration — the owner types it from the register before granting.
 */
export const grantProfessionalSchema = z.object({ collegiateNumber: z.string().trim().regex(COLLEGIATE_NUMBER_PATTERN) });

export type GrantProfessional = z.infer<typeof grantProfessionalSchema>;

/**
 * The professional's agreement and the practice plan's terms, accepted together
 * on one screen before any client's data is shown or the practice is paid for
 * (`docs/legal/textos/01` and `04`). The version is code and the words are the
 * web app's dictionary, as `CARE_CONSENT_VERSION` is: a stored version that is
 * not this one asks again, and accepting an older one is refused at the door.
 */
// 1.1.0 (PLAN 011 phase 6): § 8 makes two-step verification mandatory for a password account.
export const PROFESSIONAL_AGREEMENT_VERSION = '1.1.0';

/** The professional's acceptance: the current version, and nothing else. */
export const acceptAgreementSchema = z.object({ version: z.literal(PROFESSIONAL_AGREEMENT_VERSION) });

export type AcceptAgreement = z.infer<typeof acceptAgreementSchema>;

/**
 * The row as `professionals` holds it. `grantedBy` is another account's id —
 * the owner's — and is the one field no presenter may carry. `collegiateNumber`
 * is the number project 004's grant was given with, and null on a practice
 * opened by its own account (`0111` § 1): a number is shown only from a `pass`
 * check, never from here (PRD 025 criterion 5).
 */
export const professionalSchema = z.object({
  id: z.uuid(),
  agreementAcceptedAt: z.date().nullable(),
  agreementVersion: z.string().min(1).nullable(),
  collegiateNumber: z.string().nullable(),
  createdAt: z.date(),
  grantedAt: z.date(),
  grantedBy: z.string().nullable(),
  includedClients: z.number().int().min(0),
  practiceOpen: z.boolean(),
  updatedAt: z.date(),
  userId: z.string().min(1)
});

export type Professional = z.infer<typeof professionalSchema>;

/**
 * One step on a practitioner's badge record (`0111` § 2). `applied` is the
 * practitioner's declaration and decides nothing; the other four are decisive,
 * and the badge is derived from the latest of them. Repeated as
 * `badge_check_kind` in the database.
 */
export const BADGE_CHECK_KINDS = ['applied', 'pass', 'fail', 'withdrawn', 'lapsed'] as const;

export type BadgeCheckKind = (typeof BADGE_CHECK_KINDS)[number];

/**
 * How a code reaches a practitioner: an e-mail the public register lists, a
 * letter to the register's professional address, or the owner's call to a phone
 * it lists (PRD 025 scope 6). Never a contact only the applicant supplies.
 * Repeated as `badge_channel` in the database.
 */
export const BADGE_CHANNELS = ['register_email', 'post', 'phone'] as const;

export type BadgeChannel = (typeof BADGE_CHANNELS)[number];

/** A row of `professional_badge_checks`. Append-only; `checkedBy` is the owner's account and no presenter carries it. */
export const professionalBadgeCheckSchema = z.object({
  id: z.uuid(),
  channel: z.enum(BADGE_CHANNELS).nullable(),
  checkedAt: z.date(),
  checkedBy: z.string().nullable(),
  createdAt: z.date(),
  dueAt: z.date().nullable(),
  kind: z.enum(BADGE_CHECK_KINDS),
  number: z.string().nullable(),
  reason: z.string().nullable(),
  register: z.string().nullable(),
  updatedAt: z.date(),
  userId: z.string().min(1)
});

export type ProfessionalBadgeCheck = z.infer<typeof professionalBadgeCheckSchema>;

/** A row of `professional_badge_codes`: the code's hash only, never the code, and never the contact it went to. */
export const professionalBadgeCodeSchema = z.object({
  id: z.uuid(),
  attempts: z.number().int().min(0),
  channel: z.enum(BADGE_CHANNELS),
  checkId: z.uuid(),
  codeHash: z.string().min(1),
  createdAt: z.date(),
  expiresAt: z.date(),
  updatedAt: z.date(),
  usedAt: z.date().nullable(),
  userId: z.string().min(1)
});

export type ProfessionalBadgeCode = z.infer<typeof professionalBadgeCodeSchema>;

/** What a practice's price is for (PRD 025 scope 4). Repeated as `price_unit` in the database. */
export const PRICE_UNITS = ['consultation', 'month', 'plan'] as const;

export type PriceUnit = (typeof PRICE_UNITS)[number];

/** The longest `studies` a profile stores (PRD 025 scope 4); the database refuses longer. */
export const PROFILE_STUDIES_MAX = 2000;

/** A time of day as a profile's hours write it, `HH:MM` on a 24-hour clock. */
const HOUR_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/**
 * Opening hours: seven days from Monday, each a list of ranges — an empty list
 * is a day closed. Display only (`0110` decision 9): nothing books against them.
 */
export const professionalHoursSchema = z
  .array(
    z.array(
      z
        .object({ from: z.string().regex(HOUR_PATTERN), to: z.string().regex(HOUR_PATTERN) })
        .refine(range => range.from < range.to, { message: 'A range ends after it starts' })
    )
  )
  .length(7);

export type ProfessionalHours = z.infer<typeof professionalHoursSchema>;

/**
 * A row of `professional_profiles`: seen by its author and the owner's console
 * only. The queue columns are the owner's first look; `seenBy` is the owner's
 * account and no presenter carries it.
 */
export const professionalProfileSchema = z.object({
  id: z.uuid(),
  createdAt: z.date(),
  displayName: z.string().min(1),
  hiddenAt: z.date().nullable(),
  hiddenReason: z.string().nullable(),
  hours: professionalHoursSchema.nullable(),
  priceCents: z.number().int().min(0).nullable(),
  priceUnit: z.enum(PRICE_UNITS).nullable(),
  queuedAt: z.date().nullable(),
  seenAt: z.date().nullable(),
  seenBy: z.string().nullable(),
  studies: z.string().max(PROFILE_STUDIES_MAX).nullable(),
  updatedAt: z.date(),
  userId: z.string().min(1)
});

export type ProfessionalProfile = z.infer<typeof professionalProfileSchema>;

/**
 * The owner's acts on an account as a practitioner (PRD 025 scope 16):
 * suspended at once, closing with 30 days' notice, or lifted. What stands is the
 * latest row. Repeated as `practice_restriction_kind` in the database.
 */
export const PRACTICE_RESTRICTION_KINDS = ['suspended', 'closing', 'lifted'] as const;

export type PracticeRestrictionKind = (typeof PRACTICE_RESTRICTION_KINDS)[number];

/** A row of `practice_restrictions`. Append-only; `actedBy` is the owner's account and no presenter carries it. */
export const practiceRestrictionSchema = z.object({
  id: z.uuid(),
  actedAt: z.date(),
  actedBy: z.string().nullable(),
  createdAt: z.date(),
  effectiveAt: z.date().nullable(),
  kind: z.enum(PRACTICE_RESTRICTION_KINDS),
  reason: z.string().nullable(),
  updatedAt: z.date(),
  userId: z.string().min(1)
});

export type PracticeRestriction = z.infer<typeof practiceRestrictionSchema>;
