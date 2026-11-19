import { createHash, randomInt } from 'node:crypto';

import {
  badgeFrom,
  codeIsLive,
  lapseDate,
  newestFirst,
  pendingApplication,
  ProfessionalBadgeRepository,
  ProfessionalProfileRepository
} from '#repositories/Professional';
import { badgeGone } from './ProfessionalController';
import { carriesBadgeWord } from './ProfessionalProfileController';
import { BADGE_LAPSE_DETAILS, BADGE_REMOVAL_REASONS } from 'core/entities/Professional';
import { AnalyticsRepository } from '#repositories/Analytics';
import { CareRepository } from '#repositories/Care';
import { SettingsRepository } from '#repositories/Settings';
import { FLAGS } from 'core/domain/Flag';
import { NotFoundError } from 'core/entities/Error';
import { UserRepository } from '#repositories/User';

import type {
  ApplyForBadge,
  BadgeChannel,
  BadgeCheckKind,
  BadgeLapseDetail,
  BadgeRemovalReason,
  BadgeRemovalSource,
  EnterBadgeCode,
  IssueBadgeCode,
  ProfessionalBadgeCheck,
  ProfessionalBadgeCode,
  RemoveBadge
} from 'core/entities/Professional';
import type { Badge, BadgeRecord } from '#repositories/Professional';

/**
 * Where a practitioner's badge stands, as their own page says it
 * (`docs/legal/textos/01`, `practice.badgeState.*`): none, an application
 * waiting for the owner, a code sent, the badge, the badge due for its re-check,
 * or lapsed. A `fail` or a `withdrawn` reads as `none`: they may apply again.
 */
export const BADGE_STATES = ['none', 'applied', 'code_sent', 'badged', 'due', 'lapsed', 'refused', 'withdrawn'] as const;

export type BadgeState = (typeof BADGE_STATES)[number];

/**
 * The practitioner's own badge (`GET /care/practice/badge`). Never the code,
 * never who checked, never a contact. The number only once checked (PRD 025
 * criterion 5): while the application waits, the register they named and
 * nothing more.
 */
export interface BadgeView {
  checkedAt: string | null;
  /** True once the live code was entered and the owner has yet to confirm. */
  codeEntered: boolean;
  /** Until when the code sent can be entered; null when none is out. */
  codeExpiresAt: string | null;
  /**
   * The owner's latest decision against the badge, while it is the last word:
   * what, when, and why — the closed reason and the owner's facts — so the
   * statement of reasons can be read on the practitioner's own page whatever
   * happened to its mail (invariant review of phase 3, P1-2). Null while a badge
   * stands or nothing was decided.
   */
  decision: BadgeDecisionView | null;
  dueAt: string | null;
  lapsesAt: string | null;
  number: string | null;
  register: string | null;
  state: BadgeState;
}

/** A refusal, a withdrawal or a lapse, as the practitioner reads it. `reason` is a closed code; `facts` the owner's own words. */
export interface BadgeDecisionView {
  at: string;
  facts: string | null;
  kind: 'fail' | 'lapsed' | 'withdrawn';
  reason: BadgeLapseDetail | BadgeRemovalReason | null;
}

/** One step of a badge record, as the owner's console shows it. Never who checked: that is the owner's own id. */
export interface BadgeCheckView {
  channel: BadgeChannel | null;
  checkedAt: string;
  dueAt: string | null;
  kind: BadgeCheckKind;
  number: string | null;
  reason: string | null;
  register: string | null;
}

/**
 * One practitioner's badge as the owner reads it in the console: the account,
 * the application with the declared register and number (what the owner looks
 * up), the badge that stands, the code out, and the record. Practitioner data
 * only — never a client (`0028`), never the contact a code went to (not kept).
 */
export interface BadgeRecordView {
  application: { appliedAt: string; number: string | null; register: string | null } | null;
  badge: { channel: BadgeChannel | null; checkedAt: string; dueAt: string; lapsesAt: string; number: string | null; register: string | null } | null;
  checks: BadgeCheckView[];
  code: { channel: BadgeChannel; entered: boolean; expiresAt: string; live: boolean } | null;
  email: string;
  name: string;
  state: BadgeState;
  userId: string;
}

