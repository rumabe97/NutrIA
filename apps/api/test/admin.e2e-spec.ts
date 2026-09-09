import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { SettingsController } from 'core/controllers/Settings';
import { UserController } from 'core/controllers/User';

import { createApp, httpServer, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { AccountView } from 'core/controllers/User';
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
const ROUTES = ['overview', 'failures', 'accounts', 'settings'];

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

    await request(httpServer(app)).post(`/${PREFIX}/auth/sign-up/email`).send({ email: waiting, name: 'Waiting', password: 'correct-horse-battery-staple-9' }).expect(200);
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
    const accounts = listed.body as AccountView[];
    const queued = accounts.find(account => account.email === waiting);

    expect(queued).toMatchObject({ activated: false, emailVerified: false });
    // Address, dates and role. A screen that can read what somebody eats is how
    // an admin surface becomes a way to read health data.
    expect(Object.keys(queued ?? {}).sort()).toEqual(['activated', 'createdAt', 'email', 'emailVerified', 'id', 'role']);
  });

  it('opens a waiting account, and the account is open afterwards', async () => {
    const accounts: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);
    const queued = (accounts.body as AccountView[]).find(account => account.email === waiting);

    const opened: Response = await request(httpServer(app)).post(`/${PREFIX}/admin/accounts/${queued?.id}/activate`).set('Cookie', owner.cookie).expect(201);

    expect(opened.body).toMatchObject({ email: waiting });

    const after: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);

    expect((after.body as AccountView[]).find(account => account.email === waiting)).toMatchObject({ activated: true, emailVerified: false });
  });

  it('throws the activation switch, and the switch is what the product reads', async () => {
    const server = httpServer(app);

    await request(server).patch(`/${PREFIX}/admin/settings`).set('Cookie', owner.cookie).send({ automaticActivation: false }).expect(200);
    await expect(SettingsController.automaticActivation()).resolves.toBe(false);

    const read: Response = await request(server).get(`/${PREFIX}/settings`).set('Cookie', ordinary.cookie).expect(200);

    expect(read.body).toMatchObject({ automaticActivation: false });

    await request(server).patch(`/${PREFIX}/admin/settings`).set('Cookie', owner.cookie).send({ automaticActivation: true }).expect(200);
    await expect(SettingsController.automaticActivation()).resolves.toBe(true);
  });

  it('refuses an account id that is not an account', async () => {
    await request(httpServer(app)).post(`/${PREFIX}/admin/accounts/not-an-account/activate`).set('Cookie', owner.cookie).expect(404);
  });
});
