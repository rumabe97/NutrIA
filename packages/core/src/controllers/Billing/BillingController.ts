import { BillingRepository } from '#repositories/Billing';
import { UserRepository } from '#repositories/User';
import { payingSibling, paysForPremium, replacesStored } from 'core/domain/Billing';

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
   * The webhook is the only caller. `latest` asks Stripe for the subscription
   * and is called with the account locked, just before the write, so of two
   * deliveries for one account the one that writes last also asked last: the
   * order their answers come back in cannot leave an old state standing. What
   * it answers is written only if it may replace what is stored
   * (`replacesStored`).
   *
   * An answer that no longer pays is not written while the customer has
   * another subscription that still does (`payingSibling`): that one is
   * written instead, so the tier does not drop while a card is still being
   * charged for it. `siblings` lists the customer's subscriptions, under the
   * same lock, and is asked only then.
   *
   * The account's customer is never replaced by another: a subscription of a
   * different customer than the one stored is `mismatch`, and nothing is
   * written. One account has one customer (`customerFor`), so a second one is
   * something to look at, not to follow.
   *
   * Resolves to the tier written, `kept` when Stripe's answer was older than
   * what is stored, `mismatch`, or `absent` when the account does not exist —
   * deleted, or never this product's — and then nothing is written and
   * Stripe is not asked.
   */
  async applySubscription(
    userId: string,
    latest: () => Promise<SubscriptionRecord>,
    siblings: (customerId: string) => Promise<readonly SubscriptionRecord[]>
  ): Promise<'absent' | 'free' | 'kept' | 'mismatch' | 'premium'> {
    let tier: 'free' | 'premium' = 'free';
    let mismatch = false;
    const outcome = await BillingRepository.recordSubscription(userId, async stored => {
      const answer = await latest();

      if (stored && stored.customerId !== answer.customerId) {
        mismatch = true;

        return null;
      }

      if (!replacesStored(stored, answer)) {
        return null;
      }

      const record = paysForPremium(answer.status) ? answer : (payingSibling(answer, await siblings(answer.customerId)) ?? answer);

      tier = paysForPremium(record.status) ? 'premium' : 'free';

      return { record, tier };
    });

    if (mismatch) {
      return 'mismatch';
    }

    return outcome === 'written' ? tier : outcome;
  },

  /**
   * Who somebody is to Stripe, made the first time it is asked. `create` makes
   * the customer at Stripe and is called with the account locked, so two
   * checkouts started at once make one customer between them: the second waits,
   * then finds the first one's. Resolves to `null` when the account does not
   * exist, and then `create` is never called.
   */
  async customerFor(userId: string, create: () => Promise<string>): Promise<string | null> {
    return BillingRepository.customerFor(userId, create);
  },

  async customerOf(userId: string): Promise<string | null> {
    return (await BillingRepository.findByUser(userId))?.customerId ?? null;
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
