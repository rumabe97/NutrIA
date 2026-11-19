import { boolean, check, index, integer, jsonb, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { badgeChannel, badgeCheckKind, practiceRestrictionKind, priceUnit } from './_enums';
import { user } from './auth.schema';
import { userOwned, userOwnedSingleton } from './_utils';

/**
 * An account that may practise (`0059`, `0111` § 1), one row per account.
 *
 * The row *is* "may practise": an account is a practitioner while it has one
 * and stops being one when it is deleted. Until project 025 phase 6 only the
 * owner's act on `/admin` wrote it; since then the account opens its own
 * practice (`POST /care/practice`), whose body sets nothing but a birth date,
 * and the owner's close deletes it on its day. `user.role` is
 * untouched, so the owner may be both an admin and a professional and the
 * admin guard keeps meaning one thing.
 *
 * `grantedBy` is `set null` on delete: the grant outlives the granting account,
 * because it is the professional's, not the owner's. `practiceOpen` and
 * `includedClients` are what a practice subscription writes (`0061`); until
 * billing exists they hold their defaults, which grant nothing.
 *
 * Whether a practitioner is a checked dietitian-nutritionist is **not** here:
 * it is derived from `professional_badge_checks` below, on every request.
 */
export const professionals = userOwnedSingleton('professionals', {
  /**
   * When the professional accepted their agreement (`docs/legal/textos/01`), and
   * which version: both null until they do, so a grant starts unaccepted. A
   * version that is not `PROFESSIONAL_AGREEMENT_VERSION` asks again.
   */
  agreementAcceptedAt: timestamp({ withTimezone: true }),
  agreementVersion: text(),
  /**
   * The number project 004's grant was given with. Nullable since project 025
   * (`0111` § 1): a self-service practice has none, and no screen reads it —
   * a number is shown only from a `pass` check (PRD 025 criterion 5).
   */
  collegiateNumber: text(),
  grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  grantedBy: text().references(() => user.id, { onDelete: 'set null' }),
  /** How many active clients the practice plan includes. Zero until a price says otherwise. */
  includedClients: integer().notNull().default(0),
  /** Whether the practice is paid for. False until a price says otherwise. */
  practiceOpen: boolean().notNull().default(false)
});

/**
 * A practitioner's badge record (`0111` § 2): **append-only**, one row per
 * step, never updated.
 *
 * - `applied` is the practitioner's own declaration — the register and number
 *   they named — and is what a code points at. It decides nothing.
 * - `pass`, `fail`, `withdrawn` and `lapsed` are decisive. The badge *is* "the
 *   latest decisive row is a `pass` and now is before its `due_at` + 30 days",
 *   computed per request in one repository function and stored nowhere else.
 *
 * Owned by the practitioner's **account** (`user_id`, cascading), not by the
 * `professionals` row, so a `fail` naming somebody's number stays with the
 * account that applied until that account is deleted (record of processing
 * row 12, legal M15). `checkedBy` is the owner and is set null when that
 * account goes. No identity document and no contact column: the contact a
 * code went to is typed by the owner and not kept (PRD 025 criterion 3).
 */
export const professionalBadgeChecks = userOwned(
  'professional_badge_checks',
  {
    channel: badgeChannel(),
    checkedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    checkedBy: text().references(() => user.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    /** On a `pass` only: twelve months after the check, when the re-check falls due. */
    dueAt: timestamp({ withTimezone: true }),
    kind: badgeCheckKind().notNull(),
    number: text(),
    /** On a `fail`, `withdrawn` or `lapsed`: the statement of reasons (DSA art. 17). */
    reason: text(),
    register: text()
  },
  table => [
    // An application is what it declared: without both, a code would point at nothing.
    check(
      'professional_badge_checks_applied_declares',
      sql`${table.kind} <> 'applied' or (${table.register} is not null and ${table.number} is not null)`
    ),
    // A pass with no due date would be a badge that never lapses.
    check('professional_badge_checks_pass_is_due', sql`${table.kind} <> 'pass' or ${table.dueAt} is not null`),
    // Removing a badge always says why.
    check('professional_badge_checks_removal_has_reason', sql`${table.kind} not in ('fail', 'withdrawn', 'lapsed') or ${table.reason} is not null`)
  ]
);

/**
 * A single-use code proving a contact read on the public register reaches the
 * practitioner (`0111` § 3). Only its hash is stored; it is bound to one
 * `applied` check and one channel and expires after 30 days (post is slow).
 * The contact it went to is not stored after sending.
 *
 * `attempts` counts wrong entries, so phase 3 can cap them in Postgres (PRD 025
 * criterion 3). Owned by the account, like the checks.
 */
export const professionalBadgeCodes = userOwned(
  'professional_badge_codes',
  {
    attempts: smallint().notNull().default(0),
    channel: badgeChannel().notNull(),
    checkId: uuid()
      .notNull()
      .references(() => professionalBadgeChecks.id, { onDelete: 'cascade' }),
    codeHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true })
  },
  table => [
    // For the cascade from a check, which would otherwise scan this table.
    index('professional_badge_codes_check_id_idx').on(table.checkId)
  ]
);

