import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { BillingController } from 'core/controllers/Billing';
import { ConflictError, NotFoundError } from 'core/entities/Error';
import { ProfileController } from 'core/controllers/Profile';
import { SettingsController } from 'core/controllers/Settings';

import { BillingService } from './Billing.service.js';

import type { Env } from '../../../config/index.js';
import type { SessionUser } from '../../../shared/index.js';
import type { CheckoutRequest, Prices, StripeGateway, SubscriptionSnapshot } from './StripeGateway.js';
import type { SubscriptionView } from 'core/controllers/Billing';
import type Stripe from 'stripe';

const ENV = { APP_URL: 'https://nutria.example' } as Env;
const OWNER = { id: 'usr-owner', activated: true, email: 'owner@example.invalid', emailVerified: true, name: 'Owner', role: 'admin' } as SessionUser;
const PERSON = { ...OWNER, id: 'usr-ana', email: 'ana@example.invalid', name: 'Ana', role: 'user' } as SessionUser;
const PRICES: Prices = { monthly: { amount: 499, currency: 'eur', interval: 'month' }, yearly: { amount: 3999, currency: 'eur', interval: 'year' } };
const CANCELLED: SubscriptionView = { cancelAtPeriodEnd: false, currentPeriodEnd: null, status: 'canceled' };
const SNAPSHOT: SubscriptionSnapshot = {
  cancelAtPeriodEnd: false,
  currentPeriodEnd: new Date('2026-10-13T00:00:00Z'),
  customerId: 'cus_1',
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
    premium?: boolean;
    subscription?: SubscriptionView | null;
    testMode?: boolean;
    yearly?: boolean;
  } = {}
) {
  const gateway = {
    checkoutUrl: jest.fn<(request: CheckoutRequest) => Promise<string>>().mockResolvedValue('https://checkout.stripe.com/c/session'),
    configured: options.configured ?? true,
    createCustomer: jest.fn<(email: string, userId: string) => Promise<string>>().mockResolvedValue('cus_new'),
    event: jest.fn(() => (options.event === undefined ? event('invoice.paid', {}) : options.event)),
    portalUrl: jest.fn<(customerId: string, returnUrl: string) => Promise<string>>().mockResolvedValue('https://billing.stripe.com/p/session'),
    prices: jest.fn(async () => PRICES),
    subscription: jest.fn<(id: string) => Promise<SubscriptionSnapshot>>().mockResolvedValue(SNAPSHOT),
    testMode: options.testMode ?? false,
    yearly: options.yearly ?? true
  };

  jest.spyOn(SettingsController, 'flags').mockResolvedValue({ automaticActivation: true, checkInReminders: false, premium: options.premium ?? true });
  jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('es-ES');
  jest.spyOn(BillingController, 'standing').mockResolvedValue({ subscription: options.subscription ?? null, tier: 'free' });
  jest.spyOn(BillingController, 'customerOf').mockResolvedValue(options.customer ?? null);

  const remember = jest.spyOn(BillingController, 'rememberCustomer').mockResolvedValue(undefined);
  const apply = jest.spyOn(BillingController, 'applySubscription').mockResolvedValue('premium');
  const owner = jest.spyOn(BillingController, 'userOfCustomer').mockResolvedValue('usr-ana');

  return { apply, gateway, owner, remember, service: new BillingService(ENV, gateway as unknown as StripeGateway) };
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

  it('opens checkout for a new customer with the free trial, remembering who they are to Stripe', async () => {
    const { gateway, remember, service } = harness();

    await expect(service.checkout(PERSON, 'monthly')).resolves.toEqual({ url: 'https://checkout.stripe.com/c/session' });
    expect(gateway.createCustomer).toHaveBeenCalledWith('ana@example.invalid', 'usr-ana');
    expect(remember).toHaveBeenCalledWith('usr-ana', 'cus_new');
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

    expect(gateway.subscription).toHaveBeenCalledWith('sub_1');
    expect(apply).toHaveBeenCalledWith('usr-ana', {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: SNAPSHOT.currentPeriodEnd,
      customerId: 'cus_1',
      status: 'active',
      subscriptionId: 'sub_1'
    });
  });

  it('falls back to the account named at checkout when the customer is not one it knows', async () => {
    const { apply, owner, service } = harness({ event: event('customer.subscription.updated', { id: 'sub_1' }) });

    owner.mockResolvedValue(null);
    await service.webhook(Buffer.from('{}'), 'signed');

    expect(apply).toHaveBeenCalledWith('usr-ana', expect.objectContaining({ subscriptionId: 'sub_1' }));
  });

  it('acknowledges and ignores an event that changes nothing about the tier', async () => {
    const { apply, gateway, service } = harness({ event: event('invoice.paid', {}) });

    await service.webhook(Buffer.from('{}'), 'signed');

    expect(gateway.subscription).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });
});
