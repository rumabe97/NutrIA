import { Inject, Injectable, Logger } from '@nestjs/common';

import { BillingController } from 'core/controllers/Billing';
import { ConflictError, NotFoundError } from 'core/entities/Error';
import { paysForPremium, TRIAL_DAYS } from 'core/domain/Billing';
import { SettingsController } from 'core/controllers/Settings';
import { webUrl } from 'core/domain/WebUrl';

import { ENV } from '../../../config/index.js';
import { recipientLocale } from '../../email/services/RecipientLocale.js';
import { StripeGateway } from './StripeGateway.js';

import type { BillingPlan } from 'core/entities/Billing';
import type { BillingStatusDto, BillingUrlDto } from '../dto/out/index.js';
import type { SubscriptionView } from 'core/controllers/Billing';
import type { Env } from '../../../config/index.js';
import type { SessionUser } from '../../../shared/index.js';
import type Stripe from 'stripe';

/**
 * The free days checkout opens with: the full trial for somebody who has never
 * subscribed, none for somebody who has — however that subscription ended.
 */
function trialFor(subscription: SubscriptionView | null): number | null {
  return subscription ? null : TRIAL_DAYS;
}

/** The subscription an event is about, when it is one that can change what somebody pays for. */
function subscriptionOf(event: Stripe.Event): string | null {
  switch (event.type) {
    case 'checkout.session.completed': {
      const { subscription } = event.data.object;

      return typeof subscription === 'string' ? subscription : (subscription?.id ?? null);
    }

    case 'customer.subscription.created':
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated':
      return event.data.object.id;

    default:
      return null;
  }
}

/**
 * Paying for premium (`0056`, `docs/reference/payments.md`).
 *
 * The tier is still one column that the product reads (`0042`). This is its
 * second writer, beside the owner, and the `premium` switch still outranks
 * both.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly stripe: StripeGateway
  ) {}

  /**
   * Whether this person may see billing at all.
   *
   * With test keys, only the owner. A checkout that takes no real money must
   * never be offered to anybody else, and this is what lets the owner try the
   * whole path on the real site. With live keys, everybody, but only once the
   * `premium` switch is on — the runbook's last step, so that until then a
   * broken payment path is visible to nobody.
   */
  private async open(user: SessionUser): Promise<boolean> {
    if (!this.stripe.configured) {
      return false;
    }

    if (this.stripe.testMode) {
      return user.role === 'admin';
    }

    return (await SettingsController.flags()).premium;
  }

  async checkout(user: SessionUser, plan: BillingPlan): Promise<BillingUrlDto> {
    if (!(await this.open(user)) || (plan === 'yearly' && !this.stripe.yearly)) {
      throw new NotFoundError('Not found');
    }

    const { subscription } = await BillingController.standing(user.id);

    // Somebody already paying is sent to the portal, not charged twice.
    if (paysForPremium(subscription?.status ?? null)) {
      throw new ConflictError('Already subscribed');
    }

    const customerId = (await BillingController.customerOf(user.id)) ?? (await this.newCustomer(user));
    const locale = await recipientLocale(user.id);
    const profile = webUrl(this.env.APP_URL, '/perfil', locale);

    return {
      url: await this.stripe.checkoutUrl({
        cancelUrl: profile,
        customerId,
        locale,
        plan,
        successUrl: `${profile}?premium=gracias`,
        trialDays: trialFor(subscription),
        userId: user.id
      })
    };
  }

  /** Stripe's own portal, where somebody changes their card or cancels. Not rebuilt here: a hand-written cancellation is one with a bug in it. */
  async portal(user: SessionUser): Promise<BillingUrlDto> {
    const customerId = (await this.open(user)) ? await BillingController.customerOf(user.id) : null;

    if (!customerId) {
      throw new NotFoundError('Not found');
    }

    const locale = await recipientLocale(user.id);

    return { url: await this.stripe.portalUrl(customerId, webUrl(this.env.APP_URL, '/perfil', locale)) };
  }

  async status(user: SessionUser): Promise<BillingStatusDto> {
    if (!(await this.open(user))) {
      return { available: false };
    }

    const [standing, prices] = await Promise.all([BillingController.standing(user.id), this.stripe.prices()]);

    return { available: true, prices, testMode: this.stripe.testMode, trialDays: trialFor(standing.subscription), ...standing };
  }

  /**
   * What Stripe says happened. Only a signed payload is read, and a request
   * whose signature does not hold is a 404 like every other denial.
   *
   * The subscription is fetched from Stripe rather than taken from the event,
   * so an event arriving late, or twice, sets the state Stripe has now and
   * never an old one. The account is the one its customer was created for; the
   * id written into the subscription at checkout is the fallback.
   */
  async webhook(payload: unknown, signature: string | undefined): Promise<void> {
    const event = Buffer.isBuffer(payload) && signature ? this.stripe.event(payload, signature) : null;

    if (!event) {
      throw new NotFoundError('Not found');
    }

    const subscriptionId = subscriptionOf(event);

    if (!subscriptionId) {
      return;
    }

    const { userIdHint, ...record } = await this.stripe.subscription(subscriptionId);
    const userId = (await BillingController.userOfCustomer(record.customerId)) ?? userIdHint;

    if (!userId) {
      this.logger.warn(`Subscription ${record.subscriptionId ?? '?'} belongs to a customer this service does not know`);

      return;
    }

    const tier = await BillingController.applySubscription(userId, record);

    this.logger.log(`Subscription ${record.subscriptionId ?? '?'} is ${record.status ?? 'unknown'}: the account is ${tier}`);
  }

  private async newCustomer(user: SessionUser): Promise<string> {
    const customerId = await this.stripe.createCustomer(user.email, user.id);

    await BillingController.rememberCustomer(user.id, customerId);

    return customerId;
  }
}
