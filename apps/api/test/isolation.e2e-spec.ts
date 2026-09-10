import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import express from 'express';

import { AppModule } from '../src/app.module.js';
import { activate, httpServer } from './harness.js';

import type { FullProfileView } from 'core/controllers/Profile';
import type { INestApplication } from '@nestjs/common';
import type { OnboardingView } from 'core/controllers/Onboarding';
import type { UserView } from 'core/controllers/User';

/**
 * The test this product cannot ship without: **user A must not be able to read
 * or write user B's data**, by any route, however the id is supplied.
 *
 * Requires a real database — see ./README.md. It is excluded from `pnpm test`
 * because a green unit suite must not imply this ran.
 */
const PREFIX = 'api/v1';

type Account = { id: string; cookie: string; email: string };

describe('user data isolation', () => {
  let app: INestApplication;
  let alice: Account;
  let bob: Account;

  async function register(email: string): Promise<Account> {
    const password = 'correct-horse-battery-staple-9';

    await request(httpServer(app))
      .post(`/${PREFIX}/auth/sign-up/email`)
      .send({ email, name: email.split('@')[0], password })
      .expect(200);
    await activate(email);

    const signIn = await request(httpServer(app)).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password }).expect(200);
    const cookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');
    const me = await request(httpServer(app)).get(`/${PREFIX}/users/me`).set('Cookie', cookie).expect(200);

    return { id: (me.body as UserView).id, cookie, email };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(PREFIX);
    app.use(`/${PREFIX}/auth`, (_q: express.Request, _s: express.Response, next: express.NextFunction) => next());
    app.use(express.json());
    await app.init();

    const stamp = Date.now();
    alice = await register(`alice-${stamp}@e2e.invalid`);
    bob = await register(`bob-${stamp}@e2e.invalid`);

    await request(httpServer(app)).patch(`/${PREFIX}/profile`).set('Cookie', alice.cookie).send({ displayName: 'Alice', heightCm: 170 }).expect(200);
    await request(httpServer(app)).patch(`/${PREFIX}/profile`).set('Cookie', bob.cookie).send({ displayName: 'Bob', heightCm: 180 }).expect(200);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('gives each account only its own profile', async () => {
    const aliceProfile = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', alice.cookie).expect(200);
    const bobProfile = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', bob.cookie).expect(200);

    expect((aliceProfile.body as FullProfileView).profile?.displayName).toBe('Alice');
    expect((bobProfile.body as FullProfileView).profile?.displayName).toBe('Bob');
    expect((aliceProfile.body as FullProfileView).profile?.id).not.toBe((bobProfile.body as FullProfileView).profile?.id);
  });

  it('ignores a userId smuggled into the request body', async () => {
    await request(httpServer(app))
      .patch(`/${PREFIX}/profile`)
      .set('Cookie', alice.cookie)
      .send({ displayName: 'Alice edited', userId: bob.id })
      .expect(200);

    const bobProfile = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', bob.cookie).expect(200);

    expect((bobProfile.body as FullProfileView).profile?.displayName).toBe('Bob');
  });

  it('refuses every protected route without a session, with 404 rather than 401', async () => {
    for (const path of ['profile', 'onboarding', 'users/me', 'safety/restrictions']) {
      await request(httpServer(app)).get(`/${PREFIX}/${path}`).expect(404);
    }
  });

  it('refuses a forged session cookie', async () => {
    await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', 'better-auth.session_token=forged').expect(404);
  });

  it("does not leak another account's onboarding progress", async () => {
    await request(httpServer(app))
      .patch(`/${PREFIX}/onboarding`)
      .set('Cookie', alice.cookie)
      .send({ data: { displayName: 'Alice' }, step: 'about-you' })
      .expect(200);

    const bobState = await request(httpServer(app)).get(`/${PREFIX}/onboarding`).set('Cookie', bob.cookie).expect(200);

    expect((bobState.body as OnboardingView).completedSteps).toEqual([]);
  });

  it('deletes only the requesting account', async () => {
    await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', alice.cookie).expect(204);

    await request(httpServer(app)).get(`/${PREFIX}/users/me`).set('Cookie', alice.cookie).expect(404);
    await request(httpServer(app)).get(`/${PREFIX}/users/me`).set('Cookie', bob.cookie).expect(200);

    await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', bob.cookie).expect(204);
  });
});
