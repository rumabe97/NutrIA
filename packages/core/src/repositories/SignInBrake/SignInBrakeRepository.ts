import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';

import { database } from 'database';
import { signInFailure } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';

import type { BrakeDecision, SignInAttempts } from 'core/domain/SignInBrake';

/**
 * The per-address sign-in brake's rows (PLAN 011 phase 7). Every method names
 * the address by its HMAC key, never by the address; there is no user here,
 * so nothing to scope by but the key.
 */
export const SignInBrakeRepository = {
  /**
   * One attempt for a key, decided under the row's lock: the `INSERT … ON
   * CONFLICT DO UPDATE` creates the row (count 0) or locks the existing one
   * until the transaction ends, so attempts from many IPs at once are decided
   * one after the other — none of them reads a count another has not yet
   * written. An allowed attempt writes the next state; a braked one writes
   * nothing, so a wait is never stretched by the attempts made during it.
   */
  async attempt(key: string, now: Date, decide: (attempts: SignInAttempts) => BrakeDecision): Promise<BrakeDecision> {
    try {
      return await database().transaction(async tx => {
        const [row] = await tx
          .insert(signInFailure)
          .values({ count: 0, key, nextAllowedAt: null, windowStartedAt: now })
          .onConflictDoUpdate({ set: { key: sql`excluded.key` }, target: signInFailure.key })
          .returning({ count: signInFailure.count, nextAllowedAt: signInFailure.nextAllowedAt, windowStartedAt: signInFailure.windowStartedAt });

        if (!row) {
          throw new DatabaseOperationError();
        }

        const decision = decide(row);

        if (decision.kind === 'allowed') {
          await tx.update(signInFailure).set(decision.next).where(eq(signInFailure.key, key));
        }

        return decision;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** A correct password: the key's row goes, and the next attempt starts from nothing. */
  async clear(key: string): Promise<void> {
    try {
      await database().delete(signInFailure).where(eq(signInFailure.key, key));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The daily sweep: every row quiet since before `cutoff` — its window began
   * before it and no wait ends after it — and answers how many went. A row
   * whose wait is still in use is kept, so the sweep never lifts a brake.
   */
  async forgetQuiet(cutoff: Date): Promise<number> {
    try {
      const rows = await database()
        .delete(signInFailure)
        .where(and(lt(signInFailure.windowStartedAt, cutoff), or(isNull(signInFailure.nextAllowedAt), lt(signInFailure.nextAllowedAt, cutoff))))
        .returning({ key: signInFailure.key });

      return rows.length;
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
