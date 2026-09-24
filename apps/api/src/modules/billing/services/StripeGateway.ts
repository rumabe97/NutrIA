import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';

import { ENV } from '../../../config/index.js';

import type { BillingPlan } from 'core/entities/Billing';
import type { Env } from '../../../config/index.js';
import type { PriceView, SubscriptionRecord } from 'core/controllers/Billing';

/** How long a price is trusted before it is asked for again. It changes when the owner changes it, which is rarely. */
const PRICE_TTL_MS = 60 * 60 * 1000;
/**
 * How long one call to Stripe may take. The webhook asks Stripe with an
 * account's row locked, so a hung call is a lock held: this bounds it well
 * below the SDK's default of 80 seconds.
 */
const STRIPE_TIMEOUT_MS = 15_000;
/** Stripe's page size ceiling for a list. */
const PAGE = 100;

/** A subscription as Stripe describes it now, with the account it was opened for when Stripe was told. */
export type SubscriptionSnapshot = SubscriptionRecord & { readonly customerId: string; readonly userIdHint: string | null };

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

  /** Whether a yearly price is on offer as well as the monthly one. */
  get yearly(): boolean {
    return Boolean(this.env.STRIPE_YEARLY_PRICE_ID);
  }

  private stripe(): Stripe {
    this.client ??= new Stripe(this.env.STRIPE_SECRET_KEY ?? '', { timeout: STRIPE_TIMEOUT_MS });

    return this.client;
  }

  /** Ends a subscription now, not at the end of the period: nothing more is charged. */
  async cancel(subscriptionId: string): Promise<void> {
    await this.stripe().subscriptions.cancel(subscriptionId);
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
      line_items: [{ price, quantity: 1 }],
      locale: request.locale === 'en-GB' ? 'en-GB' : 'es',
      mode: 'subscription',
      subscription_data: { metadata: { userId: request.userId }, ...(request.trialDays ? { trial_period_days: request.trialDays } : {}) },
      success_url: request.successUrl
    });

    if (!session.url) {
      throw new Error('Stripe returned a checkout session without an address');
    }

    return session.url;
  }

  async createCustomer(email: string, userId: string): Promise<string> {
    return (await this.stripe().customers.create({ email, metadata: { userId } })).id;
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
   * default — all but the cancelled ones — with its status. All of them, not
   * the one the account's row names: two checkouts finished in two tabs are
   * two subscriptions, and both charge.
   */
  async subscriptionsOf(customerId: string): Promise<{ readonly id: string; readonly status: string }[]> {
    const found = await everyPage(after => this.stripe().subscriptions.list({ customer: customerId, limit: PAGE, ...after }));

    return found.map(subscription => ({ id: subscription.id, status: subscription.status }));
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
   * The period end lives on the subscription's item in this API version; during
   * a trial it is the day the trial ends.
   */
  async subscription(id: string): Promise<SubscriptionSnapshot> {
    const subscription = await this.stripe().subscriptions.retrieve(id);
    const end = subscription.items.data[0]?.current_period_end;

    return {
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: end === undefined ? null : new Date(end * 1000),
      customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
      status: subscription.status,
      subscriptionId: subscription.id,
      userIdHint: subscription.metadata.userId ?? null
    };
  }
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
