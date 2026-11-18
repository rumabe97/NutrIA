import { timingSafeEqual } from 'node:crypto';

import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { professionalBadgeChecks, professionalBadgeCodes } from 'database/schema/professional';
import { user } from 'database/schema/auth';

import { ConflictError, DatabaseOperationError } from 'core/entities/Error';
import {
  BADGE_CODE_MAX_ATTEMPTS,
  BADGE_CODE_TTL_DAYS,
  BADGE_GRACE_DAYS,
  BADGE_VALID_MONTHS,
  professionalBadgeCheckSchema,
  professionalBadgeCodeSchema
} from 'core/entities/Professional';

import type { ApplyForBadge, BadgeChannel, BadgeLapseDetail, ProfessionalBadgeCheck, ProfessionalBadgeCode } from 'core/entities/Professional';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A check that decides the badge; `applied` is a declaration and decides nothing (`0111` § 2). */
const DECISIVE: readonly ProfessionalBadgeCheck['kind'][] = ['pass', 'fail', 'withdrawn', 'lapsed'];

/**
 * A badge that stands: the `pass` it rests on, when its re-check falls due and
 * when, with nobody re-checking, it lapses. `checkedBy` is not here — it is the
 * owner's account and no reader of a badge needs it.
 */
export interface Badge {
  readonly channel: BadgeChannel | null;
  readonly checkedAt: Date;
  readonly checkId: string;
  readonly dueAt: Date;
  readonly lapsesAt: Date;
  readonly number: string | null;
  readonly register: string | null;
}

/** A practitioner's whole record: every check, newest first, and their newest code. */
export interface BadgeRecord {
  readonly checks: readonly ProfessionalBadgeCheck[];
  readonly code: ProfessionalBadgeCode | null;
}

/** What a code was issued for: the check it proves, and when it stops working. */
export interface IssuedCheck {
  readonly expiresAt: Date;
  readonly number: string;
  readonly register: string;
}

/** A `fail` or `withdrawn` just written: what the statement of reasons cites. */
export interface RemovedCheck {
  readonly checkedAt: Date;
  readonly kind: 'fail' | 'withdrawn';
  readonly number: string | null;
  readonly register: string | null;
}

/** A badge the sweep has just lapsed: whose, when it had fallen due, and which reason it wrote. */
export interface LapsedBadge {
  readonly detail: BadgeLapseDetail;
  readonly dueAt: Date;
  readonly userId: string;
}

/** A badge whose re-check fell due inside the sweep's window: the practitioner's one reminder (`textos/06` § U.2). */
export interface DueBadge {
  readonly lapsesAt: Date;
  readonly register: string | null;
  readonly userId: string;
}

/** One practitioner on the owner's badge list: the account, what they declared, and where it stands. */
export interface BadgeQueueRow {
  readonly checks: readonly ProfessionalBadgeCheck[];
  readonly code: ProfessionalBadgeCode | null;
  readonly email: string;
  readonly name: string;
  readonly userId: string;
}

// --- The one definition of the badge -------------------------------------------