/** The owner's work list: applications to check, and badges due for their re-check. Records without their history. */
export interface BadgeQueueView {
  applications: Omit<BadgeRecordView, 'checks'>[];
  due: Omit<BadgeRecordView, 'checks'>[];
}

/**
 * What the console is told after issuing a code. `code` is there **once**, for
 * a letter or a call, and never again — only its hash is kept. By e-mail it is
 * null, and `mailed` says whether the mail left.
 */
export interface BadgeCodeIssuedView {
  channel: BadgeChannel;
  code: string | null;
  expiresAt: string;
  mailed: boolean | null;
}

/** A code just issued, for the API to send or show: the code itself goes no further than that answer or that mail. */
export interface IssuedBadgeCode {
  readonly channel: BadgeChannel;
  readonly code: string;
  readonly expiresAt: Date;
  readonly number: string;
  readonly register: string;
  readonly userId: string;
}

/** A `fail` or `withdrawn` just written, with what its statement of reasons says and where it goes. */
export interface BadgeRemoval {
  readonly checkedAt: Date;
  readonly facts: string | null;
  readonly kind: 'fail' | 'withdrawn';
  readonly number: string | null;
  readonly reason: BadgeRemovalReason;
  readonly record: BadgeRecordView;
  readonly register: string | null;
  readonly source: BadgeRemovalSource;
  readonly to: string;
}

/** What the daily sweep found: the owner's counts, the practitioners to remind, and the badges it lapsed. */
export interface BadgeSweep {
  readonly counts: { readonly due: number; readonly soon: number };
  readonly lapsed: readonly { readonly detail: BadgeLapseDetail; readonly dueAt: Date; readonly to: string; readonly userId: string }[];
  readonly reminders: readonly { readonly lapsesAt: Date; readonly register: string | null; readonly to: string; readonly userId: string }[];
}

/**
 * Every refusal here says what the guard's 404 says, byte for byte: the
 * filter carries a `NotFoundError`'s message into the answer, and a different
 * one would tell a wrong code from a route the caller cannot see.
 */
const NOT_FOUND = 'Not Found';

/** How many days ahead the owner's alert counts a lapse as soon (`textos/06` § U.1). */
export const BADGE_SOON_DAYS = 7;

/** The first sweep ever, with no watermark yet, reminds the re-checks that fell due in the last day. */
const FIRST_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The reminders' watermark (invariant review of phase 3, flag c): an
 * `owner_alerted` event of this kind, no user, written by the pass that reminds,
 * dated the instant it reminded up to. The next pass reminds what fell due after
 * it — so a day the cron missed is reminded late, not never, and a second pass
 * finds the watermark moved and reminds nothing.
 */
export const BADGE_REMINDERS_MARK = 'badge-reminders';

/**
 * Takes the window `(watermark, now]` for this pass, or null when another pass
 * moved the watermark since it was read. A compare-and-set on the claim: it is
 * refused if any mark exists after the one read.
 */
async function reminderWindow(now: Date): Promise<Date | null> {
  const last = await AnalyticsRepository.lastOwnerAlert(BADGE_REMINDERS_MARK);
  const claimed = await AnalyticsRepository.claimOwnerAlert(BADGE_REMINDERS_MARK, new Date((last?.getTime() ?? 0) + 1), now);

  if (claimed === null) {
    return null;
  }

  return last ?? new Date(now.getTime() - FIRST_WINDOW_MS);
}

/** Letters and digits nobody misreads on paper or over the phone: no 0/O, 1/I/L. Thirty-one of them. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;

/** A new code, `XXXXX-XXXXX`: ten symbols from a cryptographic source, about forty-nine bits. */
export function newBadgeCode(): string {
  const symbols = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

  return `${symbols.slice(0, 5)}-${symbols.slice(5)}`;
}

