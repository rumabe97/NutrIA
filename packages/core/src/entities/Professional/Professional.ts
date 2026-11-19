import { z } from 'zod';

/**
 * What a collegiate number may look like: letters, digits, `/` and `-`, three
 * to twenty of them. Spanish registers write them as `MAD00123`, `CV-0456` or
 * `12/3456`, and nothing longer; anything else is a typo at the door, not a
 * different register.
 */
export const COLLEGIATE_NUMBER_PATTERN = /^[A-Za-z0-9/-]{3,20}$/;

/**
 * An account opens its own practice (PRD 025 scope 1, criterion 1): the birth
 * date, for an account that has none on record, and **nothing else**. Every
 * other key a body carries — a badge, `practiceOpen`, `includedClients`, a
 * number, a user id — is dropped here, and the row is written from the
 * session's account alone (PRD 025 criterion 2, the 004 grant's criterion 1
 * inverted). The date's bounds are the profile's: under 18 is the route's 404,
 * decided by `assertOldEnough` where the row is written.
 */
export const openPracticeSchema = z.object({ birthDate: z.iso.date().optional() });

export type OpenPractice = z.infer<typeof openPracticeSchema>;

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

/** A badge's re-check falls due this many months after the owner's `pass` (`0111` § 2). */
export const BADGE_VALID_MONTHS = 12;

/** A badge still stands this many days after its re-check fell due; then it has lapsed (PRD 025 scope 6). */
export const BADGE_GRACE_DAYS = 30;

/** A code lives this long: a letter is slow (`0111` § 3). */
export const BADGE_CODE_TTL_DAYS = 30;

/** Wrong entries a code survives; the next is refused like an unknown code, until the owner issues another (PRD 025 criterion 3). */
export const BADGE_CODE_MAX_ATTEMPTS = 5;

/**
 * The practitioner's application (PRD 025 scope 6): the college whose register
 * the owner will read, and the number they hold there. Nothing else — no
 * contact, because a code never goes to a contact the applicant supplies.
 */
export const applyForBadgeSchema = z.object({
  number: z.string().trim().regex(COLLEGIATE_NUMBER_PATTERN),
  register: z.string().trim().min(2).max(160)
});

export type ApplyForBadge = z.infer<typeof applyForBadgeSchema>;

/**
 * A code as the practitioner types it. Never refused by its shape: an empty
 * code, a missing one, one too long, or one that is not a string — or a body
 * that is not an object — all read as the empty code, which matches nothing, so
 * each is the same 404 as a wrong, used, expired or unknown code (PRD 025
 * criterion 3; invariant review of phase 3, P2-5). Never a 422.
 */
export const enterBadgeCodeSchema = z.object({ code: z.string().max(64).catch('') }).catch({ code: '' });

export type EnterBadgeCode = z.infer<typeof enterBadgeCodeSchema>;

/**
 * A name typed by the owner for a mail to a third party: one plain line, no link
 * and no address in it, so nothing but a name reaches a stranger's inbox from the
 * owner's address.
 */
const plainName = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(name => !/https?:|www\.|\/\/|@|[<>\n\r]/i.test(name), { message: 'A name, not a link or an address' });

/**
 * The owner's act of sending a code (PRD 025 scope 6), through the channel the
 * public register allows. By e-mail, the address, the person's name and the
 * college's name **as the register shows them**, typed by the owner, used once
 * for the mail and never stored — the mail never carries the college as the
 * applicant typed it. By post or phone, nothing: the owner writes the letter or
 * makes the call, and the code comes back to the console once.
 */
export const issueBadgeCodeSchema = z.discriminatedUnion('channel', [
  z.object({ channel: z.literal('register_email'), email: z.email().max(254), register: plainName, registerName: plainName }),
  z.object({ channel: z.literal('post') }),
  z.object({ channel: z.literal('phone') })
]);

export type IssueBadgeCode = z.infer<typeof issueBadgeCodeSchema>;

