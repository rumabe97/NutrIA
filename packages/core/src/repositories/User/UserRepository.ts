import { and, asc, count, desc, eq, getTableName, gt, inArray, isNotNull, isNull, like, lt, not, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { analyticsEvents, auditLogs, twoFactorRemovals } from 'database/schema/platform';
import { contains, ordered } from '#repositories/Search';
import { database } from 'database';
import { mealPlans } from 'database/schema/plan';
import { onboardingState, profiles } from 'database/schema/profile';
import { professionals } from 'database/schema/professional';
import { signInDevicesOf } from '#repositories/SignInDevice';
import { account, passkey, session, user, verification } from 'database/schema/auth';

import { ACTIVE_EVENTS } from 'core/entities/Analytics';
import { DatabaseOperationError } from 'core/entities/Error';
import { userSchema } from 'core/entities/User';

import type { AccountQuery } from 'core/entities/AdminQuery';
import type { Transaction } from '#repositories/Audit';
import type { SQL } from 'drizzle-orm';
import type { User, UserTier } from 'core/entities/User';

/**
 * `activate`'s watcher: the row it writes names the account that was opened,
 * so it is handed the id the `UPDATE`'s own `RETURNING` found — never the id
 * the caller matched by, which is absent when the match was by email.
 */
export type RecordActivationAudit = (tx: Transaction, subjectUserId: string) => Promise<void>;

/**
 * `setTier`'s watcher: the row it writes names the tier the account moved
 * from, read inside the same transaction as the move — the one place that
 * value is available without a second round trip outside it.
 */
export type RecordTierAudit = (tx: Transaction, from: UserTier) => Promise<void>;

/**
 * How Better Auth's two-factor plugin names a trusted device's `verification`
 * row (`trust-device-<random>`, value = the account id): the row that lets a
 * browser skip the code for thirty days.
 */
const TRUSTED_DEVICE_PREFIX = 'trust-device-';

function trustedDevicesOf(id: string): SQL | undefined {
  return and(eq(verification.value, id), like(verification.identifier, `${TRUSTED_DEVICE_PREFIX}%`));
}

/**
 * `passwordChanged`'s watcher: the audit rows, written in the transaction that clears the breach mark — handed how
 * many passkeys that transaction removed, so each can have its row.
 */
export type RecordPasswordAudit = (tx: Transaction, passkeysRemoved: number) => Promise<void>;

/** `forgetPasskeys`' watcher: one row per passkey the transaction removed. */
export type RecordPasskeysForgotten = (tx: Transaction, passkeysRemoved: number) => Promise<void>;

/**
 * `deleteStaleUnconfirmed`'s watcher: one row per account the `DELETE`
 * actually removed, written inside the same transaction — called with the id
 * the `RETURNING` found, before the row's own cascade clears that id from
 * whatever it names (PLAN 011, "Follow-up — the 30-day sweep of unconfirmed
 * accounts").
 */
export type RecordUnconfirmedSweepAudit = (tx: Transaction, id: string) => Promise<void>;

/**
 * One account on the owner's table: the row's own columns, and four
 * milestones — dates and counts *about* the account, never what it holds
 * (`0028`). No plan is read, only counted; no event is read, only its latest
 * date; no onboarding answer is read, only the day it was finished.
 */
export type AccountRow = {
  readonly id: string;
  readonly activatedAt: Date | null;
  readonly createdAt: Date;
  readonly email: string;
  readonly emailVerified: boolean;
  /** The latest sign-in or use recorded for the account, or null when there is none. */
  readonly lastActiveAt: Date | null;
  /** The day onboarding was finished, `YYYY-MM-DD`, or null. */
  readonly onboardedAt: string | null;
  /** How many plans the account has, in any state. */
  readonly plans: number;
  /** Whether the owner has granted the account the practice (`0059`), whatever the switch says. */
  readonly professional: boolean;
  readonly role: 'admin' | 'user';
  readonly tier: UserTier;
  /** The second factor is on (PLAN 011 phase 4): whether the console offers to remove it. */
  readonly twoFactorEnabled: boolean;
  /** When the owner's pending removal of the factor falls due, or null when none is pending. */
  readonly twoFactorRemovalDueAt: Date | null;
};

/**
 * The outer row's id, always written `"user"."id"`. Drizzle drops the table
 * from a column in a query over one table, and inside a sub-select a bare
 * `"id"` binds to the *inner* table — `meal_plans.id`, not the account's —
 * which silently correlates nothing. Written out, it can only mean the account.
 */
const ACCOUNT_ID = sql`${sql.identifier(getTableName(user))}.${sql.identifier('id')}`;

/** The owner's grant stands (`0059`). The switch is not asked: the table is about the grant the row actions change. */
const IS_PROFESSIONAL = sql`exists (select 1 from ${professionals} where ${professionals.userId} = ${ACCOUNT_ID})`;

/**
 * The milestones as correlated sub-selects against the outer `user` row. Each
 * reads one indexed `user_id` and returns a date, a count or a yes/no — never
 * a row of the other table.
 */
const MILESTONES = {
  lastActiveAt:
    sql<Date | null>`(select max(${analyticsEvents.createdAt}) from ${analyticsEvents} where ${analyticsEvents.userId} = ${ACCOUNT_ID} and ${inArray(analyticsEvents.event, [...ACTIVE_EVENTS])})`.mapWith(
      analyticsEvents.createdAt
    ),
  onboardedAt: sql<
    string | null
  >`(select ${onboardingState.completedAt} from ${onboardingState} where ${onboardingState.userId} = ${ACCOUNT_ID})`.mapWith(
    onboardingState.completedAt
  ),
  plans: sql<number>`(select count(*) from ${mealPlans} where ${mealPlans.userId} = ${ACCOUNT_ID})`.mapWith(Number),
  professional: sql<boolean>`${IS_PROFESSIONAL}`.mapWith(Boolean),
  /** The pending removal's due date (PLAN 011 phase 4) — one row at most per account (UNIQUE on `user_id`). */
  twoFactorRemovalDueAt:
    sql<Date | null>`(select ${twoFactorRemovals.dueAt} from ${twoFactorRemovals} where ${twoFactorRemovals.userId} = ${ACCOUNT_ID} and ${isNull(twoFactorRemovals.cancelledAt)})`.mapWith(
      twoFactorRemovals.dueAt
    )
};

/** What the account table selects: the row's own columns and the four milestones. Exported for its spec. */
export const ACCOUNT_COLUMNS = {
  id: user.id,
  activatedAt: user.activatedAt,
  createdAt: user.createdAt,
  email: user.email,
  emailVerified: user.emailVerified,
  lastActiveAt: MILESTONES.lastActiveAt,
  onboardedAt: MILESTONES.onboardedAt,
  plans: MILESTONES.plans,
  professional: MILESTONES.professional,
  role: user.role,
  tier: user.tier,
  twoFactorEnabled: user.twoFactorEnabled,
  twoFactorRemovalDueAt: MILESTONES.twoFactorRemovalDueAt
};

/** Onboarding finished: the funnel's own definition (`AdminRepository.funnel`). */
const ONBOARDED = sql`exists (select 1 from ${onboardingState} where ${onboardingState.userId} = ${ACCOUNT_ID} and ${isNotNull(onboardingState.completedAt)})`;

/** A yes/no filter as a condition: `yes` is the condition, `no` its negation, absent is nothing. */
function either(answer: 'no' | 'yes' | undefined, condition: SQL): SQL | undefined {
  if (answer === undefined) {
    return undefined;
  }

  return answer === 'yes' ? condition : not(condition);
}

/**
 * The four things that would make an account somebody's rather than an
 * address somebody typed (PLAN 011, "Follow-up — the 30-day sweep of
 * unconfirmed accounts"): correlated sub-selects against the outer `user`
 * row, the same shape as `IS_PROFESSIONAL` and `ONBOARDED` above.
 */
const HAS_SESSION = sql`exists (select 1 from ${session} where ${session.userId} = ${ACCOUNT_ID})`;
const HAS_PROFILE = sql`exists (select 1 from ${profiles} where ${profiles.userId} = ${ACCOUNT_ID})`;
const HAS_PLAN = sql`exists (select 1 from ${mealPlans} where ${mealPlans.userId} = ${ACCOUNT_ID})`;
const HAS_AUDIT_ROW = sql`exists (select 1 from ${auditLogs} where ${auditLogs.actorId} = ${ACCOUNT_ID} or ${auditLogs.subjectUserId} = ${ACCOUNT_ID})`;

/**
 * The 30-day sweep's `WHERE` (PLAN 011, "Follow-up — the 30-day sweep of
 * unconfirmed accounts", `legal` P2-15): unconfirmed, older than `cutoff`,
 * and none of the four above. Exported for its spec, the way `accountFilters`
 * is.
 *
 * Four tables and nothing wider on purpose: every one of them is reachable
 * only from a session (`profiles`, `mealPlans` and `auditLogs` are all
 * written by routes `VerifiedEmailGuard` gates), and an unconfirmed account
 * has never held one (`requireEmailVerification`, PLAN 011 phase 8) — so
 * widening this to every user-owned table would guard against a path that
 * does not exist, at the cost of a join this sweep does not need.
 */
export function staleUnconfirmedWhere(cutoff: Date): SQL | undefined {
  return and(eq(user.emailVerified, false), lt(user.createdAt, cutoff), not(HAS_SESSION), not(HAS_PROFILE), not(HAS_PLAN), not(HAS_AUDIT_ROW));
}

/**
 * The account table's `WHERE`, from the query's filters. Every value is bound
 * as a parameter; the only text is the search, escaped into a literal
 * "contains". Exported for its spec.
 */
export function accountFilters(
  query: Pick<AccountQuery, 'activated' | 'confirmed' | 'onboarded' | 'professional' | 'q' | 'role' | 'tier'>
): SQL | undefined {
  return and(
    query.q === undefined ? undefined : contains(user.email, query.q),
    query.confirmed === undefined ? undefined : eq(user.emailVerified, query.confirmed === 'yes'),
    query.activated === undefined ? undefined : query.activated === 'yes' ? isNotNull(user.activatedAt) : isNull(user.activatedAt),
    either(query.professional, IS_PROFESSIONAL),
    either(query.onboarded, ONBOARDED),
    query.tier === undefined ? undefined : eq(user.tier, query.tier),
    query.role === undefined ? undefined : eq(user.role, query.role)
  );
}

/** The column each allowed sort names. A map, so no name from the URL reaches the SQL. */
const ACCOUNT_SORT_COLUMNS = {
  createdAt: user.createdAt,
  email: user.email,
  lastActiveAt: MILESTONES.lastActiveAt,
  plans: MILESTONES.plans
} as const;

/** The chosen column in the chosen direction, then newest first and the id, so a page boundary never splits a tie differently. Exported for its spec. */
export function accountOrder(query: Pick<AccountQuery, 'dir' | 'sort'>): readonly SQL[] {
  const chosen = ordered(ACCOUNT_SORT_COLUMNS[query.sort], query.dir);

  return query.sort === 'createdAt' ? [chosen, asc(user.id)] : [chosen, desc(user.createdAt), asc(user.id)];
}

/**
 * Reads the account row. Writes are Better Auth's job — it owns `user`,
 * `session`, `account` and `verification`, including sign-up, password hashing,
 * email verification and deletion. Inserting here would create a row Better
 * Auth cannot authenticate.
 *
 * Method pattern used by every repository in this package:
 *   1. `database()` for the Drizzle instance
 *   2. run the query, always filtering by the owner where the table is user-scoped
 *   3. parse the row with its Zod schema — drift surfaces here, not three layers up
 *   4. wrap failures: ZodError → DatabaseOperationError with context; anything
 *      else → a bare DatabaseOperationError, because driver messages can carry
 *      connection strings and must never reach a response
 */
export const UserRepository = {
  /**
   * Opens the account (`0017`, `0030`): the one write this repository makes to a
   * table Better Auth owns, because it is the owner's decision and nothing in
   * Better Auth models it. By id from the admin screen, by email from the
   * runbook and the tests. Returns the address opened, or null if there was no
   * such account.
   *
   * Deliberately does **not** touch `emailVerified`: that says the address is
   * real and only the person holding it can prove that.
   *
   * `record`, when given, writes the admin trail's row (`0071`) in the same
   * transaction — an activation that is not also that row did not happen.
   * Skipped on a miss: a stranger's id must leave no trace of having been
   * tried. Also skipped when the account was already open: activating an
   * already-active account changes nothing, so nothing is worth a row — the
   * answer is the same either way. `before` is read inside this transaction,
   * the one place "was it already open" can be asked without a second round
   * trip outside it.
   */
  async activate(
    match: { readonly id?: string; readonly email?: string },
    record?: RecordActivationAudit
  ): Promise<{ readonly email: string } | null> {
    try {
      return await database().transaction(async tx => {
        const where = match.id === undefined ? eq(user.email, match.email ?? '') : eq(user.id, match.id);
        const [before] = await tx.select({ activatedAt: user.activatedAt }).from(user).where(where).limit(1);
        const rows = await tx
          .update(user)
          .set({ activatedAt: new Date(), updatedAt: new Date() })
          .where(where)
          .returning({ id: user.id, email: user.email });
        const row = rows[0] ?? null;

        if (row && record && before?.activatedAt === null) {
          await record(tx, row.id);
        }

        return row ? { email: row.email } : null;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Marks the address confirmed — the owner vouching for it, not the person
   * proving it.
   *
   * The product's own path is the verification link, and nothing here is
   * reachable over HTTP. This exists for the two places that always needed it:
   * the runbook's statement for somebody who cannot receive the mail, and the
   * suites, where no mail is sent at all.
   */
  async confirmAddress(email: string): Promise<boolean> {
    try {
      const rows = await database()
        .update(user)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(user.email, email))
        .returning({ email: user.email });

      return rows.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Marks the account's password as found in the breach corpus (PLAN 011
   * phase 2), once: a mark already set keeps its first instant. A third
   * write to a table Better Auth owns, and only of a column it does not read.
   * Answers whether this call set it.
   */
  /**
   * A completed password reset proved the mailbox (PLAN 011 phase 8): the
   * address is confirmed, on that account only, and only while it was not —
   * true when this was the moment it became confirmed.
   */
  async confirmAddressByReset(id: string): Promise<boolean> {
    try {
      const rows = await database()
        .update(user)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(and(eq(user.id, id), eq(user.emailVerified, false)))
        .returning({ id: user.id });

      return rows.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The 30-day sweep of an account nobody ever confirmed (PLAN 011,
   * "Follow-up — the 30-day sweep of unconfirmed accounts", `legal` P2-15):
   * unconfirmed, older than `cutoff`, and holding none of the four things
   * that would make it somebody's account rather than an address somebody
   * typed — a session, a profile, a plan, or an audit row naming it as actor
   * or subject (`staleUnconfirmedWhere`). One `DELETE … WHERE … RETURNING`,
   * so the check and the removal are the same statement: nothing can create
   * a session or a profile for a row in the instant between a read and a
   * write, because there is no such instant.
   *
   * `record`, called once per id the `RETURNING` found, inside this same
   * transaction: a deletion that is not also that row did not happen
   * (`0059`/`0071`'s pattern). `auditLogs.subjectUserId` is `onDelete: 'set
   * null'`, so the row written here outlives the delete that follows it in
   * the same transaction — it is written before the account disappears and
   * reads back with no id once it has, never before.
   */
  async deleteStaleUnconfirmed(cutoff: Date, record: RecordUnconfirmedSweepAudit): Promise<readonly string[]> {
    try {
      return await database().transaction(async tx => {
        const rows = await tx.delete(user).where(staleUnconfirmedWhere(cutoff)).returning({ id: user.id });

        for (const row of rows) {
          await record(tx, row.id);
        }

        return rows.map(row => row.id);
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * A page of accounts, **newest first**, and how many there are in total.
   *
   * Newest first because the useful end is the recent one: the account waiting
   * to be opened is the one that just signed up. Oldest-first with a cap meant
   * that past a few hundred accounts the screen showed the founders and lost
   * everybody who needed something.
   *
   * Address, dates, role and the account's milestones only. No profile, no
   * plan, no answers: an admin surface that can read what people eat is how one
   * becomes a way to read people's health data (`0028`), and none of it helps
   * decide whether to open an account.
   *
   * Searched, filtered, sorted and paged in SQL (`0068`): one query for the
   * page, each milestone a correlated sub-select on an indexed `user_id`, and
   * one count under the same `WHERE`. The sort column comes from the query's
   * allow-list; the tail of the order (newest first, then id) makes paging
   * stable when many rows tie.
   */
  async findAll(query: AccountQuery): Promise<{ readonly rows: readonly AccountRow[]; readonly total: number }> {
    try {
      const db = database();
      const where = accountFilters(query);
      const [rows, counted] = await Promise.all([
        db
          .select(ACCOUNT_COLUMNS)
          .from(user)
          .where(where)
          .orderBy(...accountOrder(query))
          .limit(query.size)
          .offset(query.offset),
        db.select({ n: count() }).from(user).where(where)
      ]);

      return { rows, total: counted[0]?.n ?? 0 };
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async findByEmail(email: string): Promise<User | undefined> {
    try {
      const [row] = await database().select().from(user).where(eq(user.email, email)).limit(1);

      return row ? userSchema.parse(row) : undefined;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async findById(id: string): Promise<User | undefined> {
    try {
      const [row] = await database().select().from(user).where(eq(user.id, id)).limit(1);

      return row ? userSchema.parse(row) : undefined;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async forgetExpiredVerifications(now: Date): Promise<number> {
    try {
      const rows = await database().delete(verification).where(lt(verification.expiresAt, now)).returning({ id: verification.id });

      return rows.length;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every passkey of the account goes, with the caller's rows, in one
   * transaction, and answers how many went (PLAN 011 phase 5). The second
   * attempt after `passwordChanged`'s transaction failed: the new password
   * is stored by then, and a key added from a stolen session must still go.
   */
  async forgetPasskeys(id: string, record: RecordPasskeysForgotten): Promise<number> {
    try {
      return await database().transaction(async tx => {
        const removed = (await tx.delete(passkey).where(eq(passkey.userId, id)).returning({ id: passkey.id })).length;

        await record(tx, removed);

        return removed;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Deletes every verification row — reset tokens, address links, OAuth state —
   * whose `expires_at` is already past, and answers how many went (PLAN 011).
   * The second write to a table Better Auth owns: the pruning Better Auth did
   * itself on every lookup, until `verification.disableCleanup` turned that off
   * so a reset for an unknown address costs the same round trips as one for a
   * real one. Strictly past: a row that has not expired is never touched, and
   * every reader checks `expiresAt` itself, so this changes no answer.
   */
  /**
   * Every device the account trusted to skip the second factor stops being
   * trusted (PLAN 011 phase 3) — when the factor goes off, so a device trusted
   * before does not skip it once it is back on, and when the person closes
   * every other session or all of them. A password change or reset
   * does the same inside `passwordChanged`. The browser's cookie stays, and
   * points at nothing.
   */
  async forgetTrustedDevices(id: string): Promise<number> {
    try {
      const rows = await database().delete(verification).where(trustedDevicesOf(id)).returning({ id: verification.id });

      return rows.length;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Makes an account an administrator.
   *
   * The runbook's other statement (`update "user" set role = 'admin' …`), and
   * nothing over HTTP reaches it: there is no route that grants a role, because
   * a product where an admin can be created by a request is a product where one
   * bug creates an admin.
   */
  async grantAdmin(email: string): Promise<boolean> {
    try {
      const rows = await database()
        .update(user)
        .set({ role: 'admin', updatedAt: new Date() })
        .where(eq(user.email, email))
        .returning({ email: user.email });

      return rows.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Whether the account can sign in with a password — a `credential` account
   * exists for it. A person who only ever arrived through Google has none, and
   * has no password to change. Answers nothing about the password itself.
   */
  async hasPassword(id: string): Promise<boolean> {
    try {
      const [row] = await database()
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, id), eq(account.providerId, 'credential')))
        .limit(1);

      return row !== undefined;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async markPasswordCompromised(id: string, at: Date): Promise<boolean> {
    try {
      const rows = await database()
        .update(user)
        .set({ passwordCompromisedAt: at })
        .where(and(eq(user.id, id), isNull(user.passwordCompromisedAt)))
        .returning({ id: user.id });

      return rows.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The password changed: the breach mark goes and the caller's audit row is
   * written, in one transaction — a change that is not also its row did not
   * happen, as far as the trail is concerned. Better Auth has already stored
   * the new password by then; this is only what follows it.
   *
   * Every trusted device of the account goes in the same transaction (PLAN
   * 011 phase 3): a password changed because somebody else may know it must
   * not leave that somebody's browser skipping the second factor.
   *
   * So does every device cookie that exempts a browser from the per-address
   * sign-in brake (PLAN 011 phase 7b): a stolen browser must not outlive the
   * password that throws its holder out. The cookie stays in the browser and
   * points at nothing.
   *
   * Every passkey of the account goes too, in the same transaction (PLAN 011
   * phase 5, `0083`): a key somebody added from a stolen session must not
   * outlive the change or the reset that throws them out. Returns how many
   * went.
   */
  async passwordChanged(id: string, record: RecordPasswordAudit): Promise<number> {
    try {
      return await database().transaction(async tx => {
        await tx.update(user).set({ passwordCompromisedAt: null }).where(eq(user.id, id));
        await tx.delete(verification).where(trustedDevicesOf(id));
        // The browsers that skip the per-address brake go too (PLAN 011 phase 7b): a stolen one must not outlive the password.
        await tx.delete(verification).where(signInDevicesOf(id));

        const removed = (await tx.delete(passkey).where(eq(passkey.userId, id)).returning({ id: passkey.id })).length;

        await record(tx, removed);

        return removed;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Moves an account between tiers (`0042`).
   *
   * The owner's decision, like activation, and the second write this repository
   * makes to a table Better Auth owns. Returns the address moved, or null when
   * there was no such account — the caller turns that into the same 404 every
   * other denial gives.
   *
   * `from` is read inside this transaction — the one place it is available
   * without a second round trip outside it — and the row is skipped when it
   * equals `tier`: moving an account to the tier it already holds changes
   * nothing, so nothing is worth a row, though the answer stays the same.
   */
  async setTier(id: string, tier: UserTier, record?: RecordTierAudit): Promise<{ readonly email: string } | null> {
    try {
      return await database().transaction(async tx => {
        const [before] = await tx.select({ tier: user.tier }).from(user).where(eq(user.id, id)).limit(1);
        const [row] = await tx.update(user).set({ tier, updatedAt: new Date() }).where(eq(user.id, id)).returning({ email: user.email });

        if (row && record && before && before.tier !== tier) {
          await record(tx, before.tier);
        }

        return row ?? null;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Spends a single-use grant (PLAN 011 phase 5): deletes the `verification`
   * row named `identifier` only if it is the account's own and has not
   * expired, and answers whether it did. One statement, so two requests on
   * one grant cannot both find it: the second waits on the first's row lock
   * and then deletes nothing.
   */
  async spendGrant(identifier: string, id: string, now: Date): Promise<boolean> {
    try {
      const rows = await database()
        .delete(verification)
        .where(and(eq(verification.identifier, identifier), eq(verification.value, id), gt(verification.expiresAt, now)))
        .returning({ id: verification.id });

      return rows.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * What this account may spend, as the database has it.
   *
   * One column rather than the whole row: this is read on the path that decides
   * whether a model call is allowed, and nothing else about the person matters
   * there. An account that does not exist reads as `free`, which is the answer
   * that grants the least.
   */
  async tierOf(id: string): Promise<UserTier> {
    try {
      const [row] = await database().select({ tier: user.tier }).from(user).where(eq(user.id, id)).limit(1);

      return row?.tier ?? 'free';
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {
    return new DatabaseOperationError(`Schema mismatch on user: ${error.message}`);
  }

  return new DatabaseOperationError();
}
