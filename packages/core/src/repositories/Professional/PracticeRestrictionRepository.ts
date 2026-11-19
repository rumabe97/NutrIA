import { asc, eq, inArray } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { practiceRestrictions, professionals } from 'database/schema/professional';

import { DatabaseOperationError } from 'core/entities/Error';
import { practiceRestrictionSchema } from 'core/entities/Professional';

import { ProfessionalBadgeRepository } from './ProfessionalBadgeRepository';

import type { PracticeRestriction, PracticeRestrictionKind } from 'core/entities/Professional';

type Tx = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

/** Where a restriction is read from: the pool, or a transaction the caller holds. */
export type RestrictionReader = ReturnType<typeof database> | Tx;

/** A suspension that stands: when the owner decided it, and the statement of reasons as stored. */
export interface StandingSuspension {
  readonly actedAt: Date;
  readonly reason: string | null;
}

/** A close that stands: the row that decided it, and the day the practice closes. */
export interface StandingClose {
  readonly id: string;
  readonly actedAt: Date;
  readonly actedBy: string | null;
  readonly effectiveAt: Date;
  readonly reason: string | null;
}

/**
 * **What stands against an account as a practitioner** (PRD 025 scope 16,
 * criterion 24) — the one definition, folded from the account's rows by
 * `restrictionFrom` and read by `PracticeRestrictionRepository.standing` and
 * nothing else.
 *
 * The two restrictions are separate, because they can both stand: a practice
 * suspended at once may also be closing (`textos/06` § W bis.3, «es decir,
 * suspendida»). A `lifted` row lifts both.
 */
export interface RestrictionStanding {
  /** The close that stands, or null. A close past its date is a closed practice and still stands: it bars reopening. */
  readonly closing: StandingClose | null;
  /** The suspension that stands, or null. */
  readonly suspended: StandingSuspension | null;
}

/** Nothing stands. */
export const UNRESTRICTED: RestrictionStanding = { closing: null, suspended: null };

