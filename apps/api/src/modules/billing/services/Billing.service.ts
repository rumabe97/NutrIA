import { Inject, Injectable, Logger } from '@nestjs/common';

import { BillingController } from 'core/controllers/Billing';
import { ConflictError, NotFoundError } from 'core/entities/Error';
import { hasEnded, paysForPremium, PRACTICE_TRIAL_DAYS, TRIAL_DAYS } from 'core/domain/Billing';
import { ProfessionalController } from 'core/controllers/Professional';
import { SettingsController } from 'core/controllers/Settings';
import { webUrl } from 'core/domain/WebUrl';

import { ENV } from '../../../config/index.js';
import { ErrorReporter } from '../../../shared/observability/index.js';
import { recipientLocale } from '../../email/services/RecipientLocale.js';
import { StripeGateway } from './StripeGateway.js';

import type { BillingPlan } from 'core/entities/Billing';
import type { BillingStatusDto, BillingUrlDto } from '../dto/out/index.js';
import type { PracticeOfferView, SubscriptionView } from 'core/controllers/Billing';
import type { Env } from '../../../config/index.js';
import type { SessionUser } from '../../../shared/index.js';
import type Stripe from 'stripe';

/**
 * The free days checkout opens with: the full trial for somebody who has never
 * subscribed, none for somebody who has — however that subscription ended.
 */