/**
 * Why the owner does not give, or takes back, a badge (`docs/legal/textos/06`
 * § W): not on the register, the register's person says it was not them, the
 * code expired unentered, or other facts written out.
 */
export const BADGE_REMOVAL_REASONS = ['not_on_register', 'not_me', 'code_expired', 'other'] as const;

export type BadgeRemovalReason = (typeof BADGE_REMOVAL_REASONS)[number];

/** Whether the owner acted on their own check or on a notice they received (DSA art. 17.3.b). */
export const BADGE_REMOVAL_SOURCES = ['own_check', 'notice'] as const;

export type BadgeRemovalSource = (typeof BADGE_REMOVAL_SOURCES)[number];

/**
 * The owner's `fail` (an application not granted) or `withdrawn` (a standing
 * badge taken back), with its statement of reasons. `facts` is required for
 * `other` and may add to any reason.
 */
export const removeBadgeSchema = z
  .object({
    facts: z.string().trim().min(1).max(1000).optional(),
    kind: z.enum(['fail', 'withdrawn']),
    reason: z.enum(BADGE_REMOVAL_REASONS),
    source: z.enum(BADGE_REMOVAL_SOURCES)
  })
  .refine(body => body.reason !== 'other' || body.facts !== undefined, { message: 'Other reasons are written out', path: ['facts'] });

export type RemoveBadge = z.infer<typeof removeBadgeSchema>;

/**
 * Why the daily sweep lapsed a badge (`docs/legal/textos/06` § V): a code went
 * out for the re-check and was never entered, or nobody completed it in time —
 * the owner's delay, said as such.
 */
export const BADGE_LAPSE_DETAILS = ['code_not_entered', 'our_delay'] as const;

export type BadgeLapseDetail = (typeof BADGE_LAPSE_DETAILS)[number];

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

/** The longest name a profile shows (PRD 025 scope 4). */
export const PROFILE_DISPLAY_NAME_MAX = 80;

/** The highest price a profile states, in cents: ten thousand euros, past which it is a typo. */
export const PROFILE_PRICE_MAX_CENTS = 1_000_000;

/** One line of text somebody typed: no line break, no control character, no markup. */
function oneLine(max: number) {
  return (
    z
      .string()
      .trim()
      .min(1)
      .max(max)
      // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
      .refine(text => !/[\u0000-\u001f\u007f<>]/.test(text), { message: 'One line of plain text' })
  );
}

/**
 * The practitioner's profile as they save it (`PUT /care/practice/profile`, PRD
 * 025 scope 4): the whole profile, every time. The shape only — **the words**
 * are judged where the badge can be read (`protectedWordIn`, `0111` § 7), in
 * every free-text field: `displayName` and `studies`.
 *
 * A price is final, taxes included, with its unit, or neither. Nothing here
 * names an account: the profile is the session's.
 */
export const saveProfessionalProfileSchema = z
  .object({
    displayName: oneLine(PROFILE_DISPLAY_NAME_MAX),
    hours: professionalHoursSchema.nullable().default(null),
    priceCents: z.number().int().min(0).max(PROFILE_PRICE_MAX_CENTS).nullable().default(null),
    priceUnit: z.enum(PRICE_UNITS).nullable().default(null),
    // An empty box is no studies at all, not an empty string kept.
    studies: z
      .string()
      .trim()
      .max(PROFILE_STUDIES_MAX)
      .nullable()
      .default(null)
      .transform(text => (text === null || text.length === 0 ? null : text))
  })
  .refine(body => (body.priceCents === null) === (body.priceUnit === null), { message: 'A price says what it is for', path: ['priceUnit'] });

export type SaveProfessionalProfile = z.infer<typeof saveProfessionalProfileSchema>;

/** The free-text fields of a profile: the ones whose words are judged, and whose change returns it to the owner's queue. */
export const PROFILE_TEXT_FIELDS = ['displayName', 'studies'] as const;

export type ProfileTextField = (typeof PROFILE_TEXT_FIELDS)[number];

