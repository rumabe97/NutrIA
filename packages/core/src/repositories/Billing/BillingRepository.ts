import { and, eq } from 'drizzle-orm';

import { database } from 'database';
import { careLinks } from 'database/schema/care';
import { professionals } from 'database/schema/professional';
import { subscriptions } from 'database/schema/platform';
import { user } from 'database/schema/auth';

import { DatabaseOperationError } from 'core/entities/Error';

/** A subscription as Stripe last described it, for one account. */
export type SubscriptionRecord = {
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodEnd: Date | null;
  readonly customerId: string;
  readonly status: string | null;
  readonly subscriptionId: string | null;
};

/**
 * Everything one subscription grants, decided together (`0061`): the tier,
 * and the practice — open or not, and, for a practice price, how many active
 * clients it includes (`null` leaves the stored number as it is).
 */
export type Grants = { readonly practice: { readonly includedClients: number | null; readonly open: boolean }; readonly tier: 'free' | 'premium' };

export const BillingRepository = {
  /**
   * The account's Stripe customer, or the one `create` makes when it has none,
   * kept before it is returned. The account's row is locked first, the same
   * lock the webhook takes, so a second call for the account waits for the
   * first and reads what it kept: one account, one customer. `create` runs
   * under the lock, calling out to Stripe, and should bound its own time.
   * Resolves to `null` when there is no such account.
   */
  async customerFor(userId: string, create: () => Promise<string>): Promise<string | null> {
    try {
      return await database().transaction(async tx => {
        const [account] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('no key update');

        if (!account) {
          return null;
        }

        const [stored] = await tx
          .select({ customerId: subscriptions.stripeCustomerId })
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
          .limit(1);

        if (stored) {
          return stored.customerId;
        }

        const customerId = await create().catch((error: unknown) => {
          throw new DecisionFailed(error);
        });

        await tx.insert(subscriptions).values({ stripeCustomerId: customerId, userId });

        return customerId;
      });
    } catch (error: unknown) {
      throw error instanceof DecisionFailed ? error.cause : wrap(error);
    }
  },

  async findByUser(userId: string): Promise<SubscriptionRecord | null> {
    try {
      const [row] = await database()
        .select({
          cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          customerId: subscriptions.stripeCustomerId,
          status: subscriptions.status,
          subscriptionId: subscriptions.stripeSubscriptionId
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

      return row ?? null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async findUserByCustomer(customerId: string): Promise<string | null> {
    try {
      const [row] = await database()
        .select({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.stripeCustomerId, customerId))
        .limit(1);

      return row?.userId ?? null;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Stripe's word on a subscription, and what it grants (`Grants`), together, for
   * an account held still while it is decided.
   *
   * The account's row is locked (`FOR NO KEY UPDATE`) before anything is read,
   * which does three things at once. Two deliveries for one account are written
   * one after the other, never interleaved. A deletion of the account waits for
   * this, or this finds it gone. And an account that does not exist is
   * learnt from the lock itself rather than from a foreign key refusing the
   * write. `decide` runs under the lock with the stored row: it names what to
   * write, or `null` to keep what is there. It may call out, to Stripe, and
   * the lock is held while it does: that is the point. Resolves to `absent`
   * when there is no such account, and nothing is written.
   */
  async recordSubscription(
    userId: string,
    decide: (stored: SubscriptionRecord | null) => Promise<({ readonly record: SubscriptionRecord } & Grants) | null>
  ): Promise<'absent' | 'kept' | 'written'> {
    try {
      return await database().transaction(async tx => {
        const [account] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('no key update');

        if (!account) {
          return 'absent';
        }

        const [stored] = await tx
          .select({
            cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            customerId: subscriptions.stripeCustomerId,
            status: subscriptions.status,
            subscriptionId: subscriptions.stripeSubscriptionId
          })
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
          .limit(1);
        const decision = await decide(stored ?? null).catch((error: unknown) => {
          throw new DecisionFailed(error);
        });

        if (!decision) {
          return 'kept';
        }

        const { practice, record, tier } = decision;
        const values = {
          cancelAtPeriodEnd: record.cancelAtPeriodEnd,
          currentPeriodEnd: record.currentPeriodEnd,
          status: record.status,
          stripeSubscriptionId: record.subscriptionId
        };

        // The customer is written once, with the row, and never replaced (`BillingController.applySubscription`).
        await tx
          .insert(subscriptions)
          .values({ ...values, stripeCustomerId: record.customerId, userId })
          .onConflictDoUpdate({ set: { ...values, updatedAt: new Date() }, target: subscriptions.userId });
        await tx.update(user).set({ tier, updatedAt: new Date() }).where(eq(user.id, userId));
        await writePractice(tx, userId, practice);

        return 'written';
      });
    } catch (error: unknown) {
      throw error instanceof DecisionFailed ? error.cause : wrap(error);
    }
  }
};

type Transaction = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

/**
 * The practice half of a subscription's grants (`0061`), in the transaction
 * that writes the `subscriptions` row — so what is paid for and what is open
 * can never be read apart.
 *
 * On the professional's row: open or not, and the included number when the
 * price says one. An account that is not a professional has no row, and its
 * practice is closed whatever it pays for.
 *
 * Then the links, **one way only** (PRD 025 scope 2, invariant review of phase
 * 6, P1-1): a practice plan paid for makes every `paused` link `active` again —
 * by state rather than by change, so a delivery repeated writes nothing new.
 * A practice that is not paid for **pauses nothing**: since project 025 a
 * practice nobody pays for works, with its free seats, so a plan that lapses —
 * or a practitioner's own premium subscription, which grants no practice —
 * leaves every link as it is. A practice holding more clients than its free
 * `practiceClients` after a lapse keeps them all, and simply cannot invite
 * until it is under the number again (`CareRepository.invite` counts every
 * open link, `paused` ones from before project 025 included). The paused links
 * left by 004's lapses are the only ones there are, and paying again is what
 * makes them active. The target mark a professional left is never touched here
 * (owner's decision, 2026-09-24).
 *
 * For an account with no professional row and no links — every premium
 * subscriber — the statement matches nothing.
 */
async function writePractice(tx: Transaction, userId: string, practice: Grants['practice']): Promise<void> {
  const now = new Date();
  const [professional] = await tx
    .update(professionals)
    .set({ practiceOpen: practice.open, updatedAt: now, ...(practice.includedClients === null ? {} : { includedClients: practice.includedClients }) })
    .where(eq(professionals.userId, userId))
    .returning({ practiceOpen: professionals.practiceOpen });

  if (professional?.practiceOpen !== true) {
    return;
  }

  await tx
    .update(careLinks)
    .set({ status: 'active', updatedAt: now })
    .where(and(eq(careLinks.professionalId, userId), eq(careLinks.status, 'paused')));
}

/** What a callback (`decide`, `create`) threw is its own failure, not the database's: it goes out as it came, after the rollback. */
class DecisionFailed {
  constructor(readonly cause: unknown) {}
}

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
