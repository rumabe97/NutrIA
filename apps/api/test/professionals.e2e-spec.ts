import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { ProfessionalController } from 'core/controllers/Professional';
import { UserController } from 'core/controllers/User';

import { activate, createApp, deleteAccounts, httpServer, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { AccountView, Paged } from 'core/controllers/User';
import type { ProfessionalAccountView } from 'core/controllers/Professional';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * Who is a professional (`0059`, PRD criterion 1): an account the owner
 * granted on `/admin`, with a collegiate number — and nothing else.
 *
 * The suite is mostly about the doors that must stay shut. A professional will
 * reach other people's data through a link (Phase 3), so an account that could
 * make itself one — through the sign-up body, the account update, the profile —
 * would be an account that could read somebody else's. Each door is tried with
 * every word that could plausibly open it, and "changed nothing" is proved by
 * looking afterwards, not by the status code.
 *
 * No route carries `ProfessionalGuard` until Phase 2, so the guard's question
 * — `ProfessionalController.hasAccess` — is asked directly, with the switch on.
 *
 * Requires a real database — see ./README.md.
 */
const PASSWORD = 'correct-horse-battery-staple-9';
const NUMBER = '28/12345';
const SMUGGLED = { collegiateNumber: NUMBER, isProfessional: true, professional: true, role: 'admin' };

describe('professionals', () => {
  let app: INestApplication;
  let owner: Account;
  let ordinary: Account;
  let granted: Account;
  /** Every account this suite registered, so `afterAll` can delete each one. */
  const made: string[] = [];

  async function professionals(): Promise<readonly ProfessionalAccountView[]> {
    const listed: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/professionals`).set('Cookie', owner.cookie).expect(200);

    return listed.body as readonly ProfessionalAccountView[];
  }

  async function accountRow(id: string): Promise<AccountView | undefined> {
    const listed: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);

    return (listed.body as Paged<AccountView>).rows.find(row => row.id === id);
  }

  async function setSwitch(enabled: boolean): Promise<void> {
    await request(httpServer(app)).patch(`/${PREFIX}/admin/settings`).set('Cookie', owner.cookie).send({ enabled, flag: 'professional' }).expect(200);
  }

  /**
   * The account is exactly what it was: not on the owner's list, no row behind
   * the guard even with the switch on, still an ordinary role, and still a
   * stranger to `/admin`.
   */
  async function expectOrdinary(account: Account): Promise<void> {
    expect((await professionals()).some(row => row.userId === account.id)).toBe(false);
    await expect(ProfessionalController.find(account.id)).resolves.toBeNull();
    await expect(ProfessionalController.hasAccess(account.id)).resolves.toBe(false);
    expect(await accountRow(account.id)).toMatchObject({ role: 'user' });
    await request(httpServer(app)).get(`/${PREFIX}/admin/professionals`).set('Cookie', account.cookie).expect(404);
  }

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([]));

    const stamp = Date.now();

    owner = await register(app, `pro-owner-${stamp}@e2e.invalid`);
    made.push(owner.cookie);
    ordinary = await register(app, `pro-user-${stamp}@e2e.invalid`);
    made.push(ordinary.cookie);
    granted = await register(app, `pro-granted-${stamp}@e2e.invalid`);
    made.push(granted.cookie);
    await UserController.grantAdmin(owner.email);
    // On for the whole suite, so every "changed nothing" below is checked with
    // the switch in the position where a row *would* open the workspace.
    await setSwitch(true);
  });

  afterAll(async () => {
    // The switch fails off; leave it where it would be on a fresh database.
    if (owner) {
      await setSwitch(false);
    }

    await deleteAccounts(app, made);
    await app?.close();
  });

  it('does not exist for an ordinary account', async () => {
    const server = httpServer(app);

    await request(server).get(`/${PREFIX}/admin/professionals`).set('Cookie', ordinary.cookie).expect(404);
    await request(server)
      .post(`/${PREFIX}/admin/accounts/${ordinary.id}/professional`)
      .set('Cookie', ordinary.cookie)
      .send({ collegiateNumber: NUMBER })
      .expect(404);
    await request(server).delete(`/${PREFIX}/admin/accounts/${ordinary.id}/professional`).set('Cookie', ordinary.cookie).expect(404);

    await expectOrdinary(ordinary);
  });

  it('cannot be reached without a session', async () => {
    await request(httpServer(app)).post(`/${PREFIX}/admin/accounts/${ordinary.id}/professional`).send({ collegiateNumber: NUMBER }).expect(404);
  });

  /*
   * Better Auth may refuse a field it declares `input: false` (`role`) or drop
   * the ones it does not know; either answer is fine. What is not fine is an
   * account that comes out of it as anything but an ordinary one.
   */
  it('is not something a sign-up body can ask for', async () => {
    const server = httpServer(app);
    const email = `pro-signup-${Date.now()}@e2e.invalid`;

    const withRole: Response = await request(server)
      .post(`/${PREFIX}/auth/sign-up/email`)
      .send({ email, name: 'Smuggler', password: PASSWORD, ...SMUGGLED });

    if (withRole.status !== 200) {
      expect(withRole.status).toBe(400);
      // Refused outright: sign up again without `role`, still carrying the rest.
      const { role: _role, ...rest } = SMUGGLED;

      await request(server)
        .post(`/${PREFIX}/auth/sign-up/email`)
        .send({ email, name: 'Smuggler', password: PASSWORD, ...rest })
        .expect(200);
    }

    await activate(email);

    const signIn: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: PASSWORD }).expect(200);
    const cookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');
    const me: Response = await request(server).get(`/${PREFIX}/users/me`).set('Cookie', cookie).expect(200);

    made.push(cookie);
    await expectOrdinary({ id: (me.body as { id: string }).id, cookie, email });
  });

  /*
   * There is no `PATCH /users/me`; the account's own update is Better Auth's
   * `update-user`. Both are tried: the first must stay a 404, the second must
   * leave the account as it was whatever it answers.
   */
  it('is not something the account update can set', async () => {
    const server = httpServer(app);

    await request(server).patch(`/${PREFIX}/users/me`).set('Cookie', ordinary.cookie).send(SMUGGLED).expect(404);

    const updated: Response = await request(server)
      .post(`/${PREFIX}/auth/update-user`)
      .set('Cookie', ordinary.cookie)
      .send({ name: 'Still ordinary', ...SMUGGLED });

    expect([200, 400]).toContain(updated.status);

    await expectOrdinary(ordinary);
  });

  it('is not something a profile body can set', async () => {
    await request(httpServer(app))
      .patch(`/${PREFIX}/profile`)
      .set('Cookie', ordinary.cookie)
      .send({ displayName: 'Still ordinary', ...SMUGGLED })
      .expect(200);

    await expectOrdinary(ordinary);
  });

  it('refuses a collegiate number that is not one', async () => {
    const server = httpServer(app);

    for (const collegiateNumber of ['ab', 'x'.repeat(21), '28 12345', '28.12345', '', '   ']) {
      await request(server)
        .post(`/${PREFIX}/admin/accounts/${granted.id}/professional`)
        .set('Cookie', owner.cookie)
        .send({ collegiateNumber })
        .expect(422);
    }

    await request(server).post(`/${PREFIX}/admin/accounts/${granted.id}/professional`).set('Cookie', owner.cookie).send({}).expect(422);

    await expectOrdinary(granted);
  });

  it('answers 404 when the account does not exist', async () => {
    await request(httpServer(app))
      .post(`/${PREFIX}/admin/accounts/usr-nobody/professional`)
      .set('Cookie', owner.cookie)
      .send({ collegiateNumber: NUMBER })
      .expect(404);
  });

  it('is the owner’s act, and the list says who and never whom', async () => {
    const server = httpServer(app);

    const made: Response = await request(server)
      .post(`/${PREFIX}/admin/accounts/${granted.id}/professional`)
      .set('Cookie', owner.cookie)
      // Trimmed before it is measured or stored.
      .send({ collegiateNumber: `  ${NUMBER}  `, includedClients: 500, practiceOpen: true })
      .expect(201);

    expect(made.body).toMatchObject({ collegiateNumber: NUMBER, email: granted.email, userId: granted.id });

    const row = (await professionals()).find(listed => listed.userId === granted.id);

    // Address, number, date and link counts. Never a client (`0028`) — the
    // assertion is exhaustive so adding a field is a decision.
    expect(Object.keys(row ?? {}).sort()).toEqual(['collegiateNumber', 'email', 'grantedAt', 'links', 'userId']);
    expect(row?.links).toEqual({ active: 0, ended: 0, paused: 0 });

    // The body could not open the practice: that is billing's (Phase 7).
    await expect(ProfessionalController.find(granted.id)).resolves.toMatchObject({
      collegiateNumber: NUMBER,
      includedClients: 0,
      practiceOpen: false
    });
    await expect(ProfessionalController.hasAccess(granted.id)).resolves.toBe(true);
    // A professional is not an admin.
    expect(await accountRow(granted.id)).toMatchObject({ role: 'user' });
  });

  it('is nobody while the switch is off, whatever the table says', async () => {
    await setSwitch(false);
    await expect(ProfessionalController.hasAccess(granted.id)).resolves.toBe(false);
    await setSwitch(true);
    await expect(ProfessionalController.hasAccess(granted.id)).resolves.toBe(true);
  });

  it('keeps the switch between the owner and the product', async () => {
    const read: Response = await request(httpServer(app)).get(`/${PREFIX}/settings`).set('Cookie', ordinary.cookie).expect(200);

    expect(Object.keys((read.body as { flags: Record<string, boolean> }).flags)).not.toContain('professional');
  });

  it('is taken back by the owner, and access goes with it', async () => {
    const server = httpServer(app);

    await request(server).delete(`/${PREFIX}/admin/accounts/${granted.id}/professional`).set('Cookie', owner.cookie).expect(204);

    await expectOrdinary(granted);

    // Taking back what is not there is the same 404 as every other denial.
    await request(server).delete(`/${PREFIX}/admin/accounts/${granted.id}/professional`).set('Cookie', owner.cookie).expect(404);
  });
});
