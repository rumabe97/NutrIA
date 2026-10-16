import { and, asc, eq, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { kitchenEquipment } from 'database/schema/kitchen';

import { ConflictError, DatabaseOperationError, InputParseError } from 'core/entities/Error';
import { kitchenStanceSchema } from 'core/entities/Kitchen';

import type { Appliance, KitchenStance } from 'core/entities/Kitchen';

/** As `FixedMealRepository`: enough turns at the lock for this same account's double submit, retry and burst to each get one. */
const LOCK_ATTEMPTS = 8;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function backoff(attempt: number): number {
  const base = Math.min(20 * 2 ** (attempt - 1), 250);

  return base + Math.random() * base;
}

export const KitchenRepository = {
  /**
   * Every stance this account has written, in the catalogue's own order.
   *
   * The rows only — folding them onto the default kitchen is `kitchenOf`'s job,
   * in the entity, so that the one answer to "what does silence mean" is not
   * re-derived per query.
   *
   * Ordered so two reads of the same kitchen come back the same way: the enum
   * is declared in the catalogue's order (`_enums.ts`), so `asc` on the column
   * *is* that order rather than the alphabet.
   */
  async findByUser(userId: string): Promise<readonly KitchenStance[]> {
    try {
      const rows = await database()
        .select({ appliance: kitchenEquipment.appliance, stance: kitchenEquipment.stance })
        .from(kitchenEquipment)
        .where(eq(kitchenEquipment.userId, userId))
        .orderBy(asc(kitchenEquipment.appliance));

      return rows.map(row => kitchenStanceSchema.parse(row));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Removes one stance, so the appliance goes back to whatever the default
   * kitchen says about it.
   *
   * The `userId` in the `WHERE` is the ownership boundary, not a filter. There
   * is nothing to leak here — an appliance key is public, unlike a rule's id —
   * but the clause is what makes that true rather than a thing to check.
   */
  async remove(userId: string, appliance: Appliance): Promise<boolean> {
    try {
      const removed = await database()
        .delete(kitchenEquipment)
        .where(and(eq(kitchenEquipment.userId, userId), eq(kitchenEquipment.appliance, appliance)))
        .returning({ id: kitchenEquipment.id });

      return removed.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Writes one appliance's stance, inside the same lock that re-reads what the
   * account already said.
   *
   * `allow` is handed **the other appliances' stances** — this appliance's own
   * row left out, since it is the one being replaced — and throws if the write
   * would break a rule. It is the controller's rule and the controller's error:
   * a repository that knew what the bound on `prefers` was would be a second
   * place to change it.
   *
   * Why a lock at all for a bound of three. "Read how many are preferred, then
   * write" is two statements against two snapshots: under READ COMMITTED two
   * requests fired together — two tabs, a double tap, a retry — both read two
   * preferences and both insert a third, and the account ends with four. It is
   * the same shape a security scan found in `EventController.add` on
   * 2026-09-22 and the reason `FixedMealRepository.createWithinQuota` exists;
   * `kitchen_equipment_one_per_appliance` is **not** this defence, because it
   * stops two rows for one appliance and says nothing about three appliances
   * racing past a count.
   *
   * `try` and not the blocking form, for the reason written in
   * `FixedMealRepository`: a blocking lock as a transaction's first statement
   * pins a pooled connection for the whole wait, so ten of one account's
   * requests would deny every other account. A failed try is not "already
   * done" — both of this account's requests are legitimate — so a few bounded,
   * jittered retries give the other one its turn before this refuses.
   */
  async setStance(
    userId: string,
    stance: KitchenStance,
    allow: (others: readonly KitchenStance[]) => Promise<void> | void
  ): Promise<readonly KitchenStance[]> {
    try {
      for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          await wait(backoff(attempt));
        }

        const written = await database().transaction(async tx => {
          const [lock] = await tx.execute<{ held: boolean }>(
            sql`select pg_try_advisory_xact_lock(hashtext(${'kitchen_equipment'}), hashtext(${userId})) as held`
          );

          if (!lock?.held) {
            return undefined;
          }

          const rows = await tx
            .select({ appliance: kitchenEquipment.appliance, stance: kitchenEquipment.stance })
            .from(kitchenEquipment)
            .where(eq(kitchenEquipment.userId, userId))
            .orderBy(asc(kitchenEquipment.appliance));

          const standing = rows.map(row => kitchenStanceSchema.parse(row));

          await allow(standing.filter(row => row.appliance !== stance.appliance));

          await tx
            .insert(kitchenEquipment)
            .values({ appliance: stance.appliance, stance: stance.stance, userId })
            .onConflictDoUpdate({
              set: { stance: stance.stance, updatedAt: new Date() },
              target: [kitchenEquipment.userId, kitchenEquipment.appliance]
            });

          // Read back rather than rebuilt from `standing` and the write: the
          // kitchen a screen is handed should be the rows, not this function's
          // idea of what they now are. It is one indexed query on at most ten
          // rows, inside a lock this account already holds.
          const after = await tx
            .select({ appliance: kitchenEquipment.appliance, stance: kitchenEquipment.stance })
            .from(kitchenEquipment)
            .where(eq(kitchenEquipment.userId, userId))
            .orderBy(asc(kitchenEquipment.appliance));

          return after.map(row => kitchenStanceSchema.parse(row));
        });

        if (written) {
          return written;
        }
      }

      throw new ConflictError('Another request for this account is still changing the kitchen');
    } catch (error: unknown) {
      // `allow`'s refusal is the controller's answer about the request, not a
      // database failure, so it travels as it is — as `createWithinQuota` lets
      // its own `QuotaExceededError` through. Everything else is wrapped.
      if (error instanceof ConflictError || error instanceof InputParseError) {
        throw error;
      }

      throw wrap(error);
    }
  }
};

function wrap(error: unknown): Error {
  return error instanceof ZodError ? error : new DatabaseOperationError('Kitchen operation failed');
}
