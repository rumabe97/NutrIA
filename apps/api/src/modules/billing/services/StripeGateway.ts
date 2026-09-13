import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';

import { ENV } from '../../../config/index.js';

import type { BillingPlan } from 'core/entities/Billing';
import type { Env } from '../../../config/index.js';
import type { PriceView, SubscriptionRecord } from 'core/controllers/Billing';

/** How long a price is trusted before it is asked for again. It changes when the owner changes it, which is rarely. */
const PRICE_TTL_MS = 60 * 60 * 1000;

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
    this.client ??= new Stripe(this.env.STRIPE_SECRET_KEY ?? '');

    return this.client;
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
