import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { UserController } from 'core/controllers/User';
import { UNAUDITED } from 'core/entities/Audit';

import { createApp, deleteAccounts, httpServer, PREFIX, ScriptedAiClient } from './harness.js';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * Who may use the product, and what they are told when they may not (`0030`,
 * `0031`).
 *
 * An account is usable when **both** locks are open: the address is confirmed
 * and the owner has opened the account. The two are undone by different people,
 * so the API must say which is missing — and it must never say it with a 401 or
 * a 403, which are the shapes this codebase reserves for nothing at all.
 *
 * Requires a real database — see ./README.md.
 */
const PASSWORD = 'correct-horse-battery-staple-9';

describe('access: two locks, and the shape of a denial', () => {
  let app: INestApplication;
  let stamp: number;
  /** Every account this suite signed up, so `afterAll` can delete each one — `locks-delete` deletes itself and is not added twice. */
  const made: string[] = [];

  async function signUp(email: string): Promise<string> {
    const server = httpServer(app);

    await request(server).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Test', password: PASSWORD }).expect(200);

    const signIn: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: PASSWORD }).expect(200);
    const cookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');

    made.push(cookie);

    return cookie;
  }

  const code = (response: Response) => (response.body as { code?: string }).code;

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([]));
    stamp = Date.now();
  });

  afterAll(async () => {
    await deleteAccounts(app, made);
    await app?.close();
  });

  it('refuses an unconfirmed, unopened account by naming the address first', async () => {
    const cookie = await signUp(`locks-none-${stamp}@e2e.invalid`);
    const refused = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', cookie).expect(409);

    // The address before the account: it is the half the person can fix from
    // their own inbox, and being told to wait for an owner instead is a dead end.
    expect(code(refused)).toBe('EMAIL_NOT_VERIFIED');
  });

  it('still refuses once the address is confirmed, now naming the account', async () => {
    const email = `locks-address-${stamp}@e2e.invalid`;
    const cookie = await signUp(email);

    await UserController.confirmAddress(email);

    const refused = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', cookie).expect(409);

    expect(code(refused)).toBe('ACCOUNT_NOT_ACTIVATED');
  });

  it('still refuses an opened account whose address nobody ever proved', async () => {
    const email = `locks-owner-${stamp}@e2e.invalid`;
    const cookie = await signUp(email);

    await UserController.activate({ email }, UNAUDITED);

    const refused = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', cookie).expect(409);

    // The owner can vouch for who may enter, not for whose mailbox this is.
    expect(code(refused)).toBe('EMAIL_NOT_VERIFIED');
  });

  it('lets the account in only when both are done', async () => {
    const email = `locks-both-${stamp}@e2e.invalid`;
    const cookie = await signUp(email);

    await UserController.confirmAddress(email);
    await UserController.activate({ email }, UNAUDITED);

    await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', cookie).expect(200);
  });

  it('answers the two routes a waiting account needs, in every state', async () => {
    const cookie = await signUp(`locks-waiting-${stamp}@e2e.invalid`);
    const server = httpServer(app);

    // Who am I, and which wait is this: without both, `/pendiente` could only
    // guess what to tell the person.
    const me: Response = await request(server).get(`/${PREFIX}/users/me`).set('Cookie', cookie).expect(200);
    const settings: Response = await request(server).get(`/${PREFIX}/settings`).set('Cookie', cookie).expect(200);

    expect(me.body).toMatchObject({ activated: false, emailVerified: false });
    expect(settings.body).toHaveProperty('flags.automaticActivation');
  });

  it('answers 404, never 401 or 403, to a caller with no session', async () => {
    const server = httpServer(app);
    const paths = [
      '/profile',
      '/users/me',
      '/settings',
      '/meal-plans/active',
      '/vacations',
      '/progress/weight',
      '/admin/summary',
      '/admin/product',
      '/admin/plans',
      // A period the route would refuse is still a 404 without a session: the denial comes before the query is read.
      '/admin/plans?period=14',
      // The people tables (project 007 phase 5): the same 404 with a query they would refuse with 422.
      '/admin/accounts',
      '/admin/accounts?sort=password&size=0',
      '/admin/feedback',
      '/admin/feedback?state=unread',
      '/admin/professionals',
      '/admin/professionals?sort=createdAt',
      '/admin/people',
      '/admin/people?period=14',
      // The generation log, its charts, AI, pictures and the catalogue (project 007 phase 7): plain, and with a query they would refuse.
      '/admin/generations',
      '/admin/generations?status=nope&size=0',
      '/admin/generations?q=a%00b',
      '/admin/generations/stats',
      '/admin/generations/stats?period=14',
      '/admin/ai',
      '/admin/ai?period=14',
      '/admin/pictures',
      '/admin/pictures?period=14',
      '/admin/pictures?period=1',
      '/admin/catalogue/recipes',
      '/admin/catalogue/recipes?sort=createdAt',
      '/admin/catalogue/ingredients',
      '/admin/catalogue/ingredients?sort=x',
      '/admin/catalogue/ingredients?category=x',
      // The admin trail (0071): plain, and with an action it would refuse.
      '/admin/audit',
      '/admin/audit?action=nope',
      // Catalogue quality, consents, notifications, system and the quality filter (project 008 phase 3): plain, and with a query they would refuse.
      '/admin/catalogue/quality',
      '/admin/catalogue/quality?period=12',
      '/admin/consents',
      '/admin/notifications',
      '/admin/notifications?period=12',
      '/admin/system',
      '/admin/system?period=12',
      '/admin/catalogue/recipes?check=over_bound',
      '/admin/catalogue/recipes?check=nope',
      '/health-data'
    ];

    for (const path of paths) {
      await request(server).get(`/${PREFIX}${path}`).expect(404);
    }
  });

  it('refuses a plan to an account that has not finished onboarding, and says so', async () => {
    const email = `locks-onboarding-${stamp}@e2e.invalid`;
    const cookie = await signUp(email);

    await UserController.confirmAddress(email);
    await UserController.activate({ email }, UNAUDITED);

    const refused = await request(httpServer(app)).post(`/${PREFIX}/meal-plans/generate`).set('Cookie', cookie).expect(409);

    expect(code(refused)).toBe('ONBOARDING_INCOMPLETE');
  });

  it('takes the account and its data with it when it is deleted', async () => {
    const email = `locks-delete-${stamp}@e2e.invalid`;
    const cookie = await signUp(email);
    const server = httpServer(app);

    await UserController.confirmAddress(email);
    await UserController.activate({ email }, UNAUDITED);
    await request(server).patch(`/${PREFIX}/profile`).set('Cookie', cookie).send({ displayName: 'Gone' }).expect(200);

    // An admin mutation about this account, so the trail (0071) has a row
    // naming it to lose — through a second, admin account of the suite's own.
    const ownerEmail = `locks-delete-owner-${stamp}@e2e.invalid`;
    const ownerCookie = await signUp(ownerEmail);

    // The admin session needs both its own locks open too, like anybody else's.
    await UserController.confirmAddress(ownerEmail);
    await UserController.activate({ email: ownerEmail }, UNAUDITED);
    await UserController.grantAdmin(ownerEmail);

    const me: Response = await request(server).get(`/${PREFIX}/users/me`).set('Cookie', cookie).expect(200);
    const targetId = (me.body as { id: string }).id;

    await request(server).patch(`/${PREFIX}/admin/accounts/${targetId}/tier`).set('Cookie', ownerCookie).send({ tier: 'premium' }).expect(200);

    const before: Response = await request(server)
      .get(`/${PREFIX}/admin/audit?action=account.tier_changed&size=1`)
      .set('Cookie', ownerCookie)
      .expect(200);
    const beforeRow = (before.body as { rows: { at: string; subject: string | null }[] }).rows[0];

    expect(beforeRow).toMatchObject({ subject: email });

    await request(server).delete(`/${PREFIX}/users/me`).set('Cookie', cookie).expect(204);

    // The session dies with the row, and the credentials with it: the account is
    // not merely unreachable, it is not there (`ARCHITECTURE.md` § Privacy).
    await request(server).get(`/${PREFIX}/profile`).set('Cookie', cookie).expect(404);

    // The trail's own row about it survives, subject-less — the action outlives the account without naming it (0071).
    const after: Response = await request(server)
      .get(`/${PREFIX}/admin/audit?action=account.tier_changed&size=1`)
      .set('Cookie', ownerCookie)
      .expect(200);
    const afterRow = (after.body as { rows: { at: string; subject: string | null }[] }).rows.find(row => row.at === beforeRow?.at);
    const text = JSON.stringify(after.body);

    expect(afterRow).toMatchObject({ subject: null });
    // ipHash and entityId are read straight off the table (audit.e2e-spec.ts);
    // here the point is narrower — the console's own answer never carries either key at all.
    expect(text.toLowerCase()).not.toContain('iphash');
    expect(text.toLowerCase()).not.toContain('entityid');
    await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: PASSWORD }).expect(401);
  });
});
