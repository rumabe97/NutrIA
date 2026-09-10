import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { UserController } from 'core/controllers/User';

import { createApp, httpServer, PREFIX, ScriptedAiClient } from './harness.js';

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

  async function signUp(email: string): Promise<string> {
    const server = httpServer(app);

    await request(server).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Test', password: PASSWORD }).expect(200);

    const signIn: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: PASSWORD }).expect(200);

    return (signIn.headers['set-cookie'] as unknown as string[]).join('; ');
  }

  const code = (response: Response) => (response.body as { code?: string }).code;

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([]));
    stamp = Date.now();
  });

  afterAll(async () => {
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

    await UserController.activate({ email });

    const refused = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', cookie).expect(409);

    // The owner can vouch for who may enter, not for whose mailbox this is.
    expect(code(refused)).toBe('EMAIL_NOT_VERIFIED');
  });

  it('lets the account in only when both are done', async () => {
    const email = `locks-both-${stamp}@e2e.invalid`;
    const cookie = await signUp(email);

    await UserController.confirmAddress(email);
    await UserController.activate({ email });

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
    const paths = ['/profile', '/users/me', '/settings', '/meal-plans/active', '/vacations', '/progress/weight', '/admin/overview', '/health-data'];

    for (const path of paths) {
      await request(server).get(`/${PREFIX}${path}`).expect(404);
    }
  });

  it('refuses a plan to an account that has not finished onboarding, and says so', async () => {
    const email = `locks-onboarding-${stamp}@e2e.invalid`;
    const cookie = await signUp(email);

    await UserController.confirmAddress(email);
    await UserController.activate({ email });

    const refused = await request(httpServer(app)).post(`/${PREFIX}/meal-plans/generate`).set('Cookie', cookie).expect(409);

    expect(code(refused)).toBe('ONBOARDING_INCOMPLETE');
  });

  it('takes the account and its data with it when it is deleted', async () => {
    const email = `locks-delete-${stamp}@e2e.invalid`;
    const cookie = await signUp(email);
    const server = httpServer(app);

    await UserController.confirmAddress(email);
    await UserController.activate({ email });
    await request(server).patch(`/${PREFIX}/profile`).set('Cookie', cookie).send({ displayName: 'Gone' }).expect(200);

    await request(server).delete(`/${PREFIX}/users/me`).set('Cookie', cookie).expect(204);

    // The session dies with the row, and the credentials with it: the account is
    // not merely unreachable, it is not there (`ARCHITECTURE.md` § Privacy).
    await request(server).get(`/${PREFIX}/profile`).set('Cookie', cookie).expect(404);
    await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: PASSWORD }).expect(401);
  });
});
