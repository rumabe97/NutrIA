import { BillingRepository } from '#repositories/Billing';
import { UserRepository } from '#repositories/User';
import { payingSibling, paysForPremium, replacesStored } from 'core/domain/Billing';

import type { Grants, SubscriptionRecord } from '#repositories/Billing';

export type { SubscriptionRecord };

/** A subscription as Stripe has it now, with the price it charges — what decides what it grants (`0061`). */
export type PricedSubscription = SubscriptionRecord & { readonly priceId: string | null };

/**
 * What a price grants (`0061`): a practice of so many active clients for a
 * configured practice price, and premium for every other, as before practices
 * existed.
 */
export type SubscriptionGrant = { readonly includedClients: number; readonly kind: 'practice' } | { readonly kind: 'premium' };

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

/**
 * One practice plan checkout can open with (`0061`): the configured price, the
 * clients it includes, and what Stripe says it costs (`null` when Stripe
 * describes it as something other than a recurring amount).
 */
export type PracticePlanView = { readonly includedClients: number; readonly price: PriceView | null; readonly priceId: string };

/**
 * What the workspace needs to show the way to pay (`0061`). Unavailable when
 * payments or practice prices are not set up, or not open to this person yet
 * (test keys: the owner alone).
 */
export type PracticeOfferView =
  | { readonly available: false }
  | {
      readonly available: true;
      /** Smallest first. */
      readonly plans: readonly PracticePlanView[];
      /** The account's subscription, whatever it is for: one account holds one at a time. */
      readonly subscription: SubscriptionView | null;
      readonly testMode: boolean;
      /** The free days checkout would open with, or `null` for somebody who has subscribed before. */
      readonly trialDays: number | null;
    };

/**
 * Everything one subscription grants, from its status and its price, and
 * nothing from anywhere else (`0061`). One row, one subscription: what it does
 * not pay for is closed, so the row changing hands — a new subscription, a
 * sibling that still pays — can never leave behind a grant nothing is paying
 * for. Premium pays for the tier and closes the practice; a practice opens it
 * with its number and leaves the tier free.
 * A status that stops paying keeps the practice's number (the next
 * resumption is the same plan) and closes it.
 */
function grantsOf(record: PricedSubscription, grant: SubscriptionGrant): Grants {
  const pays = paysForPremium(record.status);

  return {
    practice: { includedClients: grant.kind === 'practice' ? grant.includedClients : null, open: pays && grant.kind === 'practice' },
    tier: pays && grant.kind === 'premium' ? 'premium' : 'free'
  };
}

export const BillingController = {
  /**
   * Stripe's word on a subscription becomes what it grants: the tier
   * (`0056`), and a professional's practice (`0061`). `grantOf` reads the
   * price against configuration (`grantsOf`); nothing in a request reaches it.
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
   * Resolves to what was written — `premium`, `practice` for an open
   * practice, or `free` — `kept` when Stripe's answer was older than
   * what is stored, `mismatch`, or `absent` when the account does not exist —
   * deleted, or never this product's — and then nothing is written and
   * Stripe is not asked.
   */
  async applySubscription(
    userId: string,
    latest: () => Promise<PricedSubscription>,
    siblings: (customerId: string) => Promise<readonly PricedSubscription[]>,
    grantOf: (priceId: string | null) => SubscriptionGrant
  ): Promise<'absent' | 'free' | 'kept' | 'mismatch' | 'practice' | 'premium'> {
    let written: 'free' | 'practice' | 'premium' = 'free';
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

      const grants = grantsOf(record, grantOf(record.priceId));

      written = grants.practice.open ? 'practice' : grants.tier;

      return { ...grants, record };
    });

    if (mismatch) {
      return 'mismatch';
    }

    return outcome === 'written' ? written : outcome;
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
