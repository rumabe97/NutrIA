import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { BillingController } from 'core/controllers/Billing';
import { ConflictError, NotFoundError } from 'core/entities/Error';
import { ProfessionalController } from 'core/controllers/Professional';
import { ProfileController } from 'core/controllers/Profile';
import { SettingsController } from 'core/controllers/Settings';

import { BillingService } from './Billing.service.js';

import type { Env } from '../../../config/index.js';
import type { ErrorReporter } from '../../../shared/observability/index.js';
import type { SessionUser } from '../../../shared/index.js';
import type { CheckoutRequest, Prices, StripeGateway, SubscriptionSnapshot } from './StripeGateway.js';
import type { PracticePlanView, SubscriptionView } from 'core/controllers/Billing';
import type Stripe from 'stripe';

const ENV = { APP_URL: 'https://nutria.example' } as Env;
const OWNER = { id: 'usr-owner', activated: true, email: 'owner@example.invalid', emailVerified: true, name: 'Owner', role: 'admin' } as SessionUser;
const PERSON = { ...OWNER, id: 'usr-ana', email: 'ana@example.invalid', name: 'Ana', role: 'user' } as SessionUser;
const PRICES: Prices = { monthly: { amount: 499, currency: 'eur', interval: 'month' }, yearly: { amount: 3999, currency: 'eur', interval: 'year' } };
const PLANS: PracticePlanView[] = [
  { includedClients: 30, price: { amount: 4900, currency: 'eur', interval: 'month' }, priceId: 'price_practice_30' },
  { includedClients: 60, price: { amount: 8900, currency: 'eur', interval: 'month' }, priceId: 'price_practice_60' }
];
const CANCELLED: SubscriptionView = { cancelAtPeriodEnd: false, currentPeriodEnd: null, status: 'canceled' };
const SNAPSHOT: SubscriptionSnapshot = {
  cancelAtPeriodEnd: false,
  currentPeriodEnd: new Date('2026-10-13T00:00:00Z'),
  customerId: 'cus_1',
  deploymentHint: 'dep_here',
  priceId: 'price_monthly',
  status: 'active',
  subscriptionId: 'sub_1',
  userIdHint: 'usr-ana'
};

function event(type: string, object: Record<string, unknown>): Stripe.Event {
  return { id: 'evt_1', data: { object }, object: 'event', type } as unknown as Stripe.Event;
}

function harness(
  options: {
    configured?: boolean;
    customer?: string | null;
    event?: Stripe.Event | null;
    practices?: boolean;
    premium?: boolean;
    professional?: boolean;
    subscription?: SubscriptionView | null;
    testMode?: boolean;
    yearly?: boolean;
  } = {}
) {
  const gateway = {
    cancel: jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
    checkoutUrl: jest.fn<(request: CheckoutRequest) => Promise<string>>().mockResolvedValue('https://checkout.stripe.com/c/session'),
    configured: options.configured ?? true,
    createCustomer: jest.fn<(email: string, userId: string) => Promise<string>>().mockResolvedValue('cus_new'),
    deployment: 'dep_here',
    event: jest.fn(() => (options.event === undefined ? event('invoice.paid', {}) : options.event)),
    expireOpenCheckouts: jest.fn<(customerId: string) => Promise<void>>().mockResolvedValue(undefined),
    isPracticePrice: jest.fn((price: string) => PLANS.some(plan => plan.priceId === price)),
    portalUrl: jest.fn<(customerId: string, returnUrl: string) => Promise<string>>().mockResolvedValue('https://billing.stripe.com/p/session'),
    practicePlans: jest.fn(async () => PLANS),
    practices: options.practices ?? true,
    prices: jest.fn(async () => PRICES),
    subscription: jest.fn<(id: string, options?: { underLock?: boolean }) => Promise<SubscriptionSnapshot>>().mockResolvedValue(SNAPSHOT),
    subscriptionsOf: jest.fn<(customerId: string, options?: { underLock?: boolean }) => Promise<SubscriptionSnapshot[]>>().mockResolvedValue([]),
    testMode: options.testMode ?? false,
    yearly: options.yearly ?? true
  };

  jest
    .spyOn(SettingsController, 'flags')
    .mockResolvedValue({ automaticActivation: true, checkInReminders: false, premium: options.premium ?? true, professional: false });
  jest.spyOn(ProfessionalController, 'hasAccess').mockResolvedValue(options.professional ?? false);
  jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('es-ES');
  jest.spyOn(BillingController, 'standing').mockResolvedValue({ subscription: options.subscription ?? null, tier: 'free' });
  jest.spyOn(BillingController, 'customerOf').mockResolvedValue(options.customer ?? null);

  // As the real one does: the stored customer, or one made under the account's lock.
  const customerFor = jest
    .spyOn(BillingController, 'customerFor')
    .mockImplementation(async (_userId, create) => (options.customer === undefined || options.customer === null ? create() : options.customer));
  // As the real one does: the re-fetch runs inside, under the account's lock.
  const apply = jest.spyOn(BillingController, 'applySubscription').mockImplementation(async (_userId, latest) => {
    await latest();

    return 'premium';
  });
  const owner = jest.spyOn(BillingController, 'userOfCustomer').mockResolvedValue('usr-ana');

  const reporter = { report: jest.fn<(error: unknown, where: string) => void>() };

  return {
    apply,
    customerFor,
    gateway,
    owner,
    reporter,
    service: new BillingService(ENV, gateway as unknown as StripeGateway, reporter as unknown as ErrorReporter)
  };
}

