import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { ProfessionalController } from 'core/controllers/Professional';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';
import { UserController } from 'core/controllers/User';

import { activate, completeOnboarding, createApp, deleteAccounts, httpServer, PREFIX, register, ScriptedAiClient } from './harness.js';

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
 * `GET /users/me`'s own `professional` field (`UsersService.me`) is the same
 * question asked once more, for the menu: on for an ordinary account never,
 * on for a grant only while the switch is too, off again on the very next
 * request once either is taken away. Forging it is tried the same way as the
 * rest — and checked the same way: nothing behind it moves.
 *
 * `ProfessionalController.hasAccess` — the guard's own question — is asked
 * directly throughout, as the fastest way to check the account's state; later
 * in the file it is also asked the long way, through `ProfessionalGuard` on a
 * real `/care` route, to prove the guard asks it too and nothing else.
 *
 * Requires a real database — see ./README.md.
 */
const PASSWORD = 'correct-horse-battery-staple-9';
const NUMBER = '28/12345';
const SMUGGLED = { collegiateNumber: NUMBER, isProfessional: true, professional: true, role: 'admin', tier: 'premium' };
/** The four verbs the sweep against `/care/*` needs; `delete` is a client route, never a professional one. */
type Method = 'get' | 'patch' | 'post';

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

  /** `GET /users/me`, read fresh — the field is asked on every request, never cached. */
  async function meBody(account: Account): Promise<{ professional: boolean; role: string }> {
    const me: Response = await request(httpServer(app)).get(`/${PREFIX}/users/me`).set('Cookie', account.cookie).expect(200);

    return me.body as { professional: boolean; role: string };
  }

  /**
   * The account is exactly what it was: not on the owner's list, no row behind
   * the guard even with the switch on, still an ordinary role and tier, still
   * saying so on its own `GET /users/me`, and still a stranger to `/admin`.
   */
  async function expectOrdinary(account: Account): Promise<void> {
    expect((await professionals()).some(row => row.userId === account.id)).toBe(false);
    await expect(ProfessionalController.find(account.id)).resolves.toBeNull();
    await expect(ProfessionalController.hasAccess(account.id)).resolves.toBe(false);
    expect(await accountRow(account.id)).toMatchObject({ role: 'user', tier: 'free' });
    expect(await meBody(account)).toMatchObject({ professional: false, role: 'user' });
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
    // The switch is on for the whole suite: granted, and the switch on, is `true`.
    expect(await meBody(granted)).toMatchObject({ professional: true });
  });

  it('is nobody while the switch is off, whatever the table says — on its own `GET /users/me` too, and whatever a body claims', async () => {
    const server = httpServer(app);

    await setSwitch(false);
    await expect(ProfessionalController.hasAccess(granted.id)).resolves.toBe(false);
    expect(await meBody(granted)).toMatchObject({ professional: false });
    // The guard asks ProfessionalController.hasAccess, never a client's own claim about itself —
    // a real grant, switch off, with the request itself insisting it is a professional.
    await request(server).get(`/${PREFIX}/care/clients`).set('Cookie', granted.cookie).send({ professional: true }).expect(404);
    await request(server).post(`/${PREFIX}/care/invitations`).set('Cookie', granted.cookie).send({ professional: true }).expect(404);

    await setSwitch(true);
    await expect(ProfessionalController.hasAccess(granted.id)).resolves.toBe(true);
    expect(await meBody(granted)).toMatchObject({ professional: true });
  });

  it('keeps the switch between the owner and the product', async () => {
    const read: Response = await request(httpServer(app)).get(`/${PREFIX}/settings`).set('Cookie', ordinary.cookie).expect(200);

    expect(Object.keys((read.body as { flags: Record<string, boolean> }).flags)).not.toContain('professional');
  });

  /**
   * The owner's explicit requirement: forging it gains nothing. Not `ordinary`
   * — the closest thing to a real account, confirmed and carried through
   * onboarding — tries every door once more with the switch on, then is
   * checked everywhere a professional would show up: its own `professional`
   * field, every route the professional side of care owns, `/admin`, and the
   * `professionals` table itself.
   *
   * The `/care/*` sweep is only the routes `ProfessionalGuard` covers
   * (`CareClientsController`, `CareInvitationsController`,
   * `CarePracticeController`) — the guard runs before any pipe, so a made-up
   * link, job or meal id is the same 404 as a real one that is not the
   * caller's, whatever the body. `CareAnswersController` (an invitation
   * addressed to somebody) and `CareLinksController` (a client's own link) are
   * deliberately not behind it — a client is not a professional, and
   * `care.e2e-spec.ts` is where that door is proved.
   */
  describe('an ordinary account gains nothing by forging it', () => {
    let tamperer: Account;

    beforeAll(async () => {
      tamperer = await register(app, `pro-tamper-${Date.now()}@e2e.invalid`);
      made.push(tamperer.cookie);
      await completeOnboarding(app, tamperer);
    });

    /*
     * Better Auth's `parseInputData` reads only its declared fields: `professional`
     * and `collegiateNumber` are unknown and dropped, leaving nothing to update
     * (400 "No fields to update"); `role` is declared `input: false` and is refused
     * by name (400 `FIELD_NOT_ALLOWED`). Confirmed against the running code
     * (Better Auth 1.7.5) rather than assumed, so the exact code is asserted here.
     */
    it('is unmoved by the account update, one smuggled field at a time', async () => {
      const server = httpServer(app);

      for (const body of [{ professional: true }, { role: 'admin' }, { collegiateNumber: 'MAD00123' }]) {
        await request(server).post(`/${PREFIX}/auth/update-user`).set('Cookie', tamperer.cookie).send(body).expect(400);
      }

      await expectOrdinary(tamperer);
    });

    it('is unmoved by every field at once, on the account update and every profile route', async () => {
      const server = httpServer(app);
      const smuggled = { professional: true, role: 'admin', tier: 'premium' };

      const updated: Response = await request(server)
        .post(`/${PREFIX}/auth/update-user`)
        .set('Cookie', tamperer.cookie)
        .send({ name: 'Still ordinary', ...smuggled });

      expect([200, 400]).toContain(updated.status);

      const attempts: readonly [string, Record<string, unknown>][] = [
        [`/${PREFIX}/profile`, { displayName: 'Still ordinary', ...smuggled }],
        [`/${PREFIX}/profile/goal`, { type: 'maintenance', ...smuggled }],
        [`/${PREFIX}/profile/targets`, { ...smuggled }],
        [`/${PREFIX}/profile/tour`, { seen: true, ...smuggled }],
        [`/${PREFIX}/profile/preferences`, { ...smuggled }]
      ];

      for (const [path, body] of attempts) {
        const response: Response = await request(server).patch(path).set('Cookie', tamperer.cookie).send(body);

        // A refusal of any kind is fine (clearing targets the account never set is a 404): what matters is that nothing moved.
        expect([200, 400, 404, 422]).toContain(response.status);
      }

      await expectOrdinary(tamperer);
    });

    it('cannot grant itself through the owner’s own route', async () => {
      await request(httpServer(app))
        .post(`/${PREFIX}/admin/accounts/${tamperer.id}/professional`)
        .set('Cookie', tamperer.cookie)
        .send({ collegiateNumber: NUMBER })
        .expect(404);

      await expectOrdinary(tamperer);
    });

    it('opens no route the professional side of care owns, no admin route, and no row in professionals', async () => {
      const server = httpServer(app);
      const linkId = 'not-a-link';
      const careRoutes: readonly [Method, string][] = [
        ['get', '/care/clients'],
        ['get', `/care/clients/${linkId}`],
        ['patch', `/care/clients/${linkId}/targets`],
        ['patch', `/care/clients/${linkId}`],
        ['get', `/care/clients/${linkId}/plan/pending`],
        ['post', `/care/clients/${linkId}/plan/generate`],
        ['get', `/care/clients/${linkId}/plan/jobs/not-a-job`],
        ['post', `/care/clients/${linkId}/plan/meals/not-a-meal/swap`],
        ['post', `/care/clients/${linkId}/plan/publish`],
        ['post', '/care/invitations'],
        ['get', '/care/practice']
      ];

      for (const [method, path] of careRoutes) {
        await request(server)[method](`/${PREFIX}${path}`).set('Cookie', tamperer.cookie).send({}).expect(404);
      }

      // /admin, from the outside: the account list and the professional list alike.
      await request(server).get(`/${PREFIX}/admin/accounts`).set('Cookie', tamperer.cookie).expect(404);
      await request(server).get(`/${PREFIX}/admin/professionals`).set('Cookie', tamperer.cookie).expect(404);

      // No row for this account — the direct read `care.e2e-spec.ts` and `billing.e2e-spec.ts` make.
      await expect(ProfessionalController.find(tamperer.id)).resolves.toBeNull();

      // And the field itself, once more, the same way any other caller would read it.
      expect(await meBody(tamperer)).toMatchObject({ professional: false, role: 'user' });
    });
  });

  /**
   * The professional's own agreement (P1-1, `docs/legal/checklist-activacion.md`
   * § 1): a grant alone does not open the workspace, whatever the switch says —
   * the one route it must still leave open is the page that shows the
   * agreement to accept, `GET /care/practice`, and accepting it is itself the
   * door: any version but the current `PROFESSIONAL_AGREEMENT_VERSION` is
   * refused and opens nothing, the current one does.
   */
  describe('the professional’s agreement', () => {
    let unaccepted: Account;

    beforeAll(async () => {
      unaccepted = await register(app, `pro-unaccepted-${Date.now()}@e2e.invalid`);
      made.push(unaccepted.cookie);
      await request(httpServer(app))
        .post(`/${PREFIX}/admin/accounts/${unaccepted.id}/professional`)
        .set('Cookie', owner.cookie)
        .send({ collegiateNumber: `28/${String(Date.now()).slice(-6)}` })
        .expect(201);
    });

    it('is a 404 on every professional route but the practice page, until the current agreement is accepted — any other version refused first', async () => {
      const server = httpServer(app);
      const linkId = 'not-a-link';
      const gatedRoutes: readonly [Method, string][] = [
        ['get', '/care/clients'],
        ['get', `/care/clients/${linkId}`],
        ['patch', `/care/clients/${linkId}`],
        ['patch', `/care/clients/${linkId}/targets`],
        ['get', `/care/clients/${linkId}/plan/pending`],
        ['post', `/care/clients/${linkId}/plan/generate`],
        ['get', `/care/clients/${linkId}/plan/jobs/not-a-job`],
        ['post', `/care/clients/${linkId}/plan/meals/not-a-meal/swap`],
        ['post', `/care/clients/${linkId}/plan/publish`],
        ['post', '/care/invitations']
      ];

      for (const [method, path] of gatedRoutes) {
        await request(server)[method](`/${PREFIX}${path}`).set('Cookie', unaccepted.cookie).send({}).expect(404);
      }

      // The one door that must stay open: the page that shows the agreement to accept — and it says so.
      const closed: Response = await request(server).get(`/${PREFIX}/care/practice`).set('Cookie', unaccepted.cookie).expect(200);

      expect(closed.body).toMatchObject({ agreementAcceptedAt: null, agreementRequired: true, agreementVersion: PROFESSIONAL_AGREEMENT_VERSION });

      // Nobody who was never granted opens it either, whatever the switch says — 404 before the body is even read.
      await request(server).post(`/${PREFIX}/care/practice/agreement`).set('Cookie', ordinary.cookie).send({}).expect(404);

      // Any version but the current one does not open it — and writes neither column.
      await request(server).post(`/${PREFIX}/care/practice/agreement`).set('Cookie', unaccepted.cookie).send({ version: '0.9.0' }).expect(422);
      await request(server).get(`/${PREFIX}/care/clients`).set('Cookie', unaccepted.cookie).expect(404);
      expect((await request(server).get(`/${PREFIX}/care/practice`).set('Cookie', unaccepted.cookie).expect(200)).body).toMatchObject({
        agreementAcceptedAt: null
      });

      // The current version does, on the very next request.
      await request(server)
        .post(`/${PREFIX}/care/practice/agreement`)
        .set('Cookie', unaccepted.cookie)
        .send({ version: PROFESSIONAL_AGREEMENT_VERSION })
        .expect(204);
      await request(server).get(`/${PREFIX}/care/clients`).set('Cookie', unaccepted.cookie).expect(200);

      const opened: Response = await request(server).get(`/${PREFIX}/care/practice`).set('Cookie', unaccepted.cookie).expect(200);
      const acceptedAt = (opened.body as { agreementAcceptedAt: string }).agreementAcceptedAt;

      expect(opened.body).toMatchObject({ agreementRequired: false, agreementVersion: PROFESSIONAL_AGREEMENT_VERSION });
      expect(Number.isNaN(Date.parse(acceptedAt))).toBe(false);

      // Accepting the same version again is not an error — it keeps the first date, which only `professionals` itself holds.
      await request(server)
        .post(`/${PREFIX}/care/practice/agreement`)
        .set('Cookie', unaccepted.cookie)
        .send({ version: PROFESSIONAL_AGREEMENT_VERSION })
        .expect(204);
      expect((await request(server).get(`/${PREFIX}/care/practice`).set('Cookie', unaccepted.cookie).expect(200)).body).toMatchObject({
        agreementAcceptedAt: acceptedAt
      });
    });
  });

  it('is taken back by the owner, and access goes with it', async () => {
    const server = httpServer(app);

    await request(server).delete(`/${PREFIX}/admin/accounts/${granted.id}/professional`).set('Cookie', owner.cookie).expect(204);

    await expectOrdinary(granted);
    // /care is shut on the very next request too, not eventually.
    await request(server).get(`/${PREFIX}/care/clients`).set('Cookie', granted.cookie).expect(404);

    // Taking back what is not there is the same 404 as every other denial.
    await request(server).delete(`/${PREFIX}/admin/accounts/${granted.id}/professional`).set('Cookie', owner.cookie).expect(404);
  });
});
