import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';

import { hasEnded } from 'core/domain/Billing';

import { ENV } from '../../../config/index.js';

import type { BillingPlan } from 'core/entities/Billing';
import type { Env } from '../../../config/index.js';
import type { PriceView, SubscriptionRecord } from 'core/controllers/Billing';

/** How long a price is trusted before it is asked for again. It changes when the owner changes it, which is rarely. */
const PRICE_TTL_MS = 60 * 60 * 1000;
/**
 * How long one attempt at a call to Stripe may take, down from the SDK's 80
 * seconds. The SDK retries a failed attempt twice more by default, so an
 * ordinary call can take about three times this. Calls made while an
 * account's row is locked use `UNDER_LOCK` instead.
 */
const STRIPE_TIMEOUT_MS = 15_000;
/**
 * A call made with an account's row locked: one attempt, five seconds, so the
 * lock (and the pooled connection waiting behind it) is held for five seconds
 * per request at the very most. A list is one request per page, so listing a
 * customer's subscriptions under the lock is bounded per page, not in total;
 * a customer with more than a hundred subscriptions is not one this product
 * makes. A failure there is a 500, and Stripe delivers the event again, which
 * is the retry.
 */
const UNDER_LOCK: Stripe.RequestOptions = { maxNetworkRetries: 0, timeout: 5000 };
/** Stripe's page size ceiling for a list. */
const PAGE = 100;
/**
 * How long a checkout stays payable: Stripe's minimum of 30 minutes, plus one,
 * because Stripe measures from its own clock. The default is 24 hours, and a
 * page left open that long can become a subscription after its account is gone.
 */
const CHECKOUT_TTL_SECONDS = 31 * 60;

/**
 * A subscription as Stripe describes it now, with what checkout wrote into it:
 * the account it was opened for, and the deployment that opened it.
 */
export type SubscriptionSnapshot = SubscriptionRecord & {
  readonly customerId: string;
  readonly deploymentHint: string | null;
  readonly subscriptionId: string;
  readonly userIdHint: string | null;
};

export type Prices = { readonly monthly: PriceView | null; readonly yearly: PriceView | null };

export type CheckoutRequest = {
  readonly cancelUrl: string;
  readonly customerId: string;
  readonly locale: string;
  readonly plan: BillingPlan;
  readonly successUrl: string;
  /** Free days before the first charge, or `null` for none. */
  readonly trialDays: number | null;
  readonly userId: string;
};

/**
 * The only thing in this service that talks to Stripe (`0056`).
 *
 * Everything the billing service needs from Stripe goes through here, so it
 * can be tested with this replaced and nothing else. No card details ever pass
 * through: checkout and the portal are Stripe's own pages, and this only asks
 * for their addresses.
 */
@Injectable()
export class StripeGateway {
  private client: Stripe | null = null;
  private readonly cachedPrices = new Map<string, { readonly at: number; readonly price: PriceView | null }>();

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** All three values, or payments do not exist (`Env.validation.ts` refuses any other combination). */
  get configured(): boolean {
    return Boolean(this.env.STRIPE_SECRET_KEY && this.env.STRIPE_PRICE_ID && this.env.STRIPE_WEBHOOK_SECRET);
  }

  /** A test key: nothing charged is real money, and so only the owner is shown it. */
  get testMode(): boolean {
    return this.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ?? false;
  }

  /**
   * Which deployment this is, as checkout writes it into every subscription:
   * a short hash of the database it writes to — the host, without Neon's
   * `-pooler` so the pooled and the direct address agree, and the database's
   * name. Never the credentials, and not a secret: a hash of where, not how.
   *
   * Local development and production share one Stripe test account, and both
   * receive its events. The question the webhook asks is whether an account
   * is missing from the database that opened the subscription, so the
   * database is what names the deployment — not the API's public address,
   * which has changed under the same database before. Moving to another
   * database changes it: subscriptions opened before are then another
   * deployment's, which the webhook leaves alone (`BillingService.webhook`).
   */
  get deployment(): string {
    const url = new URL(this.env.DATABASE_URL);
    const host = url.hostname.replace(/-pooler(?=\.|$)/, '');

    return createHash('sha256')
      .update(`${host}/${url.pathname.replace(/^\//, '')}`)
      .digest('hex')
      .slice(0, 16);
  }

  /** Whether a yearly price is on offer as well as the monthly one. */
  get yearly(): boolean {
    return Boolean(this.env.STRIPE_YEARLY_PRICE_ID);
  }

  private stripe(): Stripe {
    this.client ??= new Stripe(this.env.STRIPE_SECRET_KEY ?? '', { timeout: STRIPE_TIMEOUT_MS });

    return this.client;
  }

  /**
   * Ends a subscription now, not at the end of the period: nothing more is
   * charged. One that had already ended — cancelled by a delivery before this
   * one, or by the owner — is not a failure: ending it was the whole point.
   */
  async cancel(subscriptionId: string): Promise<void> {
    try {
      await this.stripe().subscriptions.cancel(subscriptionId);
    } catch (error: unknown) {
      // Asked rather than read from the error: whether it has ended is the whole question.
      if (!hasEnded((await this.stripe().subscriptions.retrieve(subscriptionId)).status)) {
        throw error;
      }
    }
  }

