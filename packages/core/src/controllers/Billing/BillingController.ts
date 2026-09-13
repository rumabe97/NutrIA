import { BillingRepository } from '#repositories/Billing';
import { UserRepository } from '#repositories/User';
import { paysForPremium } from 'core/domain/Billing';

import type { SubscriptionRecord } from '#repositories/Billing';

export type { SubscriptionRecord };

/** The price checkout opens with, as Stripe has it: minor units, an ISO currency, a billing interval. */
export type PriceView = { readonly amount: number; readonly currency: string; readonly interval: string };

export type SubscriptionView = { readonly cancelAtPeriodEnd: boolean; readonly currentPeriodEnd: string | null; readonly status: string | null };

/**
 * What the profile needs to draw the premium card (`0056`). Unavailable when
 * payments are not set up, or not open to this person yet — and then nothing is
 * drawn at all.
 */
export type BillingStatusView =
  | { readonly available: false }
  | {
      readonly available: true;
      /** Yearly is `null` unless the owner has set a yearly price. */
      readonly prices: { readonly monthly: PriceView | null; readonly yearly: PriceView | null };
      readonly subscription: SubscriptionView | null;
      /** Test keys: only the owner sees this, and nothing they pay is real money. */
      readonly testMode: boolean;
      readonly tier: 'free' | 'premium';
      /** The free days checkout would open with, or `null` for somebody who has subscribed before. */
      readonly trialDays: number | null;
    };

export const BillingController = {
  /**
   * Stripe's word on a subscription becomes the tier (`0056`).
   *
   * The webhook is the only caller, with a subscription it has just fetched
   * from Stripe rather than the one inside the event, so the order events
   * arrive in cannot leave an old state standing. Resolves to the tier written.
   */
  async applySubscription(userId: string, record: SubscriptionRecord): Promise<'free' | 'premium'> {
    const tier = paysForPremium(record.status) ? 'premium' : 'free';

    await BillingRepository.recordSubscription(userId, record, tier);

    return tier;
  },

  async customerOf(userId: string): Promise<string | null> {
    return (await BillingRepository.findByUser(userId))?.customerId ?? null;
  },

  async rememberCustomer(userId: string, customerId: string): Promise<void> {
    await BillingRepository.saveCustomer(userId, customerId);
  },

  /**
   * The tier as the column has it, and the subscription behind it if there is
   * one. The column, not `PlanController.tierOf`: this is what somebody pays
   * for, and the `premium` switch deciding whether it is spent is a separate
   * question the profile does not ask.
   */
  async standing(userId: string): Promise<{ readonly subscription: SubscriptionView | null; readonly tier: 'free' | 'premium' }> {
    const [record, tier] = await Promise.all([BillingRepository.findByUser(userId), UserRepository.tierOf(userId)]);
    // A customer who never finished a checkout has a row and no subscription.
    const subscription = record?.subscriptionId
      ? { cancelAtPeriodEnd: record.cancelAtPeriodEnd, currentPeriodEnd: record.currentPeriodEnd?.toISOString() ?? null, status: record.status }
      : null;

    return { subscription, tier };
  },

  async userOfCustomer(customerId: string): Promise<string | null> {
    return BillingRepository.findUserByCustomer(customerId);
  }
};
