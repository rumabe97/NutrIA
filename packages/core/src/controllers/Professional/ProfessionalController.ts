import { assertOldEnough } from 'core/controllers/Profile';
import { CareRepository } from '#repositories/Care';
import {
  barsOpening,
  blocksPractice,
  PracticeRestrictionRepository,
  ProfessionalBadgeRepository,
  ProfessionalProfileRepository,
  ProfessionalRepository
} from '#repositories/Professional';
import { ProfileRepository } from '#repositories/Profile';
import { SettingsRepository } from '#repositories/Settings';
import { UserRepository } from '#repositories/User';
import { AuditRepository } from '#repositories/Audit';
import { FLAGS } from 'core/domain/Flag';
import { NotFoundError, UnderMinimumAgeError } from 'core/entities/Error';
import { professionalQuerySchema } from 'core/entities/AdminQuery';
import { PRACTICE_CLOSE_NOTICE_DAYS, PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';

import { carriesBadgeWord } from './ProfessionalProfileController';

import type { Badge, ProfessionalListRow, RestrictionAct, RestrictionStanding } from '#repositories/Professional';
import type {
  AcceptAgreement,
  LiftRestriction,
  OpenPractice,
  PracticeRestrictionKind,
  Professional,
  RestrictionSource,
  RestrictPractice
} from 'core/entities/Professional';
import type { ProfessionalQuery } from 'core/entities/AdminQuery';
import type { AuditAction, AuditMetadataByAction } from 'core/entities/Audit';
import type { RecordAudit } from '#repositories/Audit';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every refusal here says what the guard's 404 says, byte for byte: a different
 * message would tell one refusal from a route the caller cannot see.
 */
const NOT_FOUND = 'Not Found';

// --- Presenters ---------------------------------------------------------------

/**
 * The owner's statement of reasons for a suspension or a close, as stored and
 * read back (`textos/06` § W bis.1): the facts, the section of the agreement
 * read with § 13, where the decision came from, and the authority when that is
 * the source. Null fields are absent from the statement.
 */
export interface RestrictionStatementView {
  authority: string | null;
  clause: number | null;
  facts: string;
  source: RestrictionSource;
}

/**
 * What the owner has standing against a practice (PRD 025 scope 16), as both
 * the practitioner's page and the console read it: the suspension, and the
 * close with the day it closes — `closed` once that day has come. Each carries
 * its statement, so it can be read whatever happened to its mail. Never who
 * decided it: that is the owner's own id.
 */
export interface PracticeRestrictionView {
  closing: { closed: boolean; closesAt: string; decidedAt: string; statement: RestrictionStatementView | null } | null;
  suspended: { since: string; statement: RestrictionStatementView | null } | null;
}

/**
 * The professional's own practice, as they may read it: the number, the date,
 * and what it includes. Never another account's data — `grantedBy` is the
 * owner's id and stays in the row.
 */
export interface ProfessionalView {
  /** True until the current `PROFESSIONAL_AGREEMENT_VERSION` is accepted: no client route opens before it. */
  agreementRequired: boolean;
  /**
   * The standing badge's number, from its `pass` check; null without a badge.
   * Never the `professionals` row's: a number is shown only once checked (PRD
   * 025 criterion 5, PLAN phase 3 step 6).
   */
  collegiateNumber: string | null;
  grantedAt: string;
  includedClients: number;
  practiceOpen: boolean;
  /**
   * True while a suspension stands, or once a close's day has come (PRD 025
   * criterion 24): no client route opens. The practice's own page, the
   * agreement, the badge and the profile stay reachable — none names a client.
   */
  restricted: boolean;
  restriction: PracticeRestrictionView | null;
}

/**
 * How many links a professional holds, per status. A count and never a name:
 * the owner's list may say *how many* clients, and nothing about *who* (`0028`).
 */
export interface LinkCounts {
  active: number;
  ended: number;
  paused: number;
}

/**
 * The session's own account as a practitioner, for `GET /users/me`
 * (`ProfessionalController.openingFor`): whether it practises today, and
 * whether the opening form is worth offering. Display only.
 */
export interface PracticeOpening {
  canOpenPractice: boolean;
  professional: boolean;
}

/** One professional on the owner's list: the account, its practice, and its links counted. */
export interface ProfessionalAccountView {
  /** The number of the badge that stands, from its `pass` check; null without one (PRD 025 criterion 5). */
  collegiateNumber: string | null;
  email: string;
  /**
   * When the practice was opened — by its own account since project 025, by the
   * owner's grant before. Null for an account listed for what stands against it
   * alone: its practice was closed (`practising: false`).
   */
  grantedAt: string | null;
  links: LinkCounts;
  /** Whether the account has a practice now; false for a closed one still under a restriction (invariant review of phase 6, P2-5). */
  practising: boolean;
  /** What the owner has standing against it, shown on the row (PLAN 025 phase 9 step 3). */
  restriction: PracticeRestrictionView | null;
  userId: string;
}

/** The owner's answer after suspending, closing or lifting: the account, and what now stands. */
export interface PracticeRestrictionAnswerView {
  restriction: PracticeRestrictionView | null;
  userId: string;
}

/**
 * An owner's act just written, with what its mail says and where it goes
 * (`textos/06` § W bis): the API answers `answer` and mails the rest. `to` is the
 * account's own address.
 */
export interface PracticeRestrictionAct {
  readonly answer: PracticeRestrictionAnswerView;
  /** The day the practice closes, for a close; null otherwise. */
  readonly closesAt: Date | null;
  readonly kind: PracticeRestrictionKind;
  /** The owner's words: the statement for a suspension or a close, the facts found for a lift. */
  readonly statement: {
    readonly authority: string | null;
    readonly clause: number | null;
    readonly facts: string | null;
    readonly source: RestrictionSource | null;
  };
  /** Whether a suspension stands after the act: a close decided while suspended says so (§ W bis.3 `suspendedSuffix`). */
  readonly suspended: boolean;
  readonly to: string;
  readonly userId: string;
  /** Whether a suspension stood before the act: a lift tells the practitioner only when it lifted one (§ W bis.2 says so). */
  readonly wasSuspended: boolean;
  /**
   * For a lift that ended a close (`textos/06` § W bis.4): the close's day, and
   * whether it had been carried out — the practice already gone. Null otherwise.
   */
  readonly withdrawnClose: { readonly carriedOut: boolean; readonly closesAt: Date } | null;
}

/** What the daily sweep's closes came to: the accounts closed, and those whose close failed (to be logged by id alone). */
export interface CloseRun {
  readonly closed: readonly string[];
  readonly failed: readonly string[];
}

/** An owner's act's audit row, in the act's own transaction (ADR `0071`). Shared with the badge's acts. */
export function audited<A extends AuditAction>(
  action: A,
  actorId: string | null,
  userId: string,
  metadata: AuditMetadataByAction[A]
): (tx: Parameters<RecordAudit>[0]) => Promise<void> {
  return async tx => {
    await AuditRepository.record({ action, actorId, entity: 'professional', metadata, subjectUserId: userId }, tx);
  };
}

/** The statement as `practice_restrictions.reason` keeps it: JSON, so the console and the practitioner can read it back. */
function storedStatement(input: RestrictPractice): string {
  return JSON.stringify({ authority: input.authority ?? null, clause: input.clause ?? null, facts: input.facts, source: input.source });
}

/** A stored statement read back, or null when it is not one (a hand-written row, a lift's facts). */
function readStatement(stored: string | null): RestrictionStatementView | null {
  if (stored === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<RestrictionStatementView>;

    return typeof parsed.facts === 'string' && typeof parsed.source === 'string'
      ? {
          authority: typeof parsed.authority === 'string' ? parsed.authority : null,
          clause: typeof parsed.clause === 'number' ? parsed.clause : null,
          facts: parsed.facts,
          source: parsed.source
        }
      : null;
  } catch {
    return null;
  }
}

/** What stands, for a reader; null when nothing does. Field by field: never the owner's id. */
export function presentRestriction(standing: RestrictionStanding, now: Date): PracticeRestrictionView | null {
  if (!standing.suspended && !standing.closing) {
    return null;
  }

  return {
    closing: standing.closing
      ? {
          closed: standing.closing.effectiveAt.getTime() <= now.getTime(),
          closesAt: standing.closing.effectiveAt.toISOString(),
          decidedAt: standing.closing.actedAt.toISOString(),
          statement: readStatement(standing.closing.reason)
        }
      : null,
    suspended: standing.suspended ? { since: standing.suspended.actedAt.toISOString(), statement: readStatement(standing.suspended.reason) } : null
  };
}

/** Whether this row has accepted the agreement as it reads today. */
function agreementRequired(row: Pick<Professional, 'agreementVersion'>): boolean {
  return row.agreementVersion !== PROFESSIONAL_AGREEMENT_VERSION;
}

function present(row: Professional, badge: Badge | null, standing: RestrictionStanding, now: Date): ProfessionalView {
  return {
    agreementRequired: agreementRequired(row),
    collegiateNumber: badge?.number ?? null,
    grantedAt: row.grantedAt.toISOString(),
    includedClients: row.includedClients,
    practiceOpen: row.practiceOpen,
    restricted: blocksPractice(standing, now),
    restriction: presentRestriction(standing, now)
  };
}

/**
 * Copied field by field, so a column added to the count query cannot reach the
 * owner's screen without somebody deciding it should. The number is the
 * standing badge's, never the `professionals` row's (PRD 025 criterion 5).
 */
function presentAccount(
  row: ProfessionalListRow,
  badge: Badge | undefined,
  standing: RestrictionStanding | undefined,
  now: Date
): ProfessionalAccountView {
  return {
    collegiateNumber: badge?.number ?? null,
    email: row.email,
    grantedAt: row.grantedAt?.toISOString() ?? null,
    links: { active: row.links.active, ended: row.links.ended, paused: row.links.paused },
    practising: row.grantedAt !== null,
    restriction: standing ? presentRestriction(standing, now) : null,
    userId: row.userId
  };
}

/** Whether `birthDate` is on record, or given, and 18 or more: `assertOldEnough` and never null (PRD 025 criterion 1). */
function oldEnough(birthDate: string | null): birthDate is string {
  if (birthDate === null || Number.isNaN(new Date(birthDate).getTime())) {
    return false;
  }

  try {
    assertOldEnough(birthDate);

    return true;
  } catch (error: unknown) {
    if (error instanceof UnderMinimumAgeError) {
      return false;
    }

    throw error;
  }
}

/** The account an owner's act names; a 404 when there is none, as for a stranger. */
async function accountOf(userId: string): Promise<{ readonly email: string }> {
  const account = await UserRepository.findById(userId);

  if (!account) {
    throw new NotFoundError(NOT_FOUND);
  }

  return { email: account.email };
}

/**
 * What a badge gone does inside the transaction that takes it (`0111` §§ 4 and
 * 7): the practitioner's open links narrow for good, and a profile carrying a
 * badge-only word returns to the owner's queue. One closure for the owner's
 * withdrawal (`ProfessionalBadgeController.remove`), so neither half is
 * forgotten. The close of a practice ends its links instead, and requeues the
 * profile alone (`closeDue`).
 */
export function badgeGone(userId: string, now: Date) {
  return async (tx: Parameters<typeof CareRepository.narrowLinksOf>[2]): Promise<void> => {
    await CareRepository.narrowLinksOf(userId, now, tx);
    await ProfessionalProfileRepository.requeueIf(tx, userId, now, carriesBadgeWord);
  };
}

// --- Controller ---------------------------------------------------------------

/**
 * Who practises (`0059`, `0111` § 1): an account with a `professionals` row,
 * which since project 025 the account opens itself. Every method takes the
 * account's id from the caller the way every controller does — the session's
 * for the practitioner, the one the owner named for the console.
 */
export const ProfessionalController = {
  /**
   * The professional accepts their agreement and the practice plan's terms
   * (`docs/legal/textos/01`, `04`), at the version the body names — the schema
   * lets only the current one through. A 404 unless the switch is on and the
   * account has a practice, as every other door to the workspace: the guard
   * asks first, this is the second line.
   */
  async acceptAgreement(userId: string, input: AcceptAgreement, now: Date = new Date()): Promise<ProfessionalView> {
    const row = (await ProfessionalController.isOpen()) ? await ProfessionalRepository.acceptAgreement(userId, input.version, now) : null;

    if (!row) {
      throw new NotFoundError(NOT_FOUND);
    }

    const [badge, standing] = await Promise.all([ProfessionalBadgeRepository.badgeOf(userId, now), PracticeRestrictionRepository.standing(userId)]);

    return present(row, badge, standing, now);
  },

  /**
   * **The owner closes a practice, with notice** (PRD 025 scope 16, `textos/06`
   * § W bis.3): a `closing` row with the statement, closing
   * `PRACTICE_CLOSE_NOTICE_DAYS` from now. The practice works as it did until
   * that day — the 30 days are the owner's to respect, and the code gives them
   * every time; on the day the daily sweep closes it (`closeDue`). Allowed on
   * a suspended practice, which stays suspended. A 404 when the account has no
   * practice or a close already stands; nothing is written.
   *
   * Replaces the 004 revoke, which deleted the practice at once: the owner's
   * immediate tool is the suspension.
   */
  async close(userId: string, ownerId: string, input: RestrictPractice, now: Date = new Date()): Promise<PracticeRestrictionAct> {
    const account = await accountOf(userId);
    const closesAt = new Date(now.getTime() + PRACTICE_CLOSE_NOTICE_DAYS * DAY_MS);
    const act = await PracticeRestrictionRepository.act(
      userId,
      { actedBy: ownerId, effectiveAt: closesAt, kind: 'closing', reason: storedStatement(input) },
      (standing, practising) => practising && standing.closing === null,
      audited('professional.closing', ownerId, userId, { source: input.source })
    );

    if (!act) {
      throw new NotFoundError(NOT_FOUND);
    }

    return restrictionAct(userId, account.email, 'closing', act, now, closesAt, input);
  },

  /**
   * **The daily sweep's close** (PRD 025 scope 16), in one transaction per
   * practice (`ProfessionalRepository.close`): every open link of the
   * practitioner **ends** as if they had ended it (`CareRepository.endLinksOf`,
   * `ended_by = 'professional'`), so each client is free to accept somebody
   * else; a badge that stands is withdrawn, with the close's facts as its reason,
   * and the profile requeued (PLAN phase 6 step 0); then the `professionals`
   * row and its invitations are deleted, as the 004 revoke deleted them. The
   * `closing` row stays, so the account cannot open a practice again until the
   * owner lifts it — and a lift then opens an empty practice.
   *
   * Whatever the `professional` switch says: the owner decided the close, with
   * its date, and nobody practises while the switch is off anyway. Nobody is
   * mailed on the day — the statement went with the notice, and a link the
   * practitioner ends is mailed to nobody. One practice failing does not stop the
   * others; tomorrow's sweep finds it again, and the caller logs it by id.
   *
   * Each close carried out leaves its `professional.closed` audit row in its own
   * transaction, with no actor: the cron, not a person (as
   * `auth.unconfirmed_account_swept` and `auth.2fa_removed_by_owner`).
   */
  async closeDue(now: Date = new Date()): Promise<CloseRun> {
    const closed: string[] = [];
    const failed: string[] = [];

    for (const { closing, userId } of await PracticeRestrictionRepository.dueClosings(now)) {
      const facts = readStatement(closing.reason)?.facts;

      try {
        const done = await ProfessionalRepository.close(
          userId,
          closing.id,
          now,
          // `other: facts`, as the badge's own statements are stored, so the practitioner's badge page reads it back.
          { checkedBy: closing.actedBy, reason: facts === undefined ? 'other' : `other: ${facts}` },
          {
            endLinks: tx => CareRepository.endLinksOf(userId, now, tx),
            record: audited('professional.closed', null, userId, {}),
            // No link is left to narrow: the profile's requeue is all a badge gone still asks here.
            whenWithdrawn: tx => ProfessionalProfileRepository.requeueIf(tx, userId, now, carriesBadgeWord)
          }
        );

        if (done) {
          closed.push(userId);
        }
      } catch {
        // The next practice is not held back by this one; the sweep's caller logs it by id alone.
        failed.push(userId);
      }
    }

    return { closed, failed };
  },

  /**
   * The account's own practice, or null when it has none.
   *
   * Null rather than a throw because the caller's question is "am I one?", and
   * a route that must refuse does so itself, as a 404 like every other denial.
   */
  async find(userId: string, now: Date = new Date()): Promise<ProfessionalView | null> {
    const row = await ProfessionalRepository.find(userId);

    if (!row) {
      return null;
    }

    // The badge and the restriction only for a practitioner: an ordinary account's question costs one read, not three.
    const [badge, standing] = await Promise.all([ProfessionalBadgeRepository.badgeOf(userId, now), PracticeRestrictionRepository.standing(userId)]);

    return present(row, badge, standing, now);
  },

  /**
   * Whether this account may use the workspace *today*: the `professional`
   * switch is on **and** the account has a practice.
   *
   * The switch first. Off, nobody is a professional — the workspace does not
   * exist, whatever the table says — so a practitioner is an ordinary account
   * until the owner's legal review throws it. Read on every request the guard
   * sees, never cached: a close carried out closes access on the very next one.
   * A suspension does not answer here — the practice's own page still opens —
   * but in `find(...).restricted`, which every client route asks.
   */
  async hasAccess(userId: string): Promise<boolean> {
    if (!(await ProfessionalController.isOpen())) {
      return false;
    }

    return (await ProfessionalRepository.find(userId)) !== null;
  },

  /**
   * Whether the workspace exists at all: the `professional` switch, failing
   * off. The door for the routes an invited *client* uses — no practice to ask
   * about — read on every request like `hasAccess`, never cached.
   */
  async isOpen(): Promise<boolean> {
    return SettingsRepository.isEnabled(FLAGS.professional.key, FLAGS.professional.fallback);
  },

  /**
   * **The owner lifts what stands** (`textos/06` §§ W bis.2 and W bis.4): a
   * `lifted` row, which ends the suspension and a close alike — a close not yet
   * carried out will not happen, and a practice already closed may be opened
   * again (P2B art. 4.3), empty: its links ended with the close and its badge was
   * withdrawn. A 404 when nothing stands; nothing is written. `withdrawnClose`
   * says which close mail goes, and whether it had been carried out — the
   * practice row already gone when the lift was decided.
   */
  async lift(userId: string, ownerId: string, input: LiftRestriction, now: Date = new Date()): Promise<PracticeRestrictionAct> {
    const account = await accountOf(userId);
    const act = await PracticeRestrictionRepository.act(
      userId,
      { actedBy: ownerId, effectiveAt: null, kind: 'lifted', reason: input.facts ?? null },
      standing => barsOpening(standing),
      (tx, lifted) =>
        audited('professional.restriction_lifted', ownerId, userId, {
          close: lifted.before.closing !== null,
          suspension: lifted.before.suspended !== null
        })(tx)
    );

    if (!act) {
      throw new NotFoundError(NOT_FOUND);
    }

    const closing = act.before.closing;

    return {
      answer: { restriction: presentRestriction(act.after, now), userId },
      closesAt: null,
      kind: 'lifted',
      statement: { authority: null, clause: null, facts: input.facts ?? null, source: null },
      suspended: false,
      to: account.email,
      userId,
      wasSuspended: act.before.suspended !== null,
      withdrawnClose: closing ? { carriedOut: !act.practising, closesAt: closing.effectiveAt } : null
    };
  },

  /**
   * Every practitioner for the owner's screen — accounts, counts and what stands
   * against each, never a client — searched and sorted as the query asks; most
   * recently opened first when it asks nothing.
   *
   * **And every account a restriction still stands against that has no
   * practice** (invariant review of phase 6, P2-5): a practice closed on its day
   * loses its row, and the owner must still find the account to lift the close.
   * Those come after the practices, matched by the same address search, with
   * `practising: false` and no opening date; their links are counted as for
   * anybody — counts, never a client.
   */
  async list(query: ProfessionalQuery = professionalQuerySchema.parse({}), now: Date = new Date()): Promise<readonly ProfessionalAccountView[]> {
    const [rows, closed] = await Promise.all([ProfessionalRepository.list(query), ProfessionalRepository.listWithoutPractice(query)]);
    const ids = [...rows, ...closed].map(row => row.userId);
    const [badges, standings] = await Promise.all([ProfessionalBadgeRepository.badgesOf(ids, now), PracticeRestrictionRepository.standings(ids)]);

    return [
      ...rows.map(row => presentAccount(row, badges.get(row.userId), standings.get(row.userId), now)),
      // `standings` holds only accounts something stands against: a lifted one is not listed.
      ...closed.flatMap(row => {
        const standing = standings.get(row.userId);

        return standing ? [presentAccount(row, badges.get(row.userId), standing, now)] : [];
      })
    ];
  },

  /**
   * **An account opens its own practice** (PRD 025 scope 1, criterion 1).
   *
   * Every refusal is the same 404 and writes nothing: the switch off; an
   * address not confirmed or an account not opened by the owner; no birth date
   * on record and none given, or one under 18 (`assertOldEnough`, never passed
   * a null); a suspension, a close, or a closed practice standing against the
   * account (PRD 025 criterion 24). The body's birth date is used only when
   * none is on record, and kept on the account's profile with the practice.
   *
   * An account that already practises, with nothing standing against it, is
   * answered as one just opened, and nothing is written: opening is
   * idempotent. Opening grants nothing paid — `practiceOpen` and
   * `includedClients` keep their defaults, and the free seats are an allowance
   * (`practiceClients`) — and no badge: only the owner's check gives one. The
   * agreement is asked next, on the practice's own page, before any client
   * route opens.
   */
  async open(userId: string, input: OpenPractice, locale: string | null = null, now: Date = new Date()): Promise<void> {
    if (!(await ProfessionalController.isOpen())) {
      throw new NotFoundError(NOT_FOUND);
    }

    const account = await UserRepository.findById(userId);

    if (!account?.emailVerified || account.activatedAt === null) {
      throw new NotFoundError(NOT_FOUND);
    }

    const onRecord = (await ProfileRepository.findByUserId(userId))?.birthDate ?? null;
    const birthDate = onRecord ?? input.birthDate ?? null;

    if (!oldEnough(birthDate)) {
      throw new NotFoundError(NOT_FOUND);
    }

    const outcome = await ProfessionalRepository.open(userId, { birthDate: onRecord === null ? birthDate : null, locale }, now, async tx =>
      barsOpening(await PracticeRestrictionRepository.standing(userId, tx))
    );

    if (outcome === 'barred') {
      throw new NotFoundError(NOT_FOUND);
    }
  },

  /**
   * What the session's own account is, and may become, as a practitioner — what
   * `GET /users/me` shows, display only: every route asks its guard again.
   *
   * `professional` is `hasAccess`'s answer. `canOpenPractice` is true exactly
   * when the switch is on, the account has no practice, and nothing stands
   * against it that bars opening — the half of `open`'s refusals that is about
   * the practice, through the same `barsOpening`. It does **not** ask the
   * confirmed address, the owner's activation or the age: those are `open`'s to
   * refuse with its 404, and this is not a second definition of who may open.
   *
   * Cost: the switch alone while it is off; with it on, the practice row, and
   * the restrictions only for an account that has none.
   */
  async openingFor(userId: string): Promise<PracticeOpening> {
    if (!(await ProfessionalController.isOpen())) {
      return { canOpenPractice: false, professional: false };
    }

    if ((await ProfessionalRepository.find(userId)) !== null) {
      return { canOpenPractice: false, professional: true };
    }

    return { canOpenPractice: !barsOpening(await PracticeRestrictionRepository.standing(userId)), professional: false };
  },

  /**
   * **The owner suspends an account as a practitioner** (PRD 025 scope 16,
   * `textos/06` § W bis.1): a `suspended` row with the statement, immediate —
   * from the next request no client route opens (`find(...).restricted`,
   * `practises`, `CareRepository.activeLink`), no invitation goes out or is
   * answered, and no practice can be opened. Nothing about the practice is
   * deleted, so lifting it restores everything as it was. A 404 when the account
   * has no practice or is already suspended; nothing is written.
   */
  async suspend(userId: string, ownerId: string, input: RestrictPractice, now: Date = new Date()): Promise<PracticeRestrictionAct> {
    const account = await accountOf(userId);
    const act = await PracticeRestrictionRepository.act(
      userId,
      { actedBy: ownerId, effectiveAt: null, kind: 'suspended', reason: storedStatement(input) },
      (standing, practising) => practising && standing.suspended === null,
      audited('professional.suspended', ownerId, userId, { source: input.source })
    );

    if (!act) {
      throw new NotFoundError(NOT_FOUND);
    }

    return restrictionAct(userId, account.email, 'suspended', act, now, null, input);
  }
};

function restrictionAct(
  userId: string,
  to: string,
  kind: 'closing' | 'suspended',
  act: RestrictionAct,
  now: Date,
  closesAt: Date | null,
  input: RestrictPractice
): PracticeRestrictionAct {
  return {
    answer: { restriction: presentRestriction(act.after, now), userId },
    closesAt,
    kind,
    statement: { authority: input.authority ?? null, clause: input.clause ?? null, facts: input.facts, source: input.source },
    suspended: act.after.suspended !== null,
    to,
    userId,
    wasSuspended: act.before.suspended !== null,
    withdrawnClose: null
  };
}
