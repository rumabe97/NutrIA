import { randomUUID } from 'node:crypto';

import { and, eq, gt, sql } from 'drizzle-orm';

import { database } from 'database';
import { verification } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';

import type { MailDecision, MailsSent } from 'core/domain/MailBudget';

/**
 * How Better Auth's `verification` table names a mail budget's row. The table
 * is its key-value store (trusted devices live there too), its rows expire by
 * `expiresAt`, and the daily `/cron/sweep-verifications` deletes the expired
 * ones — so a budget needs no table and no sweep of its own.
 */
const MAIL_BUDGET_PREFIX = 'mail-budget:';

/**
 * The per-address mail budget's rows (PLAN 011 phase 8), one per key while its
 * hour runs: `value` is the count, `expiresAt` the end of the hour. Every
 * method names the address by its HMAC key, never by the address.
 */
export const MailBudgetRepository = {
  /**
   * One more mail for a key, decided under a transaction-scoped advisory lock
   * on the key: `identifier` is not unique, so the lock is what keeps mails
   * fired at once from all reading the count before any has written it. A
   * mail sent writes the next state; a mail held writes nothing.
   */
  async spend(key: string, now: Date, decide: (sent: MailsSent | undefined) => MailDecision): Promise<MailDecision> {
    const identifier = `${MAIL_BUDGET_PREFIX}${key}`;

    try {
      return await database().transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${identifier}))`);

        const [row] = await tx
          .select({ id: verification.id, expiresAt: verification.expiresAt, value: verification.value })
          .from(verification)
          .where(and(eq(verification.identifier, identifier), gt(verification.expiresAt, now)))
          .limit(1);
        const decision = decide(row ? { count: Number(row.value), windowEndsAt: row.expiresAt } : undefined);

        if (decision.kind === 'held') {
          return decision;
        }

        const { count, windowEndsAt } = decision.next;

        if (row) {
          await tx
            .update(verification)
            .set({ expiresAt: windowEndsAt, value: String(count) })
            .where(eq(verification.id, row.id));
        } else {
          await tx.insert(verification).values({ id: randomUUID(), expiresAt: windowEndsAt, identifier, value: String(count) });
        }

        return decision;
      });
    } catch {
      throw new DatabaseOperationError();
    }
  }
};
