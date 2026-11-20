import { and, asc, count, eq, gte, lt, notExists, sql } from 'drizzle-orm';

import { database } from 'database';
import { user } from 'database/schema/auth';
import { accountNotices } from 'database/schema/platform';

import { DatabaseOperationError } from 'core/entities/Error';

import type { AccountNotice } from 'core/entities/Notice';

/** An account a notice may go to: its id and its address as stored now. */
export interface NoticeCandidate {
  readonly id: string;
  readonly email: string;
}

/** Where a notice stands: accounts already told, accounts still to tell, and accounts skipped because nobody confirmed their address. */
export interface NoticeCounts {
  readonly alreadySent: number;
  readonly toSend: number;
  readonly unconfirmed: number;
}

/** One account told: when its mail was accepted, in which language, and the day the notice announced. */
export interface NoticeSent {
  readonly effectiveOn: string;
  readonly locale: string;
  readonly sentAt: Date;
}

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}

/** No row for this account and this notice: the account has not been told. */
function untold(notice: AccountNotice) {
  return notExists(
    database()
      .select({ one: sql`1` })
      .from(accountNotices)
      .where(and(eq(accountNotices.userId, user.id), eq(accountNotices.notice, notice)))
  );
}

/**
 * `account_notices` (project 025 phase 10): which account was told which notice.
 * A row is written only once the mail server accepted that account's mail, so an
 * account with a row is never mailed that notice again, and an account without
 * one is still owed it. Every read names the notice; none returns a health
 * datum, and the address is read from `user` only to send.
 */
export const AccountNoticeRepository = {
  /**
   * The accounts owed `notice`: a confirmed address and no row, oldest account
   * first, `limit` of them from `offset`. An unconfirmed address is never one —
   * it may be somebody else's typo — whatever the account's activation.
   *
   * `after` is an account id: only accounts after it in that order. An `after`
   * whose account is gone matches nothing, and the caller starts again.
   */
  async candidates(
    notice: AccountNotice,
    page: { readonly after?: string; readonly limit: number; readonly offset?: number }
  ): Promise<readonly NoticeCandidate[]> {
    try {
      const after =
        page.after === undefined
          ? undefined
          : sql`(${user.createdAt}, ${user.id}) > (select "cursor"."created_at", "cursor"."id" from "user" as "cursor" where "cursor"."id" = ${page.after})`;

      return await database()
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(and(eq(user.emailVerified, true), untold(notice), after))
        .orderBy(asc(user.createdAt), asc(user.id))
        .limit(page.limit)
        .offset(page.offset ?? 0);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** The three counts the console shows, in one read. */
  async counts(notice: AccountNotice): Promise<NoticeCounts> {
    try {
      const [[accounts], [sent]] = await Promise.all([
        database()
          .select({
            toSend: sql<number>`count(*) filter (where ${user.emailVerified})::int`,
            unconfirmed: sql<number>`count(*) filter (where not ${user.emailVerified})::int`
          })
          .from(user)
          .where(untold(notice)),
        database().select({ n: count() }).from(accountNotices).where(eq(accountNotices.notice, notice))
      ]);

      return { alreadySent: sent?.n ?? 0, toSend: accounts?.toSend ?? 0, unconfirmed: accounts?.unconfirmed ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** The day `notice` announced when it was first sent, or null while nobody has been told: one notice, one day. */
  async effectiveOn(notice: AccountNotice): Promise<string | null> {
    try {
      const [row] = await database()
        .select({ effectiveOn: accountNotices.effectiveOn })
        .from(accountNotices)
        .where(eq(accountNotices.notice, notice))
        .orderBy(asc(accountNotices.sentAt))
        .limit(1);

      return row?.effectiveOn ?? null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Runs `fn` while holding the notices' send lock, or answers null when another
   * press holds it: two presses at once would otherwise both pick the same
   * accounts, and both read the daily cap before either wrote. One lock for
   * every notice, because the cap is every notice's together. The lock is held by a transaction of its own and
   * `fn` writes on other connections, so each account's row commits the moment
   * it is written — a batch cut short keeps every row it wrote, and the lock
   * goes with the cut connection.
   */
  async exclusively<T>(fn: () => Promise<T>): Promise<T | null> {
    // A box, not a `let`: the transaction's callback fills it, and the compiler cannot see a closure assign a local.
    const box: { outcome: { readonly error: unknown; readonly ok: false } | { readonly ok: true; readonly value: T } | null } = { outcome: null };

    try {
      await database().transaction(async tx => {
        const [lock] = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext('account_notice'), 0) as locked`);

        if (!lock?.locked) {
          return;
        }

        // What `fn` throws is the caller's, not the lock's: kept apart so it is not mistaken for a database failure.
        try {
          box.outcome = { ok: true, value: await fn() };
        } catch (error: unknown) {
          box.outcome = { error, ok: false };
        }
      });
    } catch (error: unknown) {
      throw wrap(error);
    }

    const settled = box.outcome;

    if (settled === null) {
      return null;
    }

    if (!settled.ok) {
      throw settled.error;
    }

    return settled.value;
  },

  /**
   * Writes that `userId` was told `notice` — right after its mail was accepted,
   * on its own, so it commits at once. A row already there is left as it is.
   */
  async record(userId: string, notice: AccountNotice, sent: NoticeSent): Promise<void> {
    try {
      await database()
        .insert(accountNotices)
        .values({ effectiveOn: sent.effectiveOn, locale: sent.locale, notice, sentAt: sent.sentAt, userId })
        .onConflictDoNothing();
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * How many notice rows were written in `[from, to)`, every notice together:
   * what the daily cap counts.
   */
  async sentBetween(from: Date, to: Date): Promise<number> {
    try {
      const [row] = await database()
        .select({ n: count() })
        .from(accountNotices)
        .where(and(gte(accountNotices.sentAt, from), lt(accountNotices.sentAt, to)));

      return row?.n ?? 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};