  async checkoutUrl(request: CheckoutRequest): Promise<string> {
    const price = request.plan === 'yearly' ? this.env.STRIPE_YEARLY_PRICE_ID : this.env.STRIPE_PRICE_ID;

    if (!price) {
      throw new Error(`No ${request.plan} price is set`);
    }

    const session = await this.stripe().checkout.sessions.create({
      cancel_url: request.cancelUrl,
      client_reference_id: request.userId,
      customer: request.customerId,
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS,
      line_items: [{ price, quantity: 1 }],
      locale: request.locale === 'en-GB' ? 'en-GB' : 'es',
      mode: 'subscription',
      subscription_data: {
        metadata: { deployment: this.deployment, userId: request.userId },
        ...(request.trialDays ? { trial_period_days: request.trialDays } : {})
      },
      success_url: request.successUrl
    });

    if (!session.url) {
      throw new Error('Stripe returned a checkout session without an address');
    }

    return session.url;
  }

  /**
   * Called with the account's row locked, so that one account never has two
   * customers. The idempotency key makes a retry after a lost answer (or a
   * transaction that failed after Stripe said yes) the same customer, for as
   * long as Stripe keeps the key.
   */
  async createCustomer(email: string, userId: string): Promise<string> {
    return (await this.stripe().customers.create({ email, metadata: { userId } }, { ...UNDER_LOCK, idempotencyKey: `customer-${userId}` })).id;
  }

  /** The signed event, or `null` when the signature does not hold — which is every request not from Stripe. */
  event(payload: Buffer, signature: string): Stripe.Event | null {
    try {
      return this.stripe().webhooks.constructEvent(payload, signature, this.env.STRIPE_WEBHOOK_SECRET ?? '');
    } catch {
      return null;
    }
  }

  /**
   * Every subscription this customer has at Stripe that Stripe still lists by
   * default — all but the cancelled ones. All of them, not the one the
   * account's row names: two checkouts finished in two tabs are two
   * subscriptions, and both charge. `underLock` for a call made with the
   * account's row locked.
   */
  async subscriptionsOf(customerId: string, options: { readonly underLock?: boolean } = {}): Promise<SubscriptionSnapshot[]> {
    const found = await everyPage(after =>
      this.stripe().subscriptions.list({ customer: customerId, limit: PAGE, ...after }, options.underLock ? UNDER_LOCK : undefined)
    );

    return found.map(snapshotOf);
  }

  /**
   * Expires every checkout this customer still has open, so that none of them
   * can become a subscription after this. A session that completes or expires
   * between the list and the expiry is no longer open, and that is not a
   * failure: one that completed has a subscription, which the caller cancels
   * next. Any other failure throws.
   */
  async expireOpenCheckouts(customerId: string): Promise<void> {
    const open = await everyPage(after => this.stripe().checkout.sessions.list({ customer: customerId, limit: PAGE, status: 'open', ...after }));

    for (const session of open) {
      try {
        await this.stripe().checkout.sessions.expire(session.id);
      } catch (error: unknown) {
        // Asked rather than read from the error: whether it is still open is the whole question.
        if ((await this.stripe().checkout.sessions.retrieve(session.id)).status === 'open') {
          throw error;
        }
      }
    }
  }

  async portalUrl(customerId: string, returnUrl: string): Promise<string> {
    return (await this.stripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })).url;
  }

  async prices(): Promise<Prices> {
    const [monthly, yearly] = await Promise.all([this.priceOf(this.env.STRIPE_PRICE_ID), this.priceOf(this.env.STRIPE_YEARLY_PRICE_ID)]);

    return { monthly, yearly };
  }

  private async priceOf(id: string | undefined): Promise<PriceView | null> {
    if (!id) {
      return null;
    }

    const cached = this.cachedPrices.get(id);

    if (cached && Date.now() - cached.at < PRICE_TTL_MS) {
      return cached.price;
    }

    const price = await this.stripe().prices.retrieve(id);
    const view =
      price.unit_amount === null || !price.recurring
        ? null
        : { amount: price.unit_amount, currency: price.currency, interval: price.recurring.interval };

    this.cachedPrices.set(id, { at: Date.now(), price: view });

    return view;
  }

  /**
   * A subscription as Stripe has it now — fetched rather than read from the
   * event that mentioned it, so an event arriving late cannot set an old state.
   * `underLock` for the fetch made with the account's row locked.
   */
  async subscription(id: string, options: { readonly underLock?: boolean } = {}): Promise<SubscriptionSnapshot> {
    return snapshotOf(await this.stripe().subscriptions.retrieve(id, {}, options.underLock ? UNDER_LOCK : undefined));
  }
}

/**
 * The fields this product reads. The period end lives on the subscription's
 * item in this API version; during a trial it is the day the trial ends.
 */
function snapshotOf(subscription: Stripe.Subscription): SubscriptionSnapshot {
  const end = subscription.items.data[0]?.current_period_end;

  return {
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: end === undefined ? null : new Date(end * 1000),
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    deploymentHint: subscription.metadata.deployment ?? null,
    status: subscription.status,
    subscriptionId: subscription.id,
    userIdHint: subscription.metadata.userId ?? null
  };
}

/** Every item of a Stripe list, page after page. */
async function everyPage<T extends { readonly id: string }>(
  page: (after: { starting_after?: string }) => Promise<{ readonly data: readonly T[]; readonly has_more: boolean }>
): Promise<T[]> {
  const found: T[] = [];
  let after: string | undefined;

  for (;;) {
    const { data, has_more: more } = await page(after ? { starting_after: after } : {});

    found.push(...data);
    after = data.at(-1)?.id;

    if (!more || !after) {
      return found;
    }
  }
}