/** Oldest first: by when the owner acted, then by when the row was written. */
function oldestFirst(rows: readonly PracticeRestriction[]): readonly PracticeRestriction[] {
  return [...rows].sort((a, b) => a.actedAt.getTime() - b.actedAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * The fold, in the order the owner acted: `suspended` suspends, `closing` sets
 * the close (a later one replaces an earlier one), and `lifted` clears both —
 * the suspension, and a close whether or not its date has come, so a close the
 * owner takes back lets the account open a practice again (P2B art. 4.3).
 * `rows` in any order; rows of other accounts must not be passed.
 */
export function restrictionFrom(rows: readonly PracticeRestriction[]): RestrictionStanding {
  let standing: RestrictionStanding = UNRESTRICTED;

  for (const row of oldestFirst(rows)) {
    switch (row.kind) {
      case 'suspended':
        standing = { ...standing, suspended: { actedAt: row.actedAt, reason: row.reason } };
        break;
      case 'closing':
        // The database refuses a `closing` without its date; a row read without one decides nothing.
        standing =
          row.effectiveAt === null
            ? standing
            : { ...standing, closing: { id: row.id, actedAt: row.actedAt, actedBy: row.actedBy, effectiveAt: row.effectiveAt, reason: row.reason } };
        break;
      case 'lifted':
        standing = UNRESTRICTED;
        break;
    }
  }

  return standing;
}

/**
 * Whether no client route opens for this account **now**: a suspension, or a
 * close whose date has come — the practice is closed from that instant, whether
 * or not the daily sweep has deleted its row yet. Before its date a closing
 * practice works as it did (`textos/06` § W bis.3).
 */
export function blocksPractice(standing: RestrictionStanding, now: Date): boolean {
  return standing.suspended !== null || (standing.closing !== null && standing.closing.effectiveAt.getTime() <= now.getTime());
}

/** Whether this account may not open a practice: anything standing — suspended, closing, or closed (PRD 025 criterion 24). */
export function barsOpening(standing: RestrictionStanding): boolean {
  return standing.suspended !== null || standing.closing !== null;
}

/** What the owner's act came to: the standing before and after it. */
export interface RestrictionAct {
  readonly after: RestrictionStanding;
  readonly before: RestrictionStanding;
}

/**
 * The owner's acts on an account as a practitioner (`practice_restrictions`,
 * append-only): suspend, close with notice, lift. Owned by the **account**, so a
 * close outlives the `professionals` row it deletes and the account cannot open
 * a practice again until the owner lifts it. Never cached: read on every
 * request that asks.
 */
export const PracticeRestrictionRepository = {
  /**
   * Writes one owner's act, when `decide` allows it on what stands — read inside
   * the transaction, under the practitioner's badge lock
   * (`ProfessionalBadgeRepository.lock`, the first lock taken on that account,
   * as every writer of that practitioner's rows takes it), so two clicks fired
   * together decide one after the other and the second sees the first. `decide`
   * also learns whether the account has a practice now. Null when refused:
   * nothing is written.
   */
  async act(
    userId: string,
    row: { readonly actedBy: string; readonly effectiveAt: Date | null; readonly kind: PracticeRestrictionKind; readonly reason: string | null },
    now: Date,
    decide: (standing: RestrictionStanding, practising: boolean) => boolean
  ): Promise<RestrictionAct | null> {
    try {
      return await database().transaction(async tx => {
        await ProfessionalBadgeRepository.lock(tx, userId);

        const [before, [practice]] = await Promise.all([
          standingIn(tx, userId),
          tx.select({ id: professionals.id }).from(professionals).where(eq(professionals.userId, userId)).limit(1)
        ]);

        if (!decide(before, practice !== undefined)) {
          return null;
        }

        await tx.insert(practiceRestrictions).values({ ...row, actedAt: now, userId });

        return { after: await standingIn(tx, userId), before };
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every account whose close has come and whose `professionals` row is still
   * there: the daily sweep's list (PRD 025 scope 16). Few rows — only accounts
   * that ever had a close — folded by the one definition.
   */
  async dueClosings(now: Date): Promise<readonly { readonly closing: StandingClose; readonly userId: string }[]> {
    try {
      const db = database();
      const closed = db.select({ userId: practiceRestrictions.userId }).from(practiceRestrictions).where(eq(practiceRestrictions.kind, 'closing'));
      const rows = await db
        .select({ row: practiceRestrictions })
        .from(practiceRestrictions)
        .innerJoin(professionals, eq(professionals.userId, practiceRestrictions.userId))
        .where(inArray(practiceRestrictions.userId, closed))
        .orderBy(asc(practiceRestrictions.userId));
      const byUser = new Map<string, PracticeRestriction[]>();

      for (const { row } of rows) {
        const parsed = practiceRestrictionSchema.parse(row);

        byUser.set(parsed.userId, [...(byUser.get(parsed.userId) ?? []), parsed]);
      }

      return [...byUser].flatMap(([userId, own]) => {
        const { closing } = restrictionFrom(own);

        return closing && closing.effectiveAt.getTime() <= now.getTime() ? [{ closing, userId }] : [];
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * **The one reader** (PRD 025 criterion 24): what stands against this account
   * as a practitioner, by `restrictionFrom`. `db` is the caller's transaction
   * when it holds one, so the read runs on the connection that already holds its
   * locks.
   */
  async standing(userId: string, db: RestrictionReader = database()): Promise<RestrictionStanding> {
    try {
      return await standingIn(db, userId);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** What stands against each account named; an account with nothing standing is absent. For the owner's list. */
  async standings(userIds: readonly string[]): Promise<ReadonlyMap<string, RestrictionStanding>> {
    if (userIds.length === 0) {
      return new Map();
    }

    try {
      const rows = await database()
        .select()
        .from(practiceRestrictions)
        .where(inArray(practiceRestrictions.userId, [...userIds]));
      const byUser = new Map<string, PracticeRestriction[]>();

      for (const row of rows) {
        const parsed = practiceRestrictionSchema.parse(row);

        byUser.set(parsed.userId, [...(byUser.get(parsed.userId) ?? []), parsed]);
      }

      const standings = new Map<string, RestrictionStanding>();

      for (const [userId, own] of byUser) {
        const standing = restrictionFrom(own);

        if (barsOpening(standing)) {
          standings.set(userId, standing);
        }
      }

      return standings;
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

async function standingIn(db: RestrictionReader, userId: string): Promise<RestrictionStanding> {
  const rows = await db.select().from(practiceRestrictions).where(eq(practiceRestrictions.userId, userId));

  return restrictionFrom(rows.map(row => practiceRestrictionSchema.parse(row)));
}

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on practice_restrictions: ${error.message}`);
  }

  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