describe('BillingService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is not there at all without Stripe set up', async () => {
    const { service } = harness({ configured: false });

    await expect(service.status(OWNER)).resolves.toEqual({ available: false });
    await expect(service.checkout(OWNER, 'monthly')).rejects.toBeInstanceOf(NotFoundError);
  });

  /* A checkout that takes no real money is never offered to anybody but the owner. */
  it('with test keys, is the owner’s alone, whatever the premium switch says', async () => {
    const { service } = harness({ premium: false, testMode: true });

    await expect(service.status(PERSON)).resolves.toEqual({ available: false });
    await expect(service.status(OWNER)).resolves.toMatchObject({ available: true, prices: PRICES, testMode: true, tier: 'free', trialDays: 7 });
  });

  it('with live keys, is everybody’s once the premium switch is on, and nobody’s before', async () => {
    await expect(harness({ premium: false }).service.status(PERSON)).resolves.toEqual({ available: false });
    jest.restoreAllMocks();
    await expect(harness({ premium: true }).service.status(PERSON)).resolves.toMatchObject({ available: true, testMode: false });
  });

  it('opens checkout for a new customer with the free trial, made under the account’s lock', async () => {
    const { customerFor, gateway, service } = harness();

    await expect(service.checkout(PERSON, 'monthly')).resolves.toEqual({ url: 'https://checkout.stripe.com/c/session' });
    expect(customerFor).toHaveBeenCalledWith('usr-ana', expect.any(Function));
    expect(gateway.createCustomer).toHaveBeenCalledWith('ana@example.invalid', 'usr-ana');
    expect(gateway.checkoutUrl).toHaveBeenCalledWith({
      cancelUrl: 'https://nutria.example/perfil',
      customerId: 'cus_new',
      locale: 'es-ES',
      plan: 'monthly',
      successUrl: 'https://nutria.example/perfil?premium=gracias',
      trialDays: 7,
      userId: 'usr-ana'
    });
  });

  /* A trial cannot be chained into a free tier: somebody who cancelled has had theirs. */
  it('offers no second trial to somebody who has subscribed before, however it ended', async () => {
    const { gateway, service } = harness({ customer: 'cus_known', subscription: CANCELLED });

    await expect(service.status(PERSON)).resolves.toMatchObject({ trialDays: null });
    await service.checkout(PERSON, 'monthly');

    expect(gateway.createCustomer).not.toHaveBeenCalled();
    expect(gateway.checkoutUrl).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cus_known', trialDays: null }));
  });

  it('opens the yearly price when it is chosen, and only when one is set', async () => {
    const { gateway, service } = harness();

    await service.checkout(PERSON, 'yearly');
    expect(gateway.checkoutUrl).toHaveBeenCalledWith(expect.objectContaining({ plan: 'yearly' }));

    jest.restoreAllMocks();
    await expect(harness({ yearly: false }).service.checkout(PERSON, 'yearly')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('opens nothing for an account deleted while its checkout was on its way', async () => {
    const { customerFor, gateway, service } = harness();

    customerFor.mockResolvedValue(null);

    await expect(service.checkout(PERSON, 'monthly')).rejects.toBeInstanceOf(NotFoundError);
    expect(gateway.checkoutUrl).not.toHaveBeenCalled();
  });

  it('does not open a second checkout for somebody already paying, or trialling', async () => {
    const { gateway, service } = harness({ subscription: { ...CANCELLED, status: 'trialing' } });

    await expect(service.checkout(PERSON, 'monthly')).rejects.toBeInstanceOf(ConflictError);
    expect(gateway.checkoutUrl).not.toHaveBeenCalled();
  });

  it('has no portal for somebody Stripe has never met', async () => {
    await expect(harness({ customer: null }).service.portal(PERSON)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('answers a request whose signature does not hold as a 404, and changes nothing', async () => {
    const { apply, service } = harness({ event: null });

    await expect(service.webhook(Buffer.from('{}'), 't=1,v1=forged')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.webhook({ parsed: 'json' }, 't=1,v1=forged')).rejects.toBeInstanceOf(NotFoundError);
    expect(apply).not.toHaveBeenCalled();
  });

  it('applies the subscription as Stripe has it now, to the account of its customer', async () => {
    const { apply, gateway, service } = harness({ event: event('checkout.session.completed', { subscription: 'sub_1' }) });

    await service.webhook(Buffer.from('{}'), 'signed');

    expect(apply).toHaveBeenCalledWith('usr-ana', expect.any(Function), expect.any(Function), expect.any(Function));
    // Once to learn whose it is, once more under the lock, just before the write.
    expect(gateway.subscription.mock.calls).toEqual([['sub_1'], ['sub_1', { underLock: true }]]);
  });

  /* Under the lock: one attempt, bounded, so the account's row is never held for long. */
  it('lists the customer’s other subscriptions under the lock with the lock’s bound', async () => {
    const { apply, gateway, service } = harness({ event: event('customer.subscription.deleted', { id: 'sub_1' }) });

    apply.mockImplementation(async (_userId, _latest, siblings) => {
      await siblings('cus_1');

      return 'premium';
    });

    await service.webhook(Buffer.from('{}'), 'signed');

    expect(gateway.subscriptionsOf).toHaveBeenCalledWith('cus_1', { underLock: true });
  });

  /* Deleted since, or never made: a 500 here is a delivery Stripe retries for days. */
  it('acknowledges a subscription whose account does not exist, writes nothing, and cancels it at Stripe while it is live', async () => {
    const { apply, gateway, reporter, service } = harness({ event: event('customer.subscription.updated', { id: 'sub_1' }) });

    apply.mockResolvedValue('absent');

    await expect(service.webhook(Buffer.from('{}'), 'signed')).resolves.toBeUndefined();
    expect(gateway.cancel).toHaveBeenCalledWith('sub_1');
    expect(reporter.report).not.toHaveBeenCalled();
  });

  /*
   * Local development and production share one Stripe test account and both
   * receive its events: an account missing here says nothing about the
   * other's, so only this deployment's own subscriptions are ever cancelled.
   */
  it('does not cancel a live subscription of a missing account that carries no mark, and reports it', async () => {
    const { apply, gateway, reporter, service } = harness({ event: event('customer.subscription.updated', { id: 'sub_1' }) });

    apply.mockResolvedValue('absent');
    gateway.subscription.mockResolvedValue({ ...SNAPSHOT, deploymentHint: null });

    await expect(service.webhook(Buffer.from('{}'), 'signed')).resolves.toBeUndefined();
    expect(gateway.cancel).not.toHaveBeenCalled();
    expect(reporter.report).toHaveBeenCalledTimes(1);
    // The subscription's id, and nothing that says whose it is.
    expect(String(reporter.report.mock.calls[0]?.[0])).toContain('sub_1');
    expect(String(reporter.report.mock.calls[0]?.[0])).not.toMatch(/usr-ana|cus_1/);
  });

  /* Another database opened it: a customer or an account that exists on both sides says nothing about whose it is. */
  it('acknowledges a subscription another deployment opened before looking for any account, and changes nothing', async () => {
    const { apply, gateway, owner, reporter, service } = harness({ event: event('customer.subscription.updated', { id: 'sub_1' }) });

    gateway.subscription.mockResolvedValue({ ...SNAPSHOT, deploymentHint: 'dep_elsewhere' });

    await expect(service.webhook(Buffer.from('{}'), 'signed')).resolves.toBeUndefined();
    expect(owner).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(gateway.cancel).not.toHaveBeenCalled();
    expect(reporter.report).not.toHaveBeenCalled();
  });

  /* One account, one customer: a second one is something to look at, not to follow. */
  it('writes nothing, and reports it, when the subscription is another customer’s than the account’s', async () => {
    const { apply, gateway, reporter, service } = harness({ event: event('customer.subscription.updated', { id: 'sub_1' }) });

    apply.mockResolvedValue('mismatch');

    await expect(service.webhook(Buffer.from('{}'), 'signed')).resolves.toBeUndefined();
    expect(gateway.cancel).not.toHaveBeenCalled();
    expect(reporter.report).toHaveBeenCalledTimes(1);
    expect(String(reporter.report.mock.calls[0]?.[0])).not.toMatch(/usr-ana/);
  });

  /* Opened before the mark existed: still followed by the account it names. */
  it('falls back to the account an unmarked subscription names', async () => {
    const { apply, gateway, owner, service } = harness({ event: event('customer.subscription.updated', { id: 'sub_1' }) });

    owner.mockResolvedValue(null);
    gateway.subscription.mockResolvedValue({ ...SNAPSHOT, deploymentHint: null });
    await service.webhook(Buffer.from('{}'), 'signed');

    expect(apply).toHaveBeenCalledWith('usr-ana', expect.any(Function), expect.any(Function), expect.any(Function));
  });

  it('does not cancel again a subscription of a missing account that has already ended', async () => {
    const { apply, gateway, service } = harness({ event: event('customer.subscription.deleted', { id: 'sub_1' }) });

    apply.mockResolvedValue('absent');
    gateway.subscription.mockResolvedValue({ ...SNAPSHOT, status: 'canceled' });

    await expect(service.webhook(Buffer.from('{}'), 'signed')).resolves.toBeUndefined();
    expect(gateway.cancel).not.toHaveBeenCalled();
  });

  /* Still charging with nobody behind it: fail, so Stripe delivers again and the cancel is tried again. */
  it('fails the delivery when the cancel for a missing account fails', async () => {
    const { apply, gateway, service } = harness({ event: event('customer.subscription.updated', { id: 'sub_1' }) });

    apply.mockResolvedValue('absent');
    gateway.cancel.mockRejectedValue(new Error('Stripe is unreachable'));

    await expect(service.webhook(Buffer.from('{}'), 'signed')).rejects.toThrow('Stripe is unreachable');
  });

  /* No account named and a customer nobody knows: not made here, so not this service's to cancel. */
  it('leaves alone a subscription that names no account and whose customer nobody knows', async () => {
    const { apply, gateway, owner, service } = harness({ event: event('customer.subscription.created', { id: 'sub_1' }) });

    owner.mockResolvedValue(null);
    gateway.subscription.mockResolvedValue({ ...SNAPSHOT, userIdHint: null });

    await expect(service.webhook(Buffer.from('{}'), 'signed')).resolves.toBeUndefined();
    expect(apply).not.toHaveBeenCalled();
    expect(gateway.cancel).not.toHaveBeenCalled();
  });

  it('writes nothing when Stripe cannot be asked, so that Stripe retries', async () => {
    const { apply, gateway, service } = harness({ event: event('customer.subscription.updated', { id: 'sub_1' }) });

    gateway.subscription.mockRejectedValue(new Error('Stripe is unreachable'));

    await expect(service.webhook(Buffer.from('{}'), 'signed')).rejects.toThrow('Stripe is unreachable');
    expect(apply).not.toHaveBeenCalled();
  });

  it('falls back to the account named at checkout when the customer is not one it knows', async () => {
    const { apply, owner, service } = harness({ event: event('customer.subscription.updated', { id: 'sub_1' }) });

    owner.mockResolvedValue(null);
    await service.webhook(Buffer.from('{}'), 'signed');

    expect(apply).toHaveBeenCalledWith('usr-ana', expect.any(Function), expect.any(Function), expect.any(Function));
  });

  it('acknowledges and ignores an event that changes nothing about the tier', async () => {
    const { apply, gateway, service } = harness({ event: event('invoice.paid', {}) });

    await service.webhook(Buffer.from('{}'), 'signed');

    expect(gateway.subscription).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  describe('before an account is deleted', () => {
    it('cancels, now, every subscription of its customer that has not ended', async () => {
      const { gateway, service } = harness({ customer: 'cus_1' });

      gateway.subscriptionsOf.mockResolvedValue([
        { ...SNAPSHOT, subscriptionId: 'sub_live' },
        { ...SNAPSHOT, status: 'trialing', subscriptionId: 'sub_second_tab' },
        { ...SNAPSHOT, status: 'incomplete_expired', subscriptionId: 'sub_expired' }
      ]);

      await service.cancelEverything('usr-ana');

      expect(gateway.subscriptionsOf).toHaveBeenCalledWith('cus_1');
      expect(gateway.cancel.mock.calls).toEqual([['sub_live'], ['sub_second_tab']]);
    });

    /* Expired first: no checkout can become a subscription after the list is read. */
    it('expires its open checkouts before it reads its subscriptions', async () => {
      const { gateway, service } = harness({ customer: 'cus_1' });

      await service.cancelEverything('usr-ana');

      expect(gateway.expireOpenCheckouts).toHaveBeenCalledWith('cus_1');
      expect(gateway.expireOpenCheckouts.mock.invocationCallOrder[0]).toBeLessThan(gateway.subscriptionsOf.mock.invocationCallOrder[0] ?? 0);
    });

    it('fails, so the deletion does not happen, when an open checkout cannot be expired', async () => {
      const { gateway, service } = harness({ customer: 'cus_1' });

      gateway.expireOpenCheckouts.mockRejectedValue(new Error('Stripe is unreachable'));

      await expect(service.cancelEverything('usr-ana')).rejects.toThrow('Stripe is unreachable');
      expect(gateway.subscriptionsOf).not.toHaveBeenCalled();
    });

    /* The account stays: a deletion to retry beats a card charged for an account that is gone. */
    it('fails, so the deletion does not happen, when Stripe will not cancel', async () => {
      const { gateway, service } = harness({ customer: 'cus_1' });

      gateway.subscriptionsOf.mockResolvedValue([{ ...SNAPSHOT, subscriptionId: 'sub_live' }]);
      gateway.cancel.mockRejectedValue(new Error('Stripe is unreachable'));

      await expect(service.cancelEverything('usr-ana')).rejects.toThrow('Stripe is unreachable');
    });

    it('asks Stripe nothing without Stripe set up, or for an account that never reached checkout', async () => {
      const unconfigured = harness({ configured: false, customer: 'cus_1' });

      await unconfigured.service.cancelEverything('usr-ana');
      expect(unconfigured.gateway.subscriptionsOf).not.toHaveBeenCalled();
      // Something may still be charging, and nothing could ask: the owner is told.
      expect(unconfigured.reporter.report).toHaveBeenCalledTimes(1);

      jest.restoreAllMocks();

      const stranger = harness({ customer: null });

      await stranger.service.cancelEverything('usr-ana');
      expect(stranger.gateway.subscriptionsOf).not.toHaveBeenCalled();
      expect(stranger.reporter.report).not.toHaveBeenCalled();
    });
  });
});

/*
 * A practice (`0061`): a professional's to pay for, at a configured price, and
 * never the `premium` switch's to open. What it includes is not this service's
 * to say — the webhook writes it from configuration.
 */
describe('BillingService — a practice', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens checkout at the chosen practice price, with fourteen free days, back to the workspace', async () => {
    const { gateway, service } = harness({ premium: false, professional: true });

    await expect(service.checkout(PERSON, 'practice', 'price_practice_60')).resolves.toEqual({ url: 'https://checkout.stripe.com/c/session' });
    expect(gateway.checkoutUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelUrl: 'https://nutria.example/consulta',
        plan: 'practice',
        price: 'price_practice_60',
        successUrl: 'https://nutria.example/consulta?practica=gracias',
        trialDays: 14
      })
    );
  });

  it('has no trial for an account that has subscribed before, to anything', async () => {
    const { gateway, service } = harness({ professional: true, subscription: CANCELLED });

    await service.checkout(PERSON, 'practice', 'price_practice_30');
    expect(gateway.checkoutUrl).toHaveBeenCalledWith(expect.objectContaining({ trialDays: null }));
  });

  it('is a 404 for a price that is not a practice price, for somebody who is not a professional, and without practice prices', async () => {
    await expect(harness({ professional: true }).service.checkout(PERSON, 'practice', 'price_monthly')).rejects.toBeInstanceOf(NotFoundError);
    jest.restoreAllMocks();
    await expect(harness({ professional: false }).service.checkout(PERSON, 'practice', 'price_practice_30')).rejects.toBeInstanceOf(NotFoundError);
    jest.restoreAllMocks();
    await expect(harness({ practices: false, professional: true }).service.checkout(PERSON, 'practice', 'price_practice_30')).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it('with test keys, is the owner’s alone', async () => {
    const { service } = harness({ professional: true, testMode: true });

    await expect(service.checkout(PERSON, 'practice', 'price_practice_30')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.practiceOffer(PERSON)).resolves.toEqual({ available: false });
    await expect(service.checkout(OWNER, 'practice', 'price_practice_30')).resolves.toEqual({ url: 'https://checkout.stripe.com/c/session' });
  });

  it('sends somebody already paying to the portal instead', async () => {
    const { service } = harness({ professional: true, subscription: { ...CANCELLED, status: 'trialing' } });

    await expect(service.checkout(PERSON, 'practice', 'price_practice_30')).rejects.toBeInstanceOf(ConflictError);
  });

  it('opens the portal to a professional while the premium switch is off', async () => {
    const { service } = harness({ customer: 'cus_1', premium: false, professional: true });

    await expect(service.portal(PERSON)).resolves.toEqual({ url: 'https://billing.stripe.com/p/session' });
  });

  it('offers the plans, the subscription and the trial', async () => {
    const { service } = harness({ professional: true });

    await expect(service.practiceOffer(PERSON)).resolves.toEqual({
      available: true,
      plans: PLANS,
      subscription: null,
      testMode: false,
      trialDays: 14
    });
  });

  it('decides what the webhook writes from the gateway’s reading of the price, never from the event', async () => {
    const { apply, gateway, service } = harness({ event: event('customer.subscription.updated', { id: 'sub_1', includedClients: 999 }) });
    const grantOf = jest.fn((_price: string | null) => ({ includedClients: 30, kind: 'practice' as const }));

    Object.assign(gateway, { grantOf });
    apply.mockImplementation(async (_userId, latest, _siblings, grants) => {
      grants((await latest()).priceId);

      return 'practice';
    });
    await service.webhook(Buffer.from('{}'), 'signed');

    expect(grantOf).toHaveBeenCalledWith('price_monthly');
  });
});