/** The only form a code is stored in: the hash of its letters and digits, case and separators ignored. */
export function badgeCodeHash(code: string): string {
  return createHash('sha256')
    .update(code.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .digest('hex');
}

/** The code that belongs to the check that stands now, if the newest code is that one. */
function currentCode(record: BadgeRecord, now: Date): ProfessionalBadgeCode | null {
  const pending = pendingApplication(record.checks);
  const badge = pending ? null : badgeFrom(record.checks, now);
  const checkId = pending?.id ?? badge?.checkId;

  return record.code && record.code.checkId === checkId ? record.code : null;
}

/** Where the record stands, by the one definition of the badge. */
const CLOSED_REASONS: readonly string[] = [...BADGE_REMOVAL_REASONS, ...BADGE_LAPSE_DETAILS];

/** A stored reason read back: `code` or `code: facts`, as `storedReason` writes it and the sweep writes its detail. */
function readReason(stored: string | null): Pick<BadgeDecisionView, 'facts' | 'reason'> {
  if (stored === null) {
    return { facts: null, reason: null };
  }

  const split = stored.indexOf(': ');
  const code = split === -1 ? stored : stored.slice(0, split);
  const facts = split === -1 ? null : stored.slice(split + 2);

  return CLOSED_REASONS.includes(code) ? { facts, reason: code as BadgeDecisionView['reason'] } : { facts: null, reason: null };
}

/**
 * The decision that is the last word on the badge, or null. A `pass` past its
 * grace with the sweep yet to write the row reads as the lapse it already is.
 */
function decisionOf(record: BadgeRecord, now: Date): BadgeDecisionView | null {
  const latest = newestFirst(record.checks).find(check => check.kind !== 'applied');

  if (!latest || badgeFrom(record.checks, now)) {
    return null;
  }

  if (latest.kind === 'pass') {
    return latest.dueAt === null ? null : { at: lapseDate(latest.dueAt).toISOString(), facts: null, kind: 'lapsed', reason: null };
  }

  if (latest.kind === 'applied') {
    return null;
  }

  return { at: latest.checkedAt.toISOString(), kind: latest.kind, ...readReason(latest.reason) };
}

function stateOf(record: BadgeRecord, now: Date): BadgeState {
  const badge = badgeFrom(record.checks, now);

  if (badge) {
    return now.getTime() < badge.dueAt.getTime() ? 'badged' : 'due';
  }

  if (pendingApplication(record.checks)) {
    const code = currentCode(record, now);

    return code && (code.usedAt !== null || codeIsLive(code, now)) ? 'code_sent' : 'applied';
  }

  const decision = decisionOf(record, now);

  switch (decision?.kind) {
    case 'fail':
      return 'refused';
    case 'lapsed':
      return 'lapsed';
    case 'withdrawn':
      return 'withdrawn';
    case undefined:
      return 'none';
  }
}

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function presentBadge(record: BadgeRecord, now: Date): BadgeView {
  const state = stateOf(record, now);
  const badge = badgeFrom(record.checks, now);
  const pending = pendingApplication(record.checks);
  const code = currentCode(record, now);

  return {
    checkedAt: iso(badge?.checkedAt ?? null),
    codeEntered: code?.usedAt != null,
    codeExpiresAt: code && codeIsLive(code, now) ? code.expiresAt.toISOString() : null,
    decision: decisionOf(record, now),
    dueAt: iso(badge?.dueAt ?? null),
    lapsesAt: iso(badge?.lapsesAt ?? null),
    // Only from a `pass` (PRD 025 criterion 5): the declared number is not shown back, even to its author.
    number: badge?.number ?? null,
    register: badge?.register ?? pending?.register ?? null,
    state
  };
}

function presentCheck(check: ProfessionalBadgeCheck): BadgeCheckView {
  return {
    channel: check.channel,
    checkedAt: check.checkedAt.toISOString(),
    dueAt: iso(check.dueAt),
    kind: check.kind,
    number: check.number,
    reason: check.reason,
    register: check.register
  };
}

function presentStanding(badge: Badge): NonNullable<BadgeRecordView['badge']> {
  return {
    channel: badge.channel,
    checkedAt: badge.checkedAt.toISOString(),
    dueAt: badge.dueAt.toISOString(),
    lapsesAt: badge.lapsesAt.toISOString(),
    number: badge.number,
    register: badge.register
  };
}

/** Field by field, so nothing of the row the owner does not need — `checkedBy`, a code's hash — reaches the console. */
function presentRecord(account: { email: string; name: string; userId: string }, record: BadgeRecord, now: Date): BadgeRecordView {
  const pending = pendingApplication(record.checks);
  const badge = badgeFrom(record.checks, now);
  const code = currentCode(record, now);

  return {
    application: pending ? { appliedAt: pending.checkedAt.toISOString(), number: pending.number, register: pending.register } : null,
    badge: badge ? presentStanding(badge) : null,
    checks: newestFirst(record.checks).map(presentCheck),
    code: code
      ? { channel: code.channel, entered: code.usedAt !== null, expiresAt: code.expiresAt.toISOString(), live: codeIsLive(code, now) }
      : null,
    email: account.email,
    name: account.name,
    state: stateOf(record, now),
    userId: account.userId
  };
}

/** The account an owner's act names; a 404 when there is none, as for a stranger. */
async function accountOf(userId: string): Promise<{ email: string; name: string; userId: string }> {
  const account = await UserRepository.findById(userId);

  if (!account) {
    throw new NotFoundError(NOT_FOUND);
  }

  return { email: account.email, name: account.name, userId };
}

/** The statement's reason as the record keeps it: the closed reason, and the owner's facts after it. */
function storedReason(input: RemoveBadge): string {
  return input.facts === undefined ? input.reason : `${input.reason}: ${input.facts}`;
}

/**
 * The badge (`0111` §§ 2–3, PRD 025 scope 6): the practitioner applies and
 * enters a code; the owner sends the code, confirms, refuses or withdraws; the
 * daily sweep lapses what nobody re-checked. Every per-account method takes the
 * account's id from its caller — the session's for the practitioner, the one
 * the owner named in the console — and no body ever names one.
 */
export const ProfessionalBadgeController = {
  /**
   * The practitioner applies with their register and number. A 404 while a
   * badge stands — the yearly re-check is the owner's. A second application
   * while one waits replaces it, and any code not yet entered expires.
   */
  async apply(userId: string, input: ApplyForBadge, now: Date = new Date()): Promise<BadgeView> {
    if (!(await ProfessionalBadgeRepository.apply(userId, input, now))) {
      throw new NotFoundError(NOT_FOUND);
    }

    return ProfessionalBadgeController.state(userId, now);
  },

  /**
   * The owner confirms: a `pass` due twelve months on. A 404 unless there is a
   * code entered for an application, or a badge to renew.
   *
   * When no badge stood just before (lapsed by the clock, or lost to a `fail`,
   * and not yet swept), the practitioner's open links narrow first, in the same
   * transaction (`CareRepository.narrowLinksOf`, project 025 phase 5): a badge
   * that comes back widens nothing until each client consents afresh. A renewal
   * under a standing badge narrows nothing.
   */
  async confirm(userId: string, ownerId: string, now: Date = new Date()): Promise<BadgeRecordView> {
    const account = await accountOf(userId);

    if (!(await ProfessionalBadgeRepository.confirm(userId, ownerId, now, tx => CareRepository.narrowLinksOf(userId, now, tx)))) {
      throw new NotFoundError(NOT_FOUND);
    }

    return presentRecord(account, await ProfessionalBadgeRepository.record(userId), now);
  },

  /**
   * The practitioner enters a code. Every refusal — unknown, wrong, used,
   * expired, past its attempts, or no code at all — is the same 404 (PRD 025
   * criterion 3). Entering it gives no badge: the owner confirms.
   */
  async enterCode(userId: string, input: EnterBadgeCode, now: Date = new Date()): Promise<void> {
    if (!(await ProfessionalBadgeRepository.enterCode(userId, badgeCodeHash(input.code), now))) {
      throw new NotFoundError(NOT_FOUND);
    }
  },

  /**
   * The owner issues a code for the application waiting, or for a standing
   * badge's re-check. The code is returned to the caller here and only here;
   * the store keeps its hash. A 404 when the account does not exist, or has
   * nothing to prove.
   */
  async issueCode(userId: string, input: IssueBadgeCode, now: Date = new Date()): Promise<IssuedBadgeCode> {
    await accountOf(userId);
    const code = newBadgeCode();
    const issued = await ProfessionalBadgeRepository.issueCode(userId, input.channel, badgeCodeHash(code), now);

    if (!issued) {
      throw new NotFoundError(NOT_FOUND);
    }

    return { channel: input.channel, code, expiresAt: issued.expiresAt, number: issued.number, register: issued.register, userId };
  },

  /** The owner's list: applications waiting, and badges due — the soonest to lapse first. */
  async queue(now: Date = new Date()): Promise<BadgeQueueView> {
    const rows = (await ProfessionalBadgeRepository.queue()).map(row => {
      const { checks: _checks, ...view } = presentRecord(row, { checks: row.checks, code: row.code }, now);

      return view;
    });

    return {
      applications: rows.filter(row => row.application !== null),
      due: rows
        .filter(row => row.badge !== null && row.badge.dueAt <= now.toISOString())
        .sort((a, b) => (a.badge?.lapsesAt ?? '').localeCompare(b.badge?.lapsesAt ?? ''))
    };
  },

  /** One practitioner's whole record, for the console. A 404 when the account does not exist. */
  async record(userId: string, now: Date = new Date()): Promise<BadgeRecordView> {
    const account = await accountOf(userId);

    return presentRecord(account, await ProfessionalBadgeRepository.record(userId), now);
  },

  /**
   * The owner refuses an application (`fail`) or takes a badge back
   * (`withdrawn`), with the reason the statement carries. A 404 when there is
   * no application, or no badge, to decide. The badge closes on the
   * practitioner's next request: `badgeOf` reads this row.
   *
   * A badge withdrawn narrows every open link of that practitioner in the same
   * transaction (`CareRepository.narrowLinksOf`, project 025 phase 5): the
   * client's consent to the badged list does not outlive the badge, so a badge
   * granted again widens nothing until the client consents afresh. Nothing is
   * sent to any client.
   */
  async remove(userId: string, ownerId: string, input: RemoveBadge, now: Date = new Date()): Promise<BadgeRemoval> {
    const account = await accountOf(userId);
    // The links narrow and the profile returns to the queue in the withdrawal's own transaction (`badgeGone`).
    const removed = await ProfessionalBadgeRepository.remove(userId, ownerId, input.kind, storedReason(input), now, badgeGone(userId, now));

    if (!removed) {
      throw new NotFoundError(NOT_FOUND);
    }

    return {
      checkedAt: removed.checkedAt,
      facts: input.facts ?? null,
      kind: removed.kind,
      number: removed.number,
      reason: input.reason,
      record: presentRecord(account, await ProfessionalBadgeRepository.record(userId), now),
      register: removed.register,
      source: input.source,
      to: account.email
    };
  },

  /** The practitioner's own badge. Read afresh: nothing is cached. */
  async state(userId: string, now: Date = new Date()): Promise<BadgeView> {
    return presentBadge(await ProfessionalBadgeRepository.record(userId), now);
  },

  /**
   * The daily sweep (PLAN phase 3, step 4), **only while the `professional`
   * switch is on** — null otherwise, and nothing is written or mailed. The badge
   * still lapses by date while it is off: `badgeFrom` reads the date, not this.
   *
   * Lapses first, so a badge lapsed today is not also reminded; then the
   * practitioners whose re-check fell due since the last pass that reminded
   * (`BADGE_REMINDERS_MARK`); then the owner's counts. Addresses only for the
   * practitioners' own mails; the owner's alert gets counts.
   */
  async sweep(now: Date = new Date()): Promise<BadgeSweep | null> {
    if (!(await SettingsRepository.isEnabled(FLAGS.professional.key, FLAGS.professional.fallback))) {
      return null;
    }

    // A profile carrying a badge-only word returns to the owner's queue with the lapse (`0111` § 7), in its transaction.
    // The links are the illness rule's sweep's, which runs after this one (`CareRepository.sweepBadgeLoss`).
    const lapsed = await ProfessionalBadgeRepository.lapseOverdue(now, (tx, userId) =>
      ProfessionalProfileRepository.requeueIf(tx, userId, now, carriesBadgeWord)
    );
    const since = await reminderWindow(now);
    const due = since === null ? [] : await ProfessionalBadgeRepository.dueWithin(since, now);
    const counts = await ProfessionalBadgeRepository.dueCounts(now, BADGE_SOON_DAYS);

    const addresses = async <T extends { readonly userId: string }>(rows: readonly T[]): Promise<(T & { readonly to: string })[]> => {
      const found = await Promise.all(rows.map(async row => ({ account: await UserRepository.findById(row.userId), row })));

      return found.flatMap(({ account, row }) => (account ? [{ ...row, to: account.email }] : []));
    };

    return { counts, lapsed: await addresses(lapsed), reminders: await addresses(due) };
  }
};