/**
 * What a practitioner says about their practice (PRD 025 scope 4), one row per
 * account. Seen by its author and the owner's console only — no client, no
 * list, no model (PRD 025 criterion 16).
 *
 * The queue columns are the owner's first look (PRD 025 criterion 18): a
 * create or an edit to a free-text field sets `queuedAt`; the owner marks it
 * seen (`seenAt`, `seenBy`, set null when the owner's account goes) or hides it
 * with a reason. The look gates nothing in this project.
 */
export const professionalProfiles = userOwnedSingleton(
  'professional_profiles',
  {
    displayName: text().notNull(),
    hiddenAt: timestamp({ withTimezone: true }),
    hiddenReason: text(),
    /** Seven days from Monday, each a list of `HH:MM` ranges; display only (`0110` decision 9). */
    hours: jsonb().$type<readonly (readonly { readonly from: string; readonly to: string }[])[]>(),
    /** The final price, taxes included, in cents. */
    priceCents: integer(),
    priceUnit: priceUnit(),
    queuedAt: timestamp({ withTimezone: true }),
    seenAt: timestamp({ withTimezone: true }),
    seenBy: text().references(() => user.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    /** As the practitioner declared them; NutrIA does not check them. */
    studies: text()
  },
  table => [
    check('professional_profiles_studies_length', sql`char_length(${table.studies}) <= 2000`),
    check('professional_profiles_price_not_negative', sql`${table.priceCents} >= 0`),
    // Hiding a profile always says why: the reason is the statement the practitioner receives.
    check('professional_profiles_hidden_has_reason', sql`${table.hiddenAt} is null or ${table.hiddenReason} is not null`)
  ]
);

/**
 * The owner's acts on an account as a practitioner (PRD 025 scope 16),
 * **append-only**: what stands is folded from the rows in order — a suspension
 * and a close can stand together, a `lifted` row ends both — by one function
 * in `packages/core` (`restrictionFrom`), and nothing else stores it.
 *
 * Owned by the **account** (`user_id`, cascading) and deliberately not by the
 * `professionals` row: the owner's revoke deletes that row, and a restriction
 * that went with it would let a closed practice be reopened at once. A
 * `closing` row's `effectiveAt` is the date it closes, 30 days on. `actedBy` is
 * the owner, set null when that account goes.
 */
export const practiceRestrictions = userOwned(
  'practice_restrictions',
  {
    actedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actedBy: text().references(() => user.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    effectiveAt: timestamp({ withTimezone: true }),
    kind: practiceRestrictionKind().notNull(),
    /** The statement of reasons; required for a suspension and a close. */
    reason: text()
  },
  table => [
    check('practice_restrictions_closing_has_date', sql`${table.kind} <> 'closing' or ${table.effectiveAt} is not null`),
    check('practice_restrictions_has_reason', sql`${table.kind} = 'lifted' or ${table.reason} is not null`)
  ]
);
