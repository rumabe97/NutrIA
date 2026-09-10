import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { SettingsController } from 'core/controllers/Settings';
import { UserController } from 'core/controllers/User';

import { activationToken } from '../src/modules/auth/services/ActivationLink.js';

import { createApp, httpServer, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { AccountView, Paged } from 'core/controllers/User';
import type { AdminAnalyticsView, AiUsageView } from 'core/controllers/Admin';
import type { FeedbackView } from 'core/controllers/Feedback';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The owner's own window on the service (`0028`, `0031`).
 *
 * Two things are worth an end-to-end test here and they pull in opposite
 * directions: an ordinary account must not be able to tell that any of these
 * routes exist, and the owner must be able to open an account from them. The
 * first is the one that matters — an admin surface reachable by a signed-in user
 * is a way to read the whole service.
 *
 * Requires a real database — see ./README.md.
 */
const ROUTES = ['overview', 'failures', 'accounts', 'settings', 'analytics', 'ai', 'feedback'];

describe('admin', () => {
  let app: INestApplication;
  let owner: Account;
  let ordinary: Account;
  let waiting: string;

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([]));

    const stamp = Date.now();

    owner = await register(app, `admin-owner-${stamp}@e2e.invalid`);
    ordinary = await register(app, `admin-user-${stamp}@e2e.invalid`);
    waiting = `admin-waiting-${stamp}@e2e.invalid`;

    await request(httpServer(app))
      .post(`/${PREFIX}/auth/sign-up/email`)
      .send({ email: waiting, name: 'Waiting', password: 'correct-horse-battery-staple-9' })
      .expect(200);
    await UserController.grantAdmin(owner.email);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('does not exist for an ordinary account', async () => {
    for (const route of ROUTES) {
      await request(httpServer(app)).get(`/${PREFIX}/admin/${route}`).set('Cookie', ordinary.cookie).expect(404);
    }

    await request(httpServer(app)).post(`/${PREFIX}/admin/accounts/${ordinary.id}/activate`).set('Cookie', ordinary.cookie).expect(404);
  });

  it('answers the owner', async () => {
    for (const route of ROUTES) {
      await request(httpServer(app)).get(`/${PREFIX}/admin/${route}`).set('Cookie', owner.cookie).expect(200);
    }
  });

  it('lists every account with the state of its two locks, and nothing about anybody', async () => {
    const listed: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);
    const page = listed.body as Paged<AccountView>;
    // Newest first, so the three this suite just made are on the first page
    // however many thousand accounts came before them.
    const queued = page.rows.find(account => account.email === waiting);

    expect(page.total).toBeGreaterThanOrEqual(page.rows.length);
    expect(page.rows.length).toBeLessThanOrEqual(page.size);

    expect(queued).toMatchObject({ activated: false, emailVerified: false });
    // Address, dates, role and tier. A screen that can read what somebody eats is
    // how an admin surface becomes a way to read health data — `tier` is on this
    // list because it is a fact about billing that the owner has to see to know
    // who they granted, and nothing about a person's body or their food ever
    // joins it. The assertion is exhaustive so adding a field is a decision.
    expect(Object.keys(queued ?? {}).sort()).toEqual(['activated', 'createdAt', 'email', 'emailVerified', 'id', 'role', 'tier']);
  });

  it('opens a waiting account, and the account is open afterwards', async () => {
    const accounts: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);
    const queued = (accounts.body as Paged<AccountView>).rows.find(account => account.email === waiting);

    const opened: Response = await request(httpServer(app))
      .post(`/${PREFIX}/admin/accounts/${queued?.id}/activate`)
      .set('Cookie', owner.cookie)
      .expect(201);

    expect(opened.body).toMatchObject({ email: waiting });

    const after: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);

    expect((after.body as Paged<AccountView>).rows.find(account => account.email === waiting)).toMatchObject({
      activated: true,
      emailVerified: false
    });
  });

  it('throws the activation switch, and the switch is what the product reads', async () => {
    const server = httpServer(app);

    await request(server)
      .patch(`/${PREFIX}/admin/settings`)
      .set('Cookie', owner.cookie)
      .send({ enabled: false, flag: 'automaticActivation' })
      .expect(200);
    await expect(SettingsController.automaticActivation()).resolves.toBe(false);

    const read: Response = await request(server).get(`/${PREFIX}/settings`).set('Cookie', ordinary.cookie).expect(200);

    expect(read.body).toMatchObject({ flags: { automaticActivation: false } });

    await request(server)
      .patch(`/${PREFIX}/admin/settings`)
      .set('Cookie', owner.cookie)
      .send({ enabled: true, flag: 'automaticActivation' })
      .expect(200);
    await expect(SettingsController.automaticActivation()).resolves.toBe(true);
  });

  /**
   * The owner's half of the tier (`0042`): the column moves, and the list says
   * so. That the *allowances* follow is proved where an account has a plan to
   * spend them on — `plan-lifecycle`, which is also where the switch outranking
   * the column can be seen as behaviour rather than as a number.
   *
   * Granted with the `premium` switch off on purpose: that is how the owner sets
   * up who should have it before turning it on, and the grant must not depend on
   * the switch's position.
   */
  it('moves an account between tiers, and the list says which it is on', async () => {
    const server = httpServer(app);

    await request(server).patch(`/${PREFIX}/admin/accounts/${ordinary.id}/tier`).set('Cookie', owner.cookie).send({ tier: 'premium' }).expect(200);

    const listed: Response = await request(server).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);

    expect((listed.body as Paged<AccountView>).rows.find(account => account.id === ordinary.id)).toMatchObject({ tier: 'premium' });

    await request(server).patch(`/${PREFIX}/admin/accounts/${ordinary.id}/tier`).set('Cookie', owner.cookie).send({ tier: 'free' }).expect(200);
  });

  it('answers 404 when the account whose tier is being moved does not exist', async () => {
    await request(httpServer(app))
      .patch(`/${PREFIX}/admin/accounts/usr-nobody/tier`)
      .set('Cookie', owner.cookie)
      .send({ tier: 'premium' })
      .expect(404);
  });

  /*
   * The registry is what says a flag exists. A route that wrote whatever key it
   * was handed would let a typo create a row nothing ever reads, and the switch
   * would look thrown while the product carried on with the fallback.
   */
  it('refuses a flag the registry does not declare', async () => {
    await request(httpServer(app))
      .patch(`/${PREFIX}/admin/settings`)
      .set('Cookie', owner.cookie)
      .send({ enabled: true, flag: 'not_a_flag' })
      .expect(422);
  });

  it('counts the funnel from the rows, so it covers accounts older than the counting', async () => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/analytics`).set('Cookie', owner.cookie).expect(200);
    const view = response.body as AdminAnalyticsView;

    // These accounts were made by this suite, and every one of them signed up
    // and signed in — so the first stage cannot be smaller than the accounts,
    // and somebody came back, because `register` signs in.
    expect(view.funnel.signedUp).toBeGreaterThanOrEqual(3);
    expect(view.funnel.signedUp).toBeGreaterThanOrEqual(view.funnel.activated);
    expect(view.funnel.activated).toBeGreaterThanOrEqual(view.funnel.onboarded);
    expect(view.activity.events.some(row => row.event === 'session_started')).toBe(true);
    expect(view.activity.people).toBeGreaterThan(0);
  });

  it('pages the account list rather than capping it', async () => {
    const server = httpServer(app);
    const first: Response = await request(server).get(`/${PREFIX}/admin/accounts?size=2`).set('Cookie', owner.cookie).expect(200);
    const second: Response = await request(server).get(`/${PREFIX}/admin/accounts?size=2&offset=2`).set('Cookie', owner.cookie).expect(200);
    const one = first.body as Paged<AccountView>;
    const two = second.body as Paged<AccountView>;

    expect(one.rows).toHaveLength(2);
    expect(one.total).toBe(two.total);
    // A page is a different page, not the same rows with a different number on it.
    expect(one.rows.map(row => row.id)).not.toEqual(two.rows.map(row => row.id));
  });

  it('counts what the provider was asked for today, and says whose number the limit is', async () => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/ai`).set('Cookie', owner.cookie).expect(200);
    const usage = response.body as AiUsageView;

    // The suites script the model, so nothing reaches a provider and the count
    // is zero — which is the assertion: it counts real requests, not scripted
    // ones. `limits` is null unless an operator configured it (`0035`).
    expect(usage).toMatchObject({ calls: 0, refused: 0 });
    expect(usage.limits).toEqual({ requestsPerDay: null, tokensPerMinute: null });
    expect(Date.parse(usage.resetsAt)).toBeGreaterThan(Date.now());
  });

  it('carries a message from the person who wrote it to the owner, and back again', async () => {
    const server = httpServer(app);

    await request(server)
      .post(`/${PREFIX}/feedback`)
      .set('Cookie', ordinary.cookie)
      .send({ kind: 'problem', message: 'La cena sale muy tarde' })
      .expect(204);

    const inbox: Response = await request(server).get(`/${PREFIX}/admin/feedback`).set('Cookie', owner.cookie).expect(200);
    const page = inbox.body as Paged<FeedbackView> & { waiting: number };
    const mine = page.rows.find(row => row.message === 'La cena sale muy tarde');

    // Their words as typed, and the address that makes a reply possible — the
    // one admin read that carries something about a person, because the message
    // was written to be read (`0037`).
    expect(mine).toMatchObject({ email: ordinary.email, handled: false, kind: 'problem' });
    expect(page.waiting).toBeGreaterThan(0);

    // Handled is a note the owner leaves themselves, and it can be taken back.
    await request(server).patch(`/${PREFIX}/admin/feedback/${mine?.id}`).set('Cookie', owner.cookie).send({ handled: true }).expect(204);

    const seen: Response = await request(server).get(`/${PREFIX}/admin/feedback`).set('Cookie', owner.cookie).expect(200);

    expect((seen.body as Paged<FeedbackView>).rows.find(row => row.id === mine?.id)?.handled).toBe(true);

    await request(server).patch(`/${PREFIX}/admin/feedback/${mine?.id}`).set('Cookie', owner.cookie).send({ handled: false }).expect(204);
  });

  it('will not let an ordinary account read what other people wrote', async () => {
    await request(httpServer(app)).get(`/${PREFIX}/admin/feedback`).set('Cookie', ordinary.cookie).expect(404);
  });

  it('refuses an empty message rather than filing it', async () => {
    await request(httpServer(app)).post(`/${PREFIX}/feedback`).set('Cookie', ordinary.cookie).send({ kind: 'idea', message: '   ' }).expect(422);
  });

  /*
   * The button in the owner's mail (`0030`), which nothing covered until it was
   * found dead: the handler is `@Public()` on a controller that is
   * `@Roles('admin')`, so it arrived at `AdminGuard` with no session and a role
   * list it had inherited, and 404'd every click — indistinguishable from a
   * stale token, which is why nobody noticed.
   */
  it('opens an account from the link in the owner\u2019s mail, and refuses a forged one', async () => {
    const server = httpServer(app);
    const email = `admin-link-${Date.now()}@e2e.invalid`;

    await request(server).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Link', password: 'correct-horse-battery-staple-9' }).expect(200);

    const listed: Response = await request(server).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);
    const queued = (listed.body as Paged<AccountView>).rows.find(account => account.email === email);

    expect(queued).toMatchObject({ activated: false });

    const token = activationToken(queued?.id ?? '', process.env.BETTER_AUTH_SECRET ?? '');

    await request(server).get(`/${PREFIX}/admin/activate`).query({ token }).expect(302);

    const after: Response = await request(server).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);

    expect((after.body as Paged<AccountView>).rows.find(account => account.email === email)).toMatchObject({ activated: true });

    // A forged token is the same 404 as everything else this service denies.
    await request(server).get(`/${PREFIX}/admin/activate`).query({ token: 'not.a.token' }).expect(404);
    await request(server).get(`/${PREFIX}/admin/activate`).expect(404);
  });

  it('refuses an account id that is not an account', async () => {
    await request(httpServer(app)).post(`/${PREFIX}/admin/accounts/not-an-account/activate`).set('Cookie', owner.cookie).expect(404);
  });
});