/**
 * Why the owner hides a profile (`docs/legal/textos/06` § X): a word the
 * agreement allows only with the badge, a service offered for a disease,
 * promised results, a title NutrIA does not check, or advertising unrelated to
 * the practice. One or several; the owner may add the facts.
 */
export const PROFILE_HIDE_REASONS = ['badge_word', 'disease', 'promises', 'unchecked_title', 'advertising'] as const;

export type ProfileHideReason = (typeof PROFILE_HIDE_REASONS)[number];

/** The two reasons whose sentence quotes the word the owner saw. */
const WORD_REASONS: readonly ProfileHideReason[] = ['badge_word', 'unchecked_title'];

/** The owner's own words in a statement of reasons: plain text, one paragraph, bounded. */
const ownerFacts = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  // eslint-disable-next-line no-control-regex -- a statement is one plain paragraph
  .refine(text => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/.test(text), { message: 'Plain text' });

/**
 * The owner hides a profile (PRD 025 criterion 18): **refusing and hiding are
 * one act** (legal F6), with one statement of reasons. `afterNotice` says the
 * owner looked because somebody told them (DSA art. 17.3.b); the notifier is
 * never named. At least one reason, or the facts written out.
 */
export const hideProfessionalProfileSchema = z
  .object({
    afterNotice: z.boolean().default(false),
    facts: ownerFacts.optional(),
    reasons: z.array(z.enum(PROFILE_HIDE_REASONS)).max(PROFILE_HIDE_REASONS.length).default([]),
    word: oneLine(60).optional()
  })
  .refine(body => body.reasons.length > 0 || body.facts !== undefined, { message: 'Say why', path: ['reasons'] })
  .refine(body => new Set(body.reasons).size === body.reasons.length, { message: 'Each reason once', path: ['reasons'] })
  .refine(body => !body.reasons.some(reason => WORD_REASONS.includes(reason)) || body.word !== undefined, {
    message: 'Name the word',
    path: ['word']
  });

export type HideProfessionalProfile = z.infer<typeof hideProfessionalProfileSchema>;

/** How many days a close's notice runs before the practice closes (PRD 025 scope 16, `textos/06` § W bis.3). */
export const PRACTICE_CLOSE_NOTICE_DAYS = 30;

/**
 * Where the owner's decision to suspend or close came from (`textos/06` § W
 * bis.1 `source`): their own review, a notice they received, or an authority
 * that requires it — named, because the practitioner is told who.
 */
export const RESTRICTION_SOURCES = ['own_review', 'notice', 'authority'] as const;

export type RestrictionSource = (typeof RESTRICTION_SOURCES)[number];

/** The highest section of the professional's agreement a statement may cite beside its § 13. */
const AGREEMENT_SECTIONS = 14;

/**
 * The owner's statement of reasons for a suspension or a close (`textos/06` §
 * W bis.1, P2B art. 4.5): the facts — what, when, where — the section of the
 * agreement read with § 13, if any, and the source. An authority is named when
 * it is the source, and only then.
 */
export const restrictPracticeSchema = z
  .object({
    authority: oneLine(160).optional(),
    clause: z.number().int().min(1).max(AGREEMENT_SECTIONS).optional(),
    facts: ownerFacts,
    source: z.enum(RESTRICTION_SOURCES)
  })
  .refine(body => (body.source === 'authority') === (body.authority !== undefined), {
    message: 'An authority is named when it is the source',
    path: ['authority']
  });

export type RestrictPractice = z.infer<typeof restrictPracticeSchema>;

/** The owner lifts what stands (`textos/06` § W bis.2): with what they found, or without. */
export const liftRestrictionSchema = z.object({ facts: ownerFacts.optional() });

export type LiftRestriction = z.infer<typeof liftRestrictionSchema>;

/**
 * The owner's acts on an account as a practitioner (PRD 025 scope 16):
 * suspended at once, closing with 30 days' notice, or lifted. What stands is
 * folded from the rows by `restrictionFrom` (`#repositories/Professional`): a
 * suspension and a close can stand together, and a lift ends both. Repeated as
 * `practice_restriction_kind` in the database.
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