function trialFor(subscription: SubscriptionView | null, days: number = TRIAL_DAYS): number | null {
  return subscription ? null : days;
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
    private readonly stripe: StripeGateway,
    private readonly reporter: ErrorReporter
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

  /**
   * Whether this person may pay for a practice (`0061`): practice prices set
   * up, and a professional today — the `professional` switch on and the grant
   * standing. The `premium` switch has no say: it governs personal premium
   * alone. Test keys keep it to the owner, for the reason `open` does.
   */
  private async practiceOpen(user: SessionUser): Promise<boolean> {
    if (!this.stripe.practices || (this.stripe.testMode && user.role !== 'admin')) {
      return false;
    }

    return ProfessionalController.hasAccess(user.id);
  }

  /**
   * Whether the professional has accepted the current agreement, which carries
   * the practice plan's terms (`docs/legal/textos/01`, `04`): they are accepted
   * on the same screen before paying, so checkout for a practice is a 404 until
   * they are. The portal and the offer stay open — the page shows both.
   */
  private async agreed(user: SessionUser): Promise<boolean> {
    return (await ProfessionalController.find(user.id))?.agreementRequired === false;
  }

  /**
   * `plan` and, for a practice, `price` — one of the configured practice
   * prices, or a 404 as for any price that is not on offer. The price chooses
   * the plan; what it includes is written by the webhook from configuration.
   */
  async checkout(user: SessionUser, plan: BillingPlan, price?: string): Promise<BillingUrlDto> {
    const offered =
      plan === 'practice'
        ? price !== undefined && this.stripe.isPracticePrice(price) && (await this.practiceOpen(user)) && (await this.agreed(user))
        : (await this.open(user)) && (plan === 'monthly' || this.stripe.yearly);

    if (!offered) {
      throw new NotFoundError('Not found');
    }

    const { subscription } = await BillingController.standing(user.id);

    // Somebody already paying is sent to the portal, not charged twice.
    if (paysForPremium(subscription?.status ?? null)) {
      throw new ConflictError('Already subscribed');
    }

    const customerId = await BillingController.customerFor(user.id, () => this.stripe.createCustomer(user.email, user.id));

    // The session's account was deleted while this was on its way.
    if (!customerId) {
      throw new NotFoundError('Not found');
    }

    const locale = await recipientLocale(user.id);
    // A practice comes back to the workspace; premium to the profile, as before.
    const back = webUrl(this.env.APP_URL, plan === 'practice' ? '/consulta' : '/perfil', locale);

    return {
      url: await this.stripe.checkoutUrl({
        cancelUrl: back,
        customerId,
        locale,
        plan,
        ...(plan === 'practice' ? { price } : {}),
        successUrl: plan === 'practice' ? `${back}?practica=gracias` : `${back}?premium=gracias`,
        trialDays: plan === 'practice' ? trialFor(subscription, PRACTICE_TRIAL_DAYS) : trialFor(subscription),
        userId: user.id
      })
    };
  }

  /**
   * Stripe's own portal, where somebody changes their card or cancels. Not rebuilt here: a hand-written cancellation is one with a bug in it.
   * It returns where checkout does: to the workspace for a practice's subscription, read off its price at Stripe; to the profile otherwise.
   */
  async portal(user: SessionUser): Promise<BillingUrlDto> {
    // A professional reaches it for their practice — its plans are switched there — whatever the `premium` switch says.
    const customerId = (await this.open(user)) || (await this.practiceOpen(user)) ? await BillingController.customerOf(user.id) : null;

    if (!customerId) {
      throw new NotFoundError('Not found');
    }

    const [locale, subscriptions] = await Promise.all([recipientLocale(user.id), this.stripe.subscriptionsOf(customerId)]);
    // One account holds one subscription at a time; an ended one says nothing about where somebody manages theirs.
    const practice = subscriptions.some(({ priceId, status }) => !hasEnded(status) && priceId !== null && this.stripe.isPracticePrice(priceId));

    return { url: await this.stripe.portalUrl(customerId, webUrl(this.env.APP_URL, practice ? '/consulta' : '/perfil', locale)) };
  }

  /**
   * What the workspace shows to pay for a practice (`0061`): the plans on
   * offer, the account's subscription and the trial it would open with.
   * Unavailable under the same conditions checkout refuses.
   */
  async practiceOffer(user: SessionUser): Promise<PracticeOfferView> {
    if (!(await this.practiceOpen(user))) {
      return { available: false };
    }

    const [standing, plans] = await Promise.all([BillingController.standing(user.id), this.stripe.practicePlans()]);

    return {
      available: true,
      plans,
      subscription: standing.subscription,
      testMode: this.stripe.testMode,
      trialDays: trialFor(standing.subscription, PRACTICE_TRIAL_DAYS)
    };
  }

  async status(user: SessionUser): Promise<BillingStatusDto> {
    if (!(await this.open(user))) {
      return { available: false };
    }

    const [standing, prices] = await Promise.all([BillingController.standing(user.id), this.stripe.prices()]);

    return { available: true, prices, testMode: this.stripe.testMode, trialDays: trialFor(standing.subscription), ...standing };
  }

  /**
   * Before an account is deleted: every subscription it still has at Stripe is
   * cancelled, now. Somebody whose account is gone must not be charged for it
   * next month, and nothing here would ever notice that they were.
   *
   * Open checkouts are expired first, so none can turn into a subscription
   * once the list below has been read. One that completed before its expiry
   * is in that list. Should a subscription slip through anyway, the webhook
   * cancels it when Stripe announces it (`webhook`).
   *
   * A failure throws, and the deletion does not happen: the account stays and
   * the person can try again, which is better than an account gone and a card
   * still charged. Without Stripe set up there is nothing to cancel, and an
   * account that never reached checkout has no customer to ask about.
   *
   * Stripe's keys removed from an account that does have a customer is the
   * one case where something may still be charging and nothing can be asked:
   * the deletion goes ahead, and it is reported so the owner cancels by hand.
   */
  async cancelEverything(userId: string): Promise<void> {
    const customerId = await BillingController.customerOf(userId);

    if (!customerId) {
      return;
    }

    if (!this.stripe.configured) {
      this.alert(`Stripe customer ${customerId} is being deleted with Stripe not configured; nothing was cancelled`);

      return;
    }

    await this.stripe.expireOpenCheckouts(customerId);

    const open = (await this.stripe.subscriptionsOf(customerId)).filter(subscription => !hasEnded(subscription.status));

    for (const subscription of open) {
      await this.stripe.cancel(subscription.subscriptionId);
    }

    if (open.length > 0) {
      this.logger.log(`Cancelled ${open.length} subscription(s) of an account being deleted`);
    }
  }

  /**
   * What Stripe says happened. Only a signed payload is read, and a request
   * whose signature does not hold is a 404 like every other denial.
   *
   * The subscription is fetched from Stripe rather than taken from the event,
   * so an event arriving late, or twice, sets the state Stripe has now and
   * never an old one. The account is the one its customer was created for; the
   * id written into the subscription at checkout is the fallback.
   *
   * It is fetched twice. The first answer says whose it is, and is asked with
   * nothing held. The second is asked with that account locked, just before
   * the write (`BillingController.applySubscription`): two deliveries for one
   * subscription write one after the other, and each writes what Stripe said
   * after the one before it had finished, so a slow answer can no longer land
   * last with an old state. The first fetch stays outside the lock on purpose:
   * a delivery waiting on Stripe holds nothing, so a later one is never stuck
   * behind it.
   *
   * An account that does not exist — one the metadata names but that was
   * never made, or one deleted since, whose renewals Stripe still sends — is
   * acknowledged and nothing is written. A 500 there is a delivery Stripe
   * retries for days, and it can never succeed. If that subscription is still
   * live and this deployment opened it (`StripeGateway.deployment`, which
   * checkout writes into the metadata), it is cancelled at Stripe first:
   * nobody is left to use what it charges for. A checkout that finished while
   * its account was being deleted ends here. If the cancel fails, the answer
   * is a 500 and Stripe's retry tries again.
   *
   * A subscription another deployment opened is not this one's at all, and
   * is acknowledged before any account is looked for. Local development and
   * production share one Stripe test account and both receive its events:
   * a customer or an account that happens to exist on both sides says
   * nothing about whose it is. One opened before the mark existed is
   * followed as it always was, but never cancelled: a live one whose
   * account is missing is reported instead, for the owner to look at.
   *
   * A customer nobody knows is left alone unless the metadata names an
   * account. A deleted account's customer row goes with it, so the metadata
   * is what still names it. A subscription with neither was not made here:
   * the owner's own, from the dashboard, or another product's on the same
   * Stripe account. Cancelling it would be charging nobody by breaking
   * something that is not this service's to break.
   *
   * A subscription of a different customer than the one the account has is
   * not written (`mismatch`), and is reported.
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

    const { customerId, deploymentHint, status, userIdHint } = await this.stripe.subscription(subscriptionId);
    const ours = deploymentHint === this.stripe.deployment;

    if (deploymentHint !== null && !ours) {
      this.logger.warn(`Subscription ${subscriptionId} was opened by another deployment; nothing written`);

      return;
    }

    const userId = (await BillingController.userOfCustomer(customerId)) ?? userIdHint;

    if (!userId) {
      this.logger.warn(`Subscription ${subscriptionId} belongs to a customer this service does not know`);

      return;
    }

    const outcome = await BillingController.applySubscription(
      userId,
      () => this.stripe.subscription(subscriptionId, { underLock: true }),
      customer => this.stripe.subscriptionsOf(customer, { underLock: true }),
      price => this.stripe.grantOf(price)
    );

    switch (outcome) {
      case 'absent':
        if (hasEnded(status)) {
          this.logger.warn(`Subscription ${subscriptionId} names an account that does not exist; nothing written`);
        } else if (ours) {
          await this.stripe.cancel(subscriptionId);
          this.logger.warn(`Subscription ${subscriptionId} names an account that does not exist; cancelled at Stripe, nothing written`);
        } else {
          this.alert(
            `Subscription ${subscriptionId} is live and names an account that does not exist, but it carries no deployment mark; not cancelled`
          );
        }

        break;
      case 'mismatch':
        this.alert(`Subscription ${subscriptionId} belongs to customer ${customerId}, not the one its account has; nothing written`);
        break;
      case 'kept':
        this.logger.log(`Subscription ${subscriptionId}: Stripe's answer does not replace what is stored; nothing written`);
        break;
      default:
        this.logger.log(`Subscription ${subscriptionId} is written: the account is ${outcome}`);
    }
  }

  /** Something the owner must act on by hand: the log at error level, and Sentry. */
  private alert(message: string): void {
    this.logger.error(message);
    this.reporter.report(new Error(message), 'billing');
  }
}