/** Newest first: by the check's date, then by when the row was written. */
export function newestFirst(checks: readonly ProfessionalBadgeCheck[]): readonly ProfessionalBadgeCheck[] {
  return [...checks].sort((a, b) => b.checkedAt.getTime() - a.checkedAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
}

/** When a badge due at `dueAt` lapses if nobody re-checks it. */
export function lapseDate(dueAt: Date): Date {
  return new Date(dueAt.getTime() + BADGE_GRACE_DAYS * DAY_MS);
}

/** Twelve calendar months after `from`: when a `pass` written then falls due. */
export function dueDate(from: Date): Date {
  const due = new Date(from.getTime());

  due.setUTCMonth(due.getUTCMonth() + BADGE_VALID_MONTHS);

  return due;
}

/**
 * **The badge** (`0111` § 2, PRD 025 scope 6): among the decisive checks the
 * latest is a `pass`, and now is before its due date plus the grace. Nothing
 * else in the codebase decides it; `badgeOf` and every bulk reader call this.
 * `checks` in any order.
 */
export function badgeFrom(checks: readonly ProfessionalBadgeCheck[], now: Date): Badge | null {
  const latest = newestFirst(checks).find(check => DECISIVE.includes(check.kind));

  if (latest?.kind !== 'pass' || latest.dueAt === null) {
    return null;
  }

  const lapsesAt = lapseDate(latest.dueAt);

  if (now.getTime() >= lapsesAt.getTime()) {
    return null;
  }

  return {
    channel: latest.channel,
    checkedAt: latest.checkedAt,
    checkId: latest.id,
    dueAt: latest.dueAt,
    lapsesAt,
    number: latest.number,
    register: latest.register
  };
}

/** The application nobody has decided yet: the latest `applied`, when no decisive check came after it. */
export function pendingApplication(checks: readonly ProfessionalBadgeCheck[]): ProfessionalBadgeCheck | undefined {
  for (const check of newestFirst(checks)) {
    if (check.kind === 'applied') {
      return check;
    }

    if (DECISIVE.includes(check.kind)) {
      return undefined;
    }
  }

  return undefined;
}

/** Whether `code` can still be entered: unused, unexpired, and under its cap of wrong attempts. */
export function codeIsLive(code: ProfessionalBadgeCode, now: Date): boolean {
  return code.usedAt === null && code.expiresAt.getTime() > now.getTime() && code.attempts < BADGE_CODE_MAX_ATTEMPTS;
}

// --- Locking -------------------------------------------------------------------

const LOCK_ATTEMPTS = 8;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function backoff(attempt: number): number {
  const base = Math.min(20 * 2 ** (attempt - 1), 250);

  return base + Math.random() * base;
}

type Tx = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

/**
 * Runs `fn` in a transaction holding the practitioner's badge lock, so the
 * practitioner and the owner acting at once each decide on what the other
 * wrote. A try-lock with a short, jittered retry (`EventRepository`'s shape): a
 * blocking wait would pin a pooled connection.
 */
async function underLock<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await wait(backoff(attempt));
    }

    const result = await database().transaction(async tx => {
      const [lock] = await tx.execute<{ held: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtext('professional_badge'), hashtext(${userId})) as held`
      );

      return lock?.held ? { value: await fn(tx) } : undefined;
    });

    if (result) {
      return result.value;
    }
  }

  throw new ConflictError('Another request is still changing this badge');
}

async function checksOf(tx: Tx, userId: string): Promise<readonly ProfessionalBadgeCheck[]> {
  const rows = await tx.select().from(professionalBadgeChecks).where(eq(professionalBadgeChecks.userId, userId));

  return newestFirst(rows.map(row => professionalBadgeCheckSchema.parse(row)));
}

/**
 * Every code not yet entered **expires** whenever the record moves, so a live
 * code always proves the check that stands now. Expired, not deleted: the row
 * stays as the trace that a code went out — to a contact the register lists —
 * and by which channel, until the account goes. `checkId` narrows it to the codes
 * of one check (the sweep's lapse must not kill a code issued for a newer
 * application).
 */
async function expireUnusedCodes(tx: Tx, userId: string, now: Date, checkId?: string): Promise<void> {
  await tx
    .update(professionalBadgeCodes)
    .set({ expiresAt: now, updatedAt: now })
    .where(
      and(
        eq(professionalBadgeCodes.userId, userId),
        isNull(professionalBadgeCodes.usedAt),
        gt(professionalBadgeCodes.expiresAt, now),
        ...(checkId === undefined ? [] : [eq(professionalBadgeCodes.checkId, checkId)])
      )
    );
}

function equalHashes(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

// --- Repository ----------------------------------------------------------------

/**
 * The badge record (`0111` §§ 2–3): `professional_badge_checks`, append-only,
 * and `professional_badge_codes`. Both hang off the practitioner's **account**
 * (`user_id`), so every per-practitioner read and write is by the account's
 * id — the session's for the practitioner, the one the owner named for the
 * console. Nothing here is cached: the badge is read afresh on every request.
 */
export const ProfessionalBadgeRepository = {
  /**
   * The practitioner's application (PRD 025 scope 6): an `applied` check with
   * the register and number they declared. Refused (false) while a badge
   * stands — a re-check is the owner's, not a new application. A new
   * application expires any code not yet entered: that code proved the old one.
   */
  async apply(userId: string, input: ApplyForBadge, now: Date): Promise<boolean> {
    try {
      return await underLock(userId, async tx => {
        if (badgeFrom(await checksOf(tx, userId), now)) {
          return false;
        }

        await expireUnusedCodes(tx, userId, now);
        await tx.insert(professionalBadgeChecks).values({ checkedAt: now, kind: 'applied', number: input.number, register: input.register, userId });

        return true;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The practitioner's badge now, or null. The only per-account reader of the
   * badge: one indexed read of the latest decisive check, judged by `badgeFrom`.
   */
  async badgeOf(userId: string, now: Date): Promise<Badge | null> {
    try {
      const [row] = await database()
        .select()
        .from(professionalBadgeChecks)
        .where(and(eq(professionalBadgeChecks.userId, userId), inArray(professionalBadgeChecks.kind, [...DECISIVE])))
        .orderBy(desc(professionalBadgeChecks.checkedAt), desc(professionalBadgeChecks.createdAt))
        .limit(1);

      return row ? badgeFrom([professionalBadgeCheckSchema.parse(row)], now) : null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** The badge of each account named, by `badgeFrom`; an account without one is absent from the map. */
  async badgesOf(userIds: readonly string[], now: Date): Promise<ReadonlyMap<string, Badge>> {
    if (userIds.length === 0) {
      return new Map();
    }

    try {
      const rows = await database()
        .select()
        .from(professionalBadgeChecks)
        .where(and(inArray(professionalBadgeChecks.userId, [...userIds]), inArray(professionalBadgeChecks.kind, [...DECISIVE])));
      const byUser = groupByUser(rows.map(row => professionalBadgeCheckSchema.parse(row)));
      const badges = new Map<string, Badge>();

      for (const [userId, checks] of byUser) {
        const badge = badgeFrom(checks, now);

        if (badge) {
          badges.set(userId, badge);
        }
      }

      return badges;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The owner's confirmation: a `pass`, due twelve months on. Two cases, and
   * nothing else:
   *
   * - **A first badge**: there is a pending application **and** its code was
   *   entered. The pass carries the register and number the application
   *   declared and the channel the code went by. No entered code, no pass —
   *   only a code proves the register's contact reaches this account.
   * - **The yearly re-check**: a badge stands (due or not). The pass renews it
   *   with the same register and number, and the channel of a code entered for
   *   it, if the owner sent one.
   *
   * Null otherwise. Codes not entered expire.
   */
  async confirm(userId: string, checkedBy: string, now: Date): Promise<Badge | null> {
    try {
      return await underLock(userId, async tx => {
        const checks = await checksOf(tx, userId);
        const pending = pendingApplication(checks);
        const standing = pending ? null : badgeFrom(checks, now);
        const proved = pending ?? (standing ? checks.find(check => check.id === standing.checkId) : undefined);

        if (!proved) {
          return null;
        }

        const [entered] = await tx
          .select({ channel: professionalBadgeCodes.channel })
          .from(professionalBadgeCodes)
          .where(
            and(
              eq(professionalBadgeCodes.userId, userId),
              eq(professionalBadgeCodes.checkId, proved.id),
              sql`${professionalBadgeCodes.usedAt} is not null`
            )
          )
          .orderBy(desc(professionalBadgeCodes.usedAt))
          .limit(1);

        if (pending && !entered) {
          return null;
        }

        await expireUnusedCodes(tx, userId, now);
        const [row] = await tx
          .insert(professionalBadgeChecks)
          .values({
            channel: entered?.channel ?? null,
            checkedAt: now,
            checkedBy,
            dueAt: dueDate(now),
            kind: 'pass',
            number: proved.number,
            register: proved.register,
            userId
          })
          .returning();

        return badgeFrom([professionalBadgeCheckSchema.parse(row)], now);
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The owner's daily count (`textos/06` § U.1): badges that stand and are due,
   * and of them, those that lapse within `soonDays`. Counts only.
   */
  async dueCounts(now: Date, soonDays: number): Promise<{ readonly due: number; readonly soon: number }> {
    try {
      const due = (await latestDecisive(database())).flatMap(check => {
        const badge = badgeFrom([check], now);

        return badge && badge.dueAt.getTime() <= now.getTime() ? [badge] : [];
      });
      const soon = due.filter(badge => badge.lapsesAt.getTime() <= now.getTime() + soonDays * DAY_MS);

      return { due: due.length, soon: soon.length };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Standing badges whose re-check fell due inside `(since, now]` — the day's
   * window of the daily sweep, so each practitioner is reminded on the day it
   * falls due and on no other (`textos/06` § U.2).
   */
  async dueWithin(since: Date, now: Date): Promise<readonly DueBadge[]> {
    try {
      return (await latestDecisive(database()))
        .filter(check => check.kind === 'pass' && check.dueAt !== null && check.dueAt > since && check.dueAt <= now)
        .flatMap(check => {
          const badge = badgeFrom([check], now);

          return badge ? [{ lapsesAt: badge.lapsesAt, register: badge.register, userId: check.userId }] : [];
        });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The practitioner enters a code. True only when it is their live code and
   * the hash matches; the code is then spent. A wrong code counts one attempt
   * against the live one, and at `BADGE_CODE_MAX_ATTEMPTS` the code is dead.
   * Every other case — no live code, used, expired, capped, wrong — is the same
   * false, which the caller answers with the same 404 (PRD 025 criterion 3).
   *
   * Held `FOR UPDATE`, so two entries at once count two attempts and spend the
   * code once. The comparison is constant-time.
   */
  async enterCode(userId: string, codeHash: string, now: Date): Promise<boolean> {
    try {
      return await database().transaction(async tx => {
        const [row] = await tx
          .select()
          .from(professionalBadgeCodes)
          .where(
            and(
              eq(professionalBadgeCodes.userId, userId),
              isNull(professionalBadgeCodes.usedAt),
              gt(professionalBadgeCodes.expiresAt, now),
              lt(professionalBadgeCodes.attempts, BADGE_CODE_MAX_ATTEMPTS)
            )
          )
          .orderBy(desc(professionalBadgeCodes.createdAt))
          .limit(1)
          .for('update');

        if (!row) {
          return false;
        }

        if (equalHashes(row.codeHash, codeHash)) {
          await tx.update(professionalBadgeCodes).set({ updatedAt: now, usedAt: now }).where(eq(professionalBadgeCodes.id, row.id));

          return true;
        }

        await tx
          .update(professionalBadgeCodes)
          .set({ attempts: sql`${professionalBadgeCodes.attempts} + 1`, updatedAt: now })
          .where(eq(professionalBadgeCodes.id, row.id));

        return false;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * A new code, stored by its hash alone, for the check it proves: the pending
   * application, or — for the yearly re-check — the `pass` a standing badge
   * rests on. Null when there is neither, or when that check does not say which
   * register and number (a project 004 grant: the owner confirms its re-check
   * without a code). Every older code not yet entered expires in the same
   * transaction, so there is one live code at a time and its cap is the
   * practitioner's.
   */
  async issueCode(userId: string, channel: BadgeChannel, codeHash: string, now: Date): Promise<IssuedCheck | null> {
    try {
      return await underLock(userId, async tx => {
        const checks = await checksOf(tx, userId);
        const badge = badgeFrom(checks, now);
        const target = pendingApplication(checks) ?? (badge ? checks.find(check => check.id === badge.checkId) : undefined);

        if (!target?.register || !target.number) {
          return null;
        }

        const expiresAt = new Date(now.getTime() + BADGE_CODE_TTL_DAYS * DAY_MS);

        await expireUnusedCodes(tx, userId, now);
        await tx.insert(professionalBadgeCodes).values({ channel, checkId: target.id, codeHash, expiresAt, userId });

        return { expiresAt, number: target.number, register: target.register };
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The daily sweep's lapse (PRD 025 scope 6): for every account whose latest
   * decisive check is a `pass` now past its due date plus the grace, a `lapsed`
   * row with its reason — `code_not_entered` when a code went out for that pass
   * and was never entered, `our_delay` otherwise — dated the instant it lapsed,
   * and that pass's codes not entered expired. Once: a lapsed account's latest decisive row is the `lapsed` one,
   * so tomorrow's sweep finds nothing. Under one global try-lock, so two sweeps
   * at once lapse each badge once; the loser lapses nothing.
   *
   * The badge itself had already gone at that instant — `badgeFrom` reads the
   * date — so this row records the lapse and dates the statement; it closes
   * nothing that was still open.
   */
  async lapseOverdue(now: Date): Promise<readonly LapsedBadge[]> {
    try {
      return await database().transaction(async tx => {
        const [lock] = await tx.execute<{ held: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext('professional_badge_lapse')) as held`);

        if (!lock?.held) {
          return [];
        }

        const overdue = (await latestDecisive(tx)).filter(
          check => check.kind === 'pass' && check.dueAt !== null && lapseDate(check.dueAt).getTime() <= now.getTime()
        );
        const lapsed: LapsedBadge[] = [];

        for (const pass of overdue) {
          const [unentered] = await tx
            .select({ id: professionalBadgeCodes.id })
            .from(professionalBadgeCodes)
            .where(
              and(eq(professionalBadgeCodes.userId, pass.userId), eq(professionalBadgeCodes.checkId, pass.id), isNull(professionalBadgeCodes.usedAt))
            )
            .limit(1);
          const detail: BadgeLapseDetail = unentered ? 'code_not_entered' : 'our_delay';

          const lapsedAt = pass.dueAt === null ? now : lapseDate(pass.dueAt);

          // Only this pass's codes, and the row dated when the badge went: an application made between that instant and
          // this sweep is newer, so it stays pending and keeps its code (invariant review of phase 3, P2-3).
          await expireUnusedCodes(tx, pass.userId, now, pass.id);
          await tx
            .insert(professionalBadgeChecks)
            .values({ checkedAt: lapsedAt, kind: 'lapsed', number: pass.number, reason: detail, register: pass.register, userId: pass.userId });
          lapsed.push({ detail, dueAt: pass.dueAt ?? now, userId: pass.userId });
        }

        return lapsed;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every account with a badge record, for the owner's list: the account's
   * address and name, its checks and its newest code. Never a client, and
   * unpaged: there are few.
   */
  async queue(): Promise<readonly BadgeQueueRow[]> {
    try {
      const db = database();
      const [checks, codes] = await Promise.all([
        db.select().from(professionalBadgeChecks),
        db.select().from(professionalBadgeCodes).orderBy(desc(professionalBadgeCodes.createdAt))
      ]);
      const byUser = groupByUser(checks.map(row => professionalBadgeCheckSchema.parse(row)));
      const userIds = [...byUser.keys()];

      if (userIds.length === 0) {
        return [];
      }

      const accounts = await db
        .select({ id: user.id, email: user.email, name: user.name })
        .from(user)
        .where(inArray(user.id, userIds))
        .orderBy(asc(user.email));
      const newestCode = new Map<string, ProfessionalBadgeCode>();

      for (const code of codes) {
        if (!newestCode.has(code.userId)) {
          newestCode.set(code.userId, professionalBadgeCodeSchema.parse(code));
        }
      }

      return accounts.map(account => ({
        checks: newestFirst(byUser.get(account.id) ?? []),
        code: newestCode.get(account.id) ?? null,
        email: account.email,
        name: account.name,
        userId: account.id
      }));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** One practitioner's whole record, newest first, with their newest code. Two reads by the account's id. */
  async record(userId: string): Promise<BadgeRecord> {
    try {
      const db = database();
      const [checks, [code]] = await Promise.all([
        db.select().from(professionalBadgeChecks).where(eq(professionalBadgeChecks.userId, userId)),
        db
          .select()
          .from(professionalBadgeCodes)
          .where(eq(professionalBadgeCodes.userId, userId))
          .orderBy(desc(professionalBadgeCodes.createdAt))
          .limit(1)
      ]);

      return {
        checks: newestFirst(checks.map(row => professionalBadgeCheckSchema.parse(row))),
        code: code ? professionalBadgeCodeSchema.parse(code) : null
      };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The owner's `fail` (a pending application not granted) or `withdrawn` (a
   * standing badge taken back), with `reason` as the statement of reasons. Null
   * when there is nothing of that kind to decide. Codes not entered expire.
   */
  async remove(userId: string, checkedBy: string, kind: 'fail' | 'withdrawn', reason: string, now: Date): Promise<RemovedCheck | null> {
    try {
      return await underLock(userId, async tx => {
        const checks = await checksOf(tx, userId);
        const badge = kind === 'withdrawn' ? badgeFrom(checks, now) : null;
        const target = kind === 'fail' ? pendingApplication(checks) : badge ? checks.find(check => check.id === badge.checkId) : undefined;

        if (!target) {
          return null;
        }

        await expireUnusedCodes(tx, userId, now);
        await tx
          .insert(professionalBadgeChecks)
          .values({ checkedAt: now, checkedBy, kind, number: target.number, reason, register: target.register, userId });

        return { checkedAt: now, kind, number: target.number, register: target.register };
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

/** Each account's latest decisive check, one per account: what every bulk reader judges with `badgeFrom`. */
async function latestDecisive(db: ReturnType<typeof database> | Tx): Promise<readonly ProfessionalBadgeCheck[]> {
  const rows = await db
    .selectDistinctOn([professionalBadgeChecks.userId])
    .from(professionalBadgeChecks)
    .where(inArray(professionalBadgeChecks.kind, [...DECISIVE]))
    .orderBy(professionalBadgeChecks.userId, desc(professionalBadgeChecks.checkedAt), desc(professionalBadgeChecks.createdAt));

  return rows.map(row => professionalBadgeCheckSchema.parse(row));
}

function groupByUser(checks: readonly ProfessionalBadgeCheck[]): ReadonlyMap<string, ProfessionalBadgeCheck[]> {
  const byUser = new Map<string, ProfessionalBadgeCheck[]>();

  for (const check of checks) {
    byUser.set(check.userId, [...(byUser.get(check.userId) ?? []), check]);
  }

  return byUser;
}

function wrap(error: unknown): Error {
  if (error instanceof ConflictError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on professional_badge_checks: ${error.message}`);
  }

  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
