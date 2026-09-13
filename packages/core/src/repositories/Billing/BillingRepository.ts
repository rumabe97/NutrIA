import { eq } from 'drizzle-orm';

import { database } from 'database';
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

export const BillingRepository = {
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
   * Stripe's word on a subscription, and the tier it decides, together. One
   * transaction, so the row that explains a tier and the tier itself are never
   * seen apart.
   */
  async recordSubscription(userId: string, record: SubscriptionRecord, tier: 'free' | 'premium'): Promise<void> {
    try {
      await database().transaction(async tx => {
        const values = {
          cancelAtPeriodEnd: record.cancelAtPeriodEnd,
          currentPeriodEnd: record.currentPeriodEnd,
          status: record.status,
          stripeCustomerId: record.customerId,
          stripeSubscriptionId: record.subscriptionId
        };

        await tx
          .insert(subscriptions)
          .values({ ...values, userId })
          .onConflictDoUpdate({ set: { ...values, updatedAt: new Date() }, target: subscriptions.userId });
        await tx.update(user).set({ tier, updatedAt: new Date() }).where(eq(user.id, userId));
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Who somebody is to Stripe, kept before they have ever paid: checkout and the portal both need it. */
  async saveCustomer(userId: string, customerId: string): Promise<void> {
    try {
      await database()
        .insert(subscriptions)
        .values({ stripeCustomerId: customerId, userId })
        .onConflictDoUpdate({ set: { stripeCustomerId: customerId, updatedAt: new Date() }, target: subscriptions.userId });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
