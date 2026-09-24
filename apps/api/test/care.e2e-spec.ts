import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { CARE_CONSENT_VERSION, CARE_HEALTH_SHARED, CARE_SHARED } from 'core/entities/Care';
import { CareController } from 'core/controllers/Care';
import { HEALTH_CONSENT_VERSION } from 'core/entities/Health';
import { NotFoundError } from 'core/entities/Error';
import { nudgedKcal } from 'core/controllers/CheckIn';
import { UserController } from 'core/controllers/User';
import { database } from 'database';

import { completeOnboarding, createApp, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';
import { EmailService } from '../src/modules/email/services/index.js';

import type { Account } from './harness.js';
import type { AcceptInvitation } from 'core/entities/Care';
import type { CareInvitationDetailView, CareLinkView, CareSession } from 'core/controllers/Care';
import type { CheckInResultView } from 'core/controllers/CheckIn';
import type { PlanView } from 'core/controllers/Plan';
import type { ProfessionalAccountView } from 'core/controllers/Professional';
import type { ResolvedTargets } from 'core/domain/Nutrition';
import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * The link between a professional and a client (`0059`, project 004 Phase 2;
 * PRD criteria 2, 3, 4 and 14).
 *
 * An invitation is single-use and expires, and its route answers the same
 * whether or not the address has an account; only the invited, confirmed
 * account can read or answer it; declining makes nothing; the accepted consent
 * version is stored; either side ends the link; and a deleted account takes
 * its link rows with it.
 *
 * The token travels only in the mail, so the suite reads it where a person
 * would — from the message — through a spy on the one door mail leaves by
 * (`EmailService.send`; nothing is sent). Expiry moves the clock by calling
 * `CareController` directly with a later `now`; the routes always pass none.
 *
 * An invitation row exists only while the invitation is live: accepting or
 * declining deletes it, inviting the same address again replaces it, writing
 * one deletes every expired one, and deleting the invited
 * account deletes every one addressed to it. "No row" is asserted on the
 * tables themselves (`care_links`, `care_invitations`), not only through
 * `GET /care/links/me`, which shows open links alone and so could not tell an
 * ended link from a deleted one.
 *
 * Every invitation route and the professional's side sit behind the
 * `professional` switch, failing off — a 404 before any body is read. A
 * client's own link stays theirs to see and to end with the switch off. On for
 * the suite, off again in `afterAll`, as in `professionals.e2e-spec.ts`.
 *
 * Phase 3 (PRD criteria 5, 6, 9, 12 and 14) is the last block: the
 * professional's list and one client's page, reached by link id alone, each
 * read counted in the client's trail (`care_access_log`) on the table and
 * through the client's own `GET /care/access-log`.
 *
 * Requires a real database — see ./README.md.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const PASSWORD = 'correct-horse-battery-staple-9';
const ACCEPT: AcceptInvitation = { consentVersion: CARE_CONSENT_VERSION, sharesHealth: false };
const NOBODYS_LINK = '00000000-0000-4000-8000-000000000000';

/** A `care_links` row, as the suite reads it to prove what is — and is not — stored. */
type LinkRow = {
  readonly id: string;
  readonly clientId: string;
  readonly consentVersion: string;
  readonly endedAt: Date | null;
  readonly endedBy: string | null;
  readonly professionalId: string;
  readonly sharesHealth: boolean;
  readonly status: string;
};

type Tables = <Row>(strings: TemplateStringsArray, ...values: readonly (number | string)[]) => Promise<Row[]>;

/**
 * Parameterised reads on the tables themselves, through the pool Drizzle
 * wraps (`$client`, the process's one pool). Drizzle's own builder cannot be
 * typed from here — its ESM and CommonJS declarations differ
 * (`apps/api/AGENTS.md`) — and a row that should be gone is only provably gone
 * when the table is asked, not a route that shows open links alone.
 */
function tables(): Tables {
  return (database() as unknown as { readonly $client: Tables }).$client;
}

describe('care', () => {
  let app: INestApplication;
  let sent: OutgoingEmail[];
  let stamp: number;
  let owner: Account;
  let pro: Account;
  let otherPro: Account;
  let client: Account;
  let stranger: Account;
  /** The second professional's invitation to `client`, refused with a 409 while the first link stands. */
  let waiting: string;
  /** Every session this suite opened, so `afterAll` can delete each account it made. */
  const made: string[] = [];

  function server() {
    return httpServer(app);
  }

  function address(name: string): string {
    return `care-${name}-${stamp}@e2e.invalid`;
  }

  async function account(name: string): Promise<Account> {
    const created = await register(app, address(name));

    made.push(created.cookie);

    return created;
  }

  function sessionOf(who: Pick<Account, 'email' | 'id'>, emailVerified = true): CareSession {
    return { id: who.id, email: who.email, emailVerified };
  }

  /** `register` names an account after its address; that name is what a client is shown. */
  function nameOf(who: Account): string {
    return who.email.split('@')[0] ?? '';
  }

  /** Every link row on either side of an account, whatever its status. */
  async function linkRows(userId: string): Promise<LinkRow[]> {
    return tables()<LinkRow>`
      select id, client_id as "clientId", professional_id as "professionalId", status::text as status,
             ended_by::text as "endedBy", ended_at as "endedAt", consent_version as "consentVersion", shares_health as "sharesHealth"
        from care_links
       where client_id = ${userId} or professional_id = ${userId}`;
  }

  /** The invitation rows addressed to `email`, from anybody. A row exists only while its invitation is live. */
  async function invitationsTo(email: string): Promise<{ id: string; professionalId: string }[]> {
    return tables()<{ id: string; professionalId: string }>`
      select id, professional_id as "professionalId" from care_invitations where email = ${email.toLowerCase()}`;
  }

  /** The invitation rows a professional sent. */
  async function invitationsFrom(professionalId: string): Promise<{ id: string }[]> {
    return tables()<{ id: string }>`select id from care_invitations where professional_id = ${professionalId}`;
  }

  async function setSwitch(enabled: boolean): Promise<void> {
    await request(server()).patch(`/${PREFIX}/admin/settings`).set('Cookie', owner.cookie).send({ enabled, flag: 'professional' }).expect(200);
  }

  async function grant(who: Account): Promise<void> {
    await request(server())
      .post(`/${PREFIX}/admin/accounts/${who.id}/professional`)
      .set('Cookie', owner.cookie)
      .send({ collegiateNumber: `28/${String(stamp).slice(-6)}` })
      .expect(201);
  }

  /** The token in the newest mail to `to`, waiting for the background task that sends it. */
  async function tokenMailedTo(to: string, after: number): Promise<string> {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const mail = sent
        .slice(after)
        .filter(message => message.to === to.toLowerCase())
        .at(-1);
      const token = mail?.text.match(/\/invitacion\/([A-Za-z0-9_-]{43})/)?.[1];

      if (token) {
        return token;
      }

      await new Promise(resolve => {
        setTimeout(resolve, 50);
      });
    }

    throw new Error('No invitation mail arrived');
  }

  /** Invites through the route, as the professional's screen does, and reads the token from the mail. */
  async function invite(from: Account, to: string): Promise<{ readonly response: Response; readonly token: string }> {
    const before = sent.length;
    const response = await request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', from.cookie).send({ email: to });

    expect(response.status).toBe(201);

    return { response, token: await tokenMailedTo(to, before) };
  }

  async function myLink(who: Account): Promise<CareLinkView | null> {
    const response: Response = await request(server()).get(`/${PREFIX}/care/links/me`).set('Cookie', who.cookie).expect(200);

    // A null answer arrives as an empty body, which supertest may hand over as `{}`, `''` or null.
    const body = response.body as '' | Partial<CareLinkView> | null;

    return body && typeof body === 'object' && 'id' in body ? (body as CareLinkView) : null;
  }

  async function accept(who: Account, token: string, body: object = ACCEPT): Promise<Response> {
    return request(server()).post(`/${PREFIX}/care/invitations/${token}/accept`).set('Cookie', who.cookie).send(body);
  }

  async function professionalRow(who: Account): Promise<ProfessionalAccountView | undefined> {
    const listed: Response = await request(server()).get(`/${PREFIX}/admin/professionals`).set('Cookie', owner.cookie).expect(200);

    return (listed.body as ProfessionalAccountView[]).find(row => row.userId === who.id);
  }

  beforeAll(async () => {
    // A pool, because two clients below have a plan made for them the way anybody does.
    app = await createApp(new ScriptedAiClient(POOL));
    stamp = Date.now();
    sent = [];

    // On the prototype, so whichever instance a module was handed is the one caught.
    jest.spyOn(EmailService.prototype, 'send').mockImplementation(async message => {
      sent.push(message);

      return true;
    });

    owner = await account('owner');
    pro = await account('pro');
    otherPro = await account('pro-b');
    client = await account('client');
    stranger = await account('stranger');
    await UserController.grantAdmin(owner.email);
    await setSwitch(true);
    await grant(pro);
    await grant(otherPro);
  });

  afterAll(async () => {
    try {
      // The switch fails off; leave it where it would be on a fresh database.
      if (owner) {
        await setSwitch(false);
      }

      // These accounts are this suite's own, and the database may outlive the run.
      // Deleting a professional takes their invitations with it — the ones to
      // addresses that never had an account included.
      for (const cookie of made) {
        await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', cookie);
      }

      if (stamp) {
        const suffix = `%-${stamp}@e2e.invalid`;
        const accounts = await tables()<{ id: string }>`select id from "user" where email like ${suffix}`;
        const invitations = await tables()<{ id: string }>`select id from care_invitations where email like ${suffix}`;
        // Every professional here is named after an address ending in the stamp, and so is every trail row they left.
        const trail = await tables()<{ id: string }>`select id from care_access_log where professional_name like ${`care-%-${stamp}`}`;

        if (accounts.length > 0 || invitations.length > 0 || trail.length > 0) {
          throw new Error(`care left ${accounts.length} account(s), ${invitations.length} invitation(s) and ${trail.length} trail row(s) behind`);
        }
      }
    } finally {
      jest.restoreAllMocks();
      await app?.close();
    }
  });

  describe('inviting', () => {
    it('answers a registered and an unregistered address with the same status and the same body', async () => {
      const unregisteredAddress = address('nobody');
      const registered = await invite(pro, client.email);
      const unregistered = await invite(pro, unregisteredAddress);

      // The address it was given back, and a date: nothing that depends on who holds the address.
      expect(registered.response.body).toEqual({ email: client.email, expiresAt: expect.any(String) });
      expect(unregistered.response.body).toEqual({ email: unregisteredAddress, expiresAt: expect.any(String) });

      // Both fourteen days out, whoever is behind the address.
      for (const { response } of [registered, unregistered]) {
        const days = (Date.parse((response.body as { expiresAt: string }).expiresAt) - Date.now()) / DAY_MS;

        expect(days).toBeGreaterThan(13.9);
        expect(days).toBeLessThanOrEqual(14);
      }

      // A mail went to both (`invite` waited for each), and the token is never in the answer.
      expect(JSON.stringify(registered.response.body)).not.toContain(registered.token);
      expect(JSON.stringify(unregistered.response.body)).not.toContain(unregistered.token);
    });

    it('lowercases the address it stores and mails', async () => {
      const shouted = `Care-Shout-${stamp}@E2E.invalid`;
      const before = sent.length;
      const response = await request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', pro.cookie).send({ email: shouted }).expect(201);

      expect((response.body as { email: string }).email).toBe(shouted.toLowerCase());
      await tokenMailedTo(shouted, before);
    });

    it('refuses the professional’s own address', async () => {
      const refused = await request(server())
        .post(`/${PREFIX}/care/invitations`)
        .set('Cookie', pro.cookie)
        .send({ email: pro.email.toUpperCase() })
        .expect(422);

      expect(refused.body).toMatchObject({ code: 'INVALID_INPUT', fieldErrors: { email: ['own_address'] } });
    });

    it('does not exist for an account that is not a professional, or for no session', async () => {
      const before = sent.length;

      await request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', client.cookie).send({ email: stranger.email }).expect(404);
      await request(server()).post(`/${PREFIX}/care/invitations`).send({ email: stranger.email }).expect(404);

      // Give a queued mail the time it would take; none was queued.
      await new Promise(resolve => {
        setTimeout(resolve, 300);
      });
      expect(sent.slice(before).filter(message => message.to === stranger.email)).toEqual([]);
    });
  });

  describe('reading and answering', () => {
    it('shows the invited account who invites, the version and what is shared — and nobody else', async () => {
      const { token } = await invite(pro, client.email);

      const read: Response = await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', client.cookie).expect(200);
      const detail = read.body as CareInvitationDetailView;

      expect(detail).toMatchObject({
        consentVersion: CARE_CONSENT_VERSION,
        healthShares: [...CARE_HEALTH_SHARED],
        professionalName: nameOf(pro),
        shares: [...CARE_SHARED]
      });
      expect(JSON.stringify(detail)).not.toContain(pro.id);
      expect(JSON.stringify(detail)).not.toContain(pro.email);

      // Another signed-in account, another professional, and the professional who sent it: one 404, and nothing spent.
      for (const other of [stranger, otherPro, pro]) {
        const denied: Response = await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', other.cookie).expect(404);

        expect(denied.body).toEqual({ code: 'NOT_FOUND', message: 'Invitation not found', statusCode: 404 });
        expect((await accept(other, token)).status).toBe(404);
        await request(server()).post(`/${PREFIX}/care/invitations/${token}/decline`).set('Cookie', other.cookie).expect(404);
        expect(await linkRows(other.id)).toEqual([]);
      }

      await request(server()).get(`/${PREFIX}/care/invitations/${token}`).expect(404);
      // Still the client's to answer: the refusals above were about who asked, not a spent token.
      await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', client.cookie).expect(200);
    });

    it('answers a token that is nobody’s with the same 404 as a malformed one', async () => {
      const unknown: Response = await request(server())
        .get(`/${PREFIX}/care/invitations/${'A'.repeat(43)}`)
        .set('Cookie', client.cookie)
        .expect(404);
      const malformed: Response = await request(server()).get(`/${PREFIX}/care/invitations/not-a-token`).set('Cookie', client.cookie).expect(404);

      expect(unknown.body).toEqual(malformed.body);
    });

    /*
     * Anybody can register an address they do not hold. Until it is confirmed,
     * the invitation to it is not theirs: the address lock answers first over
     * HTTP, and `CareController` refuses an unconfirmed session on its own in
     * case a route is ever opened to one. Confirming it then shows the same
     * invitation — so the refusal was about the address, not the token.
     */
    it('is not readable or answerable by an account whose address nobody confirmed', async () => {
      const email = address('unconfirmed');
      // Invited before the account exists: the address is all the professional has.
      const { token } = await invite(pro, email);

      await request(server()).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Unconfirmed', password: PASSWORD }).expect(200);
      await UserController.activate({ email });

      const signIn: Response = await request(server()).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: PASSWORD }).expect(200);
      const cookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');

      made.push(cookie);

      const me: Response = await request(server()).get(`/${PREFIX}/users/me`).set('Cookie', cookie).expect(200);
      const squatter = { id: (me.body as { id: string }).id, cookie, email };

      const read: Response = await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', cookie).expect(409);

      expect(read.body).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
      expect((await accept(squatter, token)).status).toBe(409);
      await expect(CareController.invitation(sessionOf(squatter, false), token)).rejects.toThrow(NotFoundError);
      await expect(CareController.accept(sessionOf(squatter, false), token, ACCEPT)).rejects.toThrow(NotFoundError);
      await expect(CareController.decline(sessionOf(squatter, false), token)).rejects.toThrow(NotFoundError);
      expect(await linkRows(squatter.id)).toEqual([]);

      await UserController.confirmAddress(email);

      await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', cookie).expect(200);
      await request(server()).post(`/${PREFIX}/care/invitations/${token}/decline`).set('Cookie', cookie).expect(204);
      expect(await invitationsTo(email)).toEqual([]);
    });

    it('expires after fourteen days', async () => {
      const { token } = await invite(pro, client.email);
      const later = (days: number): Date => new Date(Date.now() + days * DAY_MS);

      await expect(CareController.invitation(sessionOf(client), token, later(13))).resolves.toMatchObject({ consentVersion: CARE_CONSENT_VERSION });
      await expect(CareController.invitation(sessionOf(client), token, later(15))).rejects.toThrow(NotFoundError);
      await expect(CareController.accept(sessionOf(client), token, ACCEPT, later(15))).rejects.toThrow(NotFoundError);
      await expect(CareController.decline(sessionOf(client), token, later(15))).rejects.toThrow(NotFoundError);

      // Nothing was made by trying, and nothing was spent: today it is still open.
      expect(await linkRows(client.id)).toEqual([]);
      await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', client.cookie).expect(200);
    });

    it('is one per professional and address: the same invitation twice answers the same, and the newer replaces the older', async () => {
      const first = await invite(pro, stranger.email);
      const second = await invite(pro, stranger.email);
      const fromPro = async () => (await invitationsTo(stranger.email)).filter(row => row.professionalId === pro.id);

      expect(first.response.body).toEqual({ email: stranger.email, expiresAt: expect.any(String) });
      expect(second.response.body).toEqual({ email: stranger.email, expiresAt: expect.any(String) });
      expect(second.token).not.toBe(first.token);
      expect(await fromPro()).toHaveLength(1);

      // The older token is nobody's now, by every route.
      await request(server()).get(`/${PREFIX}/care/invitations/${first.token}`).set('Cookie', stranger.cookie).expect(404);
      expect((await accept(stranger, first.token)).status).toBe(404);
      await request(server()).post(`/${PREFIX}/care/invitations/${first.token}/decline`).set('Cookie', stranger.cookie).expect(404);

      await request(server()).get(`/${PREFIX}/care/invitations/${second.token}`).set('Cookie', stranger.cookie).expect(200);
      await request(server()).post(`/${PREFIX}/care/invitations/${second.token}/decline`).set('Cookie', stranger.cookie).expect(204);
      expect(await fromPro()).toEqual([]);
    });

    it('refuses an old consent version and a missing health answer, and makes nothing', async () => {
      const { token } = await invite(pro, client.email);

      expect((await accept(client, token, { consentVersion: '0.0.1', sharesHealth: false })).status).toBe(422);
      expect((await accept(client, token, { consentVersion: CARE_CONSENT_VERSION })).status).toBe(422);
      expect(await linkRows(client.id)).toEqual([]);
      // Refused at the door, not spent.
      await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', client.cookie).expect(200);
    });

    it('declining shares nothing, makes no link, and deletes the invitation', async () => {
      const { token } = await invite(pro, client.email);

      await request(server()).post(`/${PREFIX}/care/invitations/${token}/decline`).set('Cookie', client.cookie).expect(204);

      expect(await linkRows(client.id)).toEqual([]);
      // Only this professional has invited the client so far, and every re-invitation replaced the last.
      expect(await invitationsTo(client.email)).toEqual([]);
      await expect(myLink(client)).resolves.toBeNull();
      await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', client.cookie).expect(404);
      expect((await accept(client, token)).status).toBe(404);
      await request(server()).post(`/${PREFIX}/care/invitations/${token}/decline`).set('Cookie', client.cookie).expect(404);
      expect((await professionalRow(pro))?.links).toEqual({ active: 0, ended: 0, paused: 0 });
    });

    it('accepting stores the version and the health line, and works once', async () => {
      const { token } = await invite(pro, client.email);

      const accepted: Response = await accept(client, token, { consentVersion: CARE_CONSENT_VERSION, sharesHealth: true });

      expect(accepted.status).toBe(200);
      const link = accepted.body as CareLinkView;

      expect(link).toMatchObject({
        consentVersion: CARE_CONSENT_VERSION,
        professionalName: nameOf(pro),
        shares: [...CARE_SHARED, ...CARE_HEALTH_SHARED],
        sharesHealth: true,
        status: 'active'
      });
      expect(JSON.stringify(link)).not.toContain(pro.id);
      await expect(myLink(client)).resolves.toEqual(link);

      // Stored, not echoed: the row holds what the client agreed to, between these two accounts.
      const rows = await linkRows(client.id);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: link.id,
        clientId: client.id,
        consentVersion: CARE_CONSENT_VERSION,
        endedAt: null,
        professionalId: pro.id,
        sharesHealth: true,
        status: 'active'
      });

      // Spent: the row is gone, and the token with it.
      expect(await invitationsTo(client.email)).toEqual([]);
      expect((await accept(client, token)).status).toBe(404);
      await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', client.cookie).expect(404);
      await request(server()).post(`/${PREFIX}/care/invitations/${token}/decline`).set('Cookie', client.cookie).expect(404);
    });

    it('names the link already there, to the addressee alone, instead of making a second one', async () => {
      waiting = (await invite(otherPro, client.email)).token;

      // Somebody else holding the token never learns the client has a link.
      expect((await accept(stranger, waiting)).status).toBe(404);

      const refused = await accept(client, waiting);

      expect(refused.status).toBe(409);
      // Exhaustive, so adding a field to this answer is a decision: whose, where it stands, since when.
      expect(Object.keys(refused.body as object).sort()).toEqual(['code', 'link', 'message', 'statusCode']);
      expect(Object.keys((refused.body as { link: object }).link).sort()).toEqual(['professionalName', 'since', 'status']);
      expect(refused.body).toMatchObject({
        code: 'CARE_LINK_EXISTS',
        link: { professionalName: nameOf(pro), status: 'active' },
        message: 'Ya tienes un dietista vinculado.',
        statusCode: 409
      });
      expect(await linkRows(client.id)).toHaveLength(1);
      await expect(myLink(client)).resolves.toMatchObject({ professionalName: nameOf(pro) });
      // Still live: once the link in the way ends, it can be accepted (`ending`, below).
      expect((await invitationsTo(client.email)).map(row => row.professionalId)).toEqual([otherPro.id]);
      await request(server()).get(`/${PREFIX}/care/invitations/${waiting}`).set('Cookie', client.cookie).expect(200);
    });

    it('names the link already there when the same professional invites again, and keeps that invitation live', async () => {
      const { token } = await invite(pro, client.email);

      const refused = await accept(client, token);

      expect(refused.status).toBe(409);
      expect(refused.body).toMatchObject({ code: 'CARE_LINK_EXISTS', link: { professionalName: nameOf(pro), status: 'active' } });
      expect(await linkRows(client.id)).toHaveLength(1);
      expect((await invitationsTo(client.email)).filter(row => row.professionalId === pro.id)).toHaveLength(1);

      // Declined here so the counts below stay about links alone.
      await request(server()).post(`/${PREFIX}/care/invitations/${token}/decline`).set('Cookie', client.cookie).expect(204);
    });
  });

  describe('the owner’s list', () => {
    it('counts the links and carries no client’s address or id', async () => {
      expect((await professionalRow(pro))?.links).toEqual({ active: 1, ended: 0, paused: 0 });

      const listed: Response = await request(server()).get(`/${PREFIX}/admin/professionals`).set('Cookie', owner.cookie).expect(200);
      const body = JSON.stringify(listed.body);

      expect(body).not.toContain(client.email);
      expect(body).not.toContain(client.id);
    });
  });

  describe('ending', () => {
    it('is the professional’s, in one action, and nobody else’s', async () => {
      const second = await account('client-b');
      const { token } = await invite(pro, second.email);
      const accepted = await accept(second, token);

      expect(accepted.status).toBe(200);
      const link = accepted.body as CareLinkView;
      const clientsLink = await myLink(client);

      if (!clientsLink) {
        throw new Error('The client should be linked by now');
      }

      // Another professional, a stranger, and a client of the same professional on somebody else's link.
      await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', otherPro.cookie).expect(404);
      await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', stranger.cookie).expect(404);
      await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', client.cookie).expect(404);
      await request(server()).delete(`/${PREFIX}/care/links/${clientsLink.id}`).set('Cookie', second.cookie).expect(404);
      await expect(myLink(second)).resolves.toMatchObject({ id: link.id, status: 'active' });
      await expect(myLink(client)).resolves.toEqual(clientsLink);

      await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', pro.cookie).expect(204);

      await expect(myLink(second)).resolves.toBeNull();
      expect(await linkRows(second.id)).toEqual([expect.objectContaining({ id: link.id, endedBy: 'professional', status: 'ended' })]);
      await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', second.cookie).expect(404);
      await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', pro.cookie).expect(404);
    });

    it('is the client’s, in one action, and the link is ended for both sides', async () => {
      const link = await myLink(client);

      if (!link) {
        throw new Error('The client should be linked by now');
      }

      await request(server()).delete(`/${PREFIX}/care/links/${NOBODYS_LINK}`).set('Cookie', client.cookie).expect(404);
      // Not a link id at all: the same 404 as a link that is nobody's, not a 400 that says the shape was wrong.
      const malformed: Response = await request(server()).delete(`/${PREFIX}/care/links/not-a-link`).set('Cookie', client.cookie).expect(404);

      expect(malformed.body).toEqual({ code: 'NOT_FOUND', message: 'Link not found', statusCode: 404 });
      await expect(myLink(client)).resolves.toMatchObject({ id: link.id, status: 'active' });

      await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', client.cookie).expect(204);

      await expect(myLink(client)).resolves.toBeNull();
      expect((await linkRows(client.id)).find(row => row.id === link.id)).toMatchObject({ endedBy: 'client', status: 'ended' });
      await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', client.cookie).expect(404);
      await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', pro.cookie).expect(404);
      expect((await professionalRow(pro))?.links).toEqual({ active: 0, ended: 2, paused: 0 });
    });

    it('frees the client to accept the invitation that was waiting', async () => {
      const accepted = await accept(client, waiting);

      expect(accepted.status).toBe(200);
      expect(accepted.body).toMatchObject({ professionalName: nameOf(otherPro), status: 'active' });
    });
  });

  describe('a grant taken back', () => {
    it('closes the invitations it sent and its side of the link; the client keeps theirs', async () => {
      const revoked = await account('pro-revoked');
      const theirs = await account('client-c');

      await grant(revoked);
      const linked = await invite(revoked, theirs.email);
      const accepted = await accept(theirs, linked.token);

      expect(accepted.status).toBe(200);
      const link = accepted.body as CareLinkView;
      const open = await invite(revoked, stranger.email);

      await request(server()).delete(`/${PREFIX}/admin/accounts/${revoked.id}/professional`).set('Cookie', owner.cookie).expect(204);

      await expect(invitationsFrom(revoked.id)).resolves.toEqual([]);
      await request(server()).get(`/${PREFIX}/care/invitations/${open.token}`).set('Cookie', stranger.cookie).expect(404);
      expect((await accept(stranger, open.token)).status).toBe(404);
      await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', revoked.cookie).expect(404);
      await expect(myLink(theirs)).resolves.toMatchObject({ id: link.id, status: 'active' });

      await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', theirs.cookie).expect(204);
      await expect(myLink(theirs)).resolves.toBeNull();
    });
  });

  describe('two acceptances at once', () => {
    it('make one link and one 409', async () => {
      const racing = await account('client-race');
      const fromPro = await invite(pro, racing.email);
      const fromOther = await invite(otherPro, racing.email);

      const answers = await Promise.all([accept(racing, fromPro.token), accept(racing, fromOther.token)]);

      expect(answers.map(answer => answer.status).sort()).toEqual([200, 409]);
      expect(await linkRows(racing.id)).toEqual([expect.objectContaining({ status: 'active' })]);

      // The accepted invitation is gone; the refused one is still live, from the other professional.
      const winner = answers.findIndex(answer => answer.status === 200) === 0 ? pro : otherPro;
      const loser = winner === pro ? otherPro : pro;

      expect(await linkRows(racing.id)).toEqual([expect.objectContaining({ professionalId: winner.id })]);
      expect((await invitationsTo(racing.email)).map(row => row.professionalId)).toEqual([loser.id]);
    });
  });

  describe('expired invitations', () => {
    it('are deleted when anybody writes the next one, whoever sent them', async () => {
      const sweeper = await account('pro-sweep');
      const earlier = new Date(Date.now() - 15 * DAY_MS);

      await grant(sweeper);
      // Written fifteen days ago, by the clock the controller is handed: it expired yesterday.
      await CareController.invite({ id: sweeper.id, email: sweeper.email }, { email: address('stale') }, earlier);
      expect(await invitationsTo(address('stale'))).toHaveLength(1);

      // Another professional's invitation, today, clears it; a live one elsewhere is left alone.
      await invite(otherPro, address('fresh'));

      expect(await invitationsTo(address('stale'))).toEqual([]);
      expect(await invitationsTo(address('fresh'))).toEqual([expect.objectContaining({ professionalId: otherPro.id })]);
    });
  });

  describe('the switch', () => {
    it('hides every invitation route and the professional’s side while it is off; the client keeps their link', async () => {
      const { token } = await invite(pro, stranger.email);
      const link = await myLink(client);

      if (!link) {
        throw new Error('The client should be linked to the second professional by now');
      }

      await setSwitch(false);

      try {
        // Gone before any body is read: a malformed one is the same 404, not a 422.
        for (const body of [{ email: address('switched-off') }, {}, { email: 'not-an-address' }]) {
          await request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', pro.cookie).send(body).expect(404);
        }

        await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', stranger.cookie).expect(404);

        for (const body of [ACCEPT, {}, { consentVersion: '0.0.1' }]) {
          expect((await accept(stranger, token, body)).status).toBe(404);
        }

        const declined: Response = await request(server())
          .post(`/${PREFIX}/care/invitations/${token}/decline`)
          .set('Cookie', stranger.cookie)
          .expect(404);

        expect(declined.body).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
        // The professional's own link: their side is closed while the switch is.
        await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', otherPro.cookie).expect(404);
        await request(server()).delete(`/${PREFIX}/care/links/not-a-link`).set('Cookie', client.cookie).expect(404);

        // The client's own link stays theirs to see.
        await expect(myLink(client)).resolves.toEqual(link);
      } finally {
        await setSwitch(true);
      }

      // Nothing moved while it was off.
      await expect(myLink(client)).resolves.toEqual(link);
      await request(server()).get(`/${PREFIX}/care/invitations/${token}`).set('Cookie', stranger.cookie).expect(200);
    });

    it('still lets the client end their link while it is off', async () => {
      const link = await myLink(client);

      if (!link) {
        throw new Error('The client should be linked to the second professional by now');
      }

      await setSwitch(false);

      try {
        await request(server()).delete(`/${PREFIX}/care/links/${link.id}`).set('Cookie', client.cookie).expect(204);
        await expect(myLink(client)).resolves.toBeNull();
      } finally {
        await setSwitch(true);
      }

      expect((await linkRows(client.id)).find(row => row.id === link.id)).toMatchObject({ endedBy: 'client', status: 'ended' });
    });
  });

  describe('deleting an account', () => {
    it('takes the client’s link rows and the invitations to its address with it', async () => {
      const leaving = await account('client-gone');
      const { token } = await invite(otherPro, leaving.email);

      expect((await accept(leaving, token)).status).toBe(200);
      // Two more, from two professionals, left unanswered: an invitation to an address is about whoever holds it.
      await invite(pro, leaving.email);
      await invite(otherPro, leaving.email);
      expect(await linkRows(leaving.id)).toHaveLength(1);
      expect((await invitationsTo(leaving.email)).map(row => row.professionalId).sort()).toEqual([pro.id, otherPro.id].sort());

      await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', leaving.cookie).expect(204);

      // Gone, not ended: the rows went with the account.
      expect(await linkRows(leaving.id)).toEqual([]);
      expect(await invitationsTo(leaving.email)).toEqual([]);
      // And only those: the professional's other links are where they were.
      expect((await linkRows(otherPro.id)).some(row => row.clientId === client.id)).toBe(true);
    });

    it('takes the professional’s link rows and invitations with it and leaves the client’s account as it was', async () => {
      const leavingPro = await account('pro-gone');
      const kept = await account('client-kept');

      await grant(leavingPro);
      await request(server()).patch(`/${PREFIX}/profile`).set('Cookie', kept.cookie).send({ displayName: 'Kept' }).expect(200);

      const { token } = await invite(leavingPro, kept.email);

      expect((await accept(kept, token)).status).toBe(200);
      // One open, to an address with no account: an invitation that is nobody's link.
      await invite(leavingPro, address('never-joined'));
      expect(await linkRows(leavingPro.id)).toHaveLength(1);
      expect(await invitationsFrom(leavingPro.id)).toHaveLength(1);

      await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', leavingPro.cookie).expect(204);

      expect(await linkRows(leavingPro.id)).toEqual([]);
      expect(await linkRows(kept.id)).toEqual([]);
      expect(await invitationsFrom(leavingPro.id)).toEqual([]);
      await expect(myLink(kept)).resolves.toBeNull();
      await request(server()).get(`/${PREFIX}/users/me`).set('Cookie', kept.cookie).expect(200);
      const profile: Response = await request(server()).get(`/${PREFIX}/profile`).set('Cookie', kept.cookie).expect(200);

      expect(profile.body).toMatchObject({ profile: { displayName: 'Kept' } });
    });
  });

  /*
   * The professional's side (project 004 Phase 3; PRD criteria 5, 6, 9, 12 and 14).
   *
   * Every way a professional reaches a client is a link id, and every reach
   * leaves rows in the client's trail (`care_access_log`), which the suite
   * counts on the table itself and reads back through the client's own
   * `GET /care/access-log`. Counts are taken as a difference around each call,
   * so a test says exactly how many rows that one call wrote — never "some".
   *
   * The two professionals here are fresh, so nothing the blocks above did is
   * on their lists.
   */
  describe('a professional reading a client', () => {
    type TrailRow = {
      readonly id: string;
      readonly action: string;
      /** UTC, to the microsecond (`YYYY-MM-DDTHH:MM:SS.ffffffZ`): fixed width, so two compare as strings. */
      readonly createdAt: string;
      readonly kind: string;
      readonly professionalId: string | null;
      readonly professionalName: string;
    };
    type Entry = { readonly id: string; readonly action: string; readonly at: string; readonly kind: string; readonly professionalName: string };
    /** `next` is the id of the last entry when there are more, and the next page's `?before=`. */
    type Trail = { readonly entries: readonly Entry[]; readonly next: string | null };
    type ClientRow = {
      readonly linkId: string;
      readonly name: string;
      readonly reviewBeforePublish: boolean;
      readonly sharesHealth: boolean;
      readonly since: string;
      readonly stage: string | null;
      readonly status: string;
    };
    type Roster = { readonly clients: readonly ClientRow[]; readonly invitations: readonly { email: string; expiresAt: string }[] };
    type Overview = {
      readonly client: Omit<ClientRow, 'stage'>;
      readonly health?: { conditions: unknown[]; medications: { name: string }[]; supplements: unknown[] };
      readonly plan: { id: string } | null;
      readonly plans: readonly { id: string }[];
      readonly progress: unknown;
      readonly targets: unknown;
    };

    /** The 404 of every refusal past the door: the same body whatever the reason. */
    const NO_CLIENT = { code: 'NOT_FOUND', message: 'Client not found', statusCode: 404 };
    /**
     * The 404 of the door itself (`ProfessionalGuard`): what an account that was
     * never a professional gets, and so what a revoked one and a switched-off
     * one must get too.
     */
    const NO_DOOR = { code: 'NOT_FOUND', message: 'Not Found', statusCode: 404 };
    const MEDICATION = 'Levotiroxina de prueba';

    let readerA: Account;
    let readerB: Account;
    /** A's clients, one per place a client can be. */
    let onboarding: Account;
    let awaiting: Account;
    let underWay: Account;
    let due: Account;
    let paused: Account;
    let ended: Account;
    /** B's one client. */
    let theirs: Account;
    /** An address A invited that has no account. */
    let invited: string;
    const links: Record<string, string> = {};

    /** The client's trail as stored, oldest first. */
    async function trail(clientId: string): Promise<TrailRow[]> {
      return tables()<TrailRow>`
        select id, action::text as action, kind::text as kind, professional_id as "professionalId",
               professional_name as "professionalName",
               to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt"
          from care_access_log
         where user_id = ${clientId}
         order by created_at, id`;
    }

    /** How many trail rows each account has now, keyed by account id. */
    async function counts(who: readonly Account[]): Promise<Record<string, number>> {
      const entries = await Promise.all(who.map(async account => [account.id, (await trail(account.id)).length] as const));

      return Object.fromEntries(entries);
    }

    /** Links `client` to `professional` through the routes, as the two people do. */
    async function link(professional: Account, client: Account, sharesHealth = false): Promise<string> {
      const { token } = await invite(professional, client.email);
      const accepted = await accept(client, token, { consentVersion: CARE_CONSENT_VERSION, sharesHealth });

      expect(accepted.status).toBe(200);

      return (accepted.body as CareLinkView).id;
    }

    async function roster(professional: Account): Promise<Roster> {
      const response: Response = await request(server()).get(`/${PREFIX}/care/clients`).set('Cookie', professional.cookie).expect(200);

      return response.body as Roster;
    }

    /** Not awaited here, so a caller may chain `.expect(200)` on it. */
    function overview(professional: Account, linkId: string) {
      return request(server()).get(`/${PREFIX}/care/clients/${linkId}`).set('Cookie', professional.cookie);
    }

    /** The trail's page before the row `before` names — the first page without it. */
    function accessLogPage(who: Account, before?: string) {
      return request(server())
        .get(`/${PREFIX}/care/access-log`)
        .query(before === undefined ? {} : { before })
        .set('Cookie', who.cookie);
    }

    async function accessLog(who: Account, before?: string): Promise<Trail> {
      const response: Response = await accessLogPage(who, before).expect(200);

      return response.body as Trail;
    }

    /** Every page of the client's trail, following `next` until there is none. */
    async function wholeTrail(who: Account): Promise<{ readonly entries: Entry[]; readonly pages: number[] }> {
      const entries: Entry[] = [];
      const pages: number[] = [];
      let cursor: string | undefined;

      do {
        const page = await accessLog(who, cursor);

        entries.push(...page.entries);
        pages.push(page.entries.length);
        cursor = page.next ?? undefined;
      } while (cursor && pages.length < 20);

      return { entries, pages };
    }

    beforeAll(async () => {
      readerA = await account('reader-a');
      readerB = await account('reader-b');
      await grant(readerA);
      await grant(readerB);

      onboarding = await account('reader-onboarding');
      awaiting = await account('reader-awaiting');
      underWay = await account('reader-under-way');
      due = await account('reader-due');
      paused = await account('reader-paused');
      ended = await account('reader-ended');
      theirs = await account('reader-theirs');

      // Where each one is, made the way a person gets there.
      await completeOnboarding(app, awaiting);
      await completeOnboarding(app, underWay);
      await completeOnboarding(app, due);

      for (const who of [underWay, due]) {
        await expect(generateAndWait(app, who)).resolves.toMatchObject({ status: 'succeeded' });
      }

      // The fortnight ended yesterday, UTC — the rule the list reads is `today >= endDate`, and nobody answered it.
      const yesterday = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);

      await tables()`update meal_plans set end_date = ${yesterday} where user_id = ${due.id}`;

      // Recorded by the client, under the health consent, before any link exists.
      await request(server())
        .put(`/${PREFIX}/health-data`)
        .set('Cookie', underWay.cookie)
        .send({
          conditions: [{ conditionKey: 'hypothyroidism', label: 'Hipotiroidismo' }],
          consentVersion: HEALTH_CONSENT_VERSION,
          medications: [{ name: MEDICATION }],
          supplements: []
        })
        .expect(200);

      links.onboarding = await link(readerA, onboarding);
      links.awaiting = await link(readerA, awaiting);
      links.underWay = await link(readerA, underWay, true);
      links.due = await link(readerA, due);
      links.paused = await link(readerA, paused);
      links.ended = await link(readerA, ended);
      links.theirs = await link(readerB, theirs);

      await tables()`update care_links set status = 'paused' where id = ${links.paused}`;
      await request(server()).delete(`/${PREFIX}/care/links/${links.ended}`).set('Cookie', ended.cookie).expect(204);

      invited = address('reader-invited');
      await invite(readerA, invited);
    });

    describe('the list', () => {
      it('shows each open link by name with where the client is, and the invitations unanswered', async () => {
        const listed = await roster(readerA);

        // Exhaustive, so a field added to either is a decision.
        expect(Object.keys(listed).sort()).toEqual(['clients', 'invitations']);

        for (const row of listed.clients) {
          expect(Object.keys(row).sort()).toEqual(['linkId', 'name', 'reviewBeforePublish', 'sharesHealth', 'since', 'stage', 'status']);
          expect(Number.isNaN(Date.parse(row.since))).toBe(false);
        }

        // By name, the ended link absent; a paused one shown, with nothing read about where its client is.
        expect(listed.clients.map(row => row.linkId)).toEqual([links.awaiting, links.due, links.onboarding, links.paused, links.underWay]);
        expect(listed.clients.map(row => [row.name, row.status, row.stage])).toEqual([
          [nameOf(awaiting), 'active', 'awaiting_plan'],
          [nameOf(due), 'active', 'check_in_due'],
          [nameOf(onboarding), 'active', 'onboarding'],
          [nameOf(paused), 'paused', null],
          [nameOf(underWay), 'active', 'plan_under_way']
        ]);
        // Review is on unless somebody turned it off (`care_links` default); nobody here did.
        expect(listed.clients.find(row => row.linkId === links.underWay)).toMatchObject({ reviewBeforePublish: true, sharesHealth: true });
        expect(listed.clients.find(row => row.linkId === links.awaiting)).toMatchObject({ sharesHealth: false });
        expect(listed.invitations).toEqual([{ email: invited, expiresAt: expect.any(String) }]);
      });

      it('leaves one `list` row in the trail of each client whose place it shows, and none for a paused or ended link', async () => {
        const shown = [onboarding, awaiting, underWay, due];
        const before = await counts([...shown, paused, ended, theirs]);

        await roster(readerA);

        const after = await counts([...shown, paused, ended, theirs]);

        for (const who of shown) {
          expect(after[who.id]).toBe((before[who.id] ?? 0) + 1);
          expect((await trail(who.id)).at(-1)).toMatchObject({
            action: 'read',
            kind: 'list',
            professionalId: readerA.id,
            professionalName: nameOf(readerA)
          });
        }

        // Paused: access is closed, so nothing was read. Ended: not on the list. B's client: not A's.
        for (const who of [paused, ended, theirs]) {
          expect(after[who.id]).toBe(before[who.id]);
        }
      });

      it('carries no client’s account id or address', async () => {
        const body = JSON.stringify(await roster(readerA));

        for (const who of [onboarding, awaiting, underWay, due, paused, ended]) {
          expect(body).not.toContain(who.id);
          expect(body).not.toContain(who.email);
        }
      });
    });

    describe('one client’s page', () => {
      it('writes exactly one row per read, and the client reads the same rows in their trail', async () => {
        const before = await trail(awaiting.id);

        const first = await overview(readerA, links.awaiting ?? '');

        expect(first.status).toBe(200);
        expect(await trail(awaiting.id)).toHaveLength(before.length + 1);

        await overview(readerA, links.awaiting ?? '').expect(200);

        const after = await trail(awaiting.id);

        expect(after).toHaveLength(before.length + 2);

        for (const row of after.slice(before.length)) {
          expect(row).toMatchObject({ action: 'read', kind: 'overview', professionalId: readerA.id, professionalName: nameOf(readerA) });
        }

        // The same rows through the client's own door, newest first, and nothing that names the professional's account.
        const read = await accessLog(awaiting);

        expect(Object.keys(read).sort()).toEqual(['entries', 'next']);
        expect(read.next).toBeNull();
        expect(read.entries.map(entry => entry.id)).toEqual([...after].reverse().map(row => row.id));

        for (const entry of read.entries) {
          expect(Object.keys(entry).sort()).toEqual(['action', 'at', 'id', 'kind', 'professionalName']);
        }

        expect(read.entries[0]).toMatchObject({ action: 'read', kind: 'overview', professionalName: nameOf(readerA) });
        // The stored instant, to the millisecond an ISO string carries.
        expect(read.entries[0]?.at).toBe(`${after.at(-1)?.createdAt.slice(0, 23)}Z`);
        expect(JSON.stringify(read)).not.toContain(readerA.id);
      });

      it('shows each client their own trail and nobody else’s', async () => {
        await overview(readerA, links.onboarding ?? '').expect(200);

        const mine = (await accessLog(onboarding)).entries.map(entry => entry.id);
        const theirsToo = (await accessLog(awaiting)).entries.map(entry => entry.id);
        const stored = (await trail(onboarding.id)).map(row => row.id);

        expect(mine.length).toBeGreaterThan(0);
        expect([...mine].sort()).toEqual([...stored].sort());
        expect(mine.filter(id => theirsToo.includes(id))).toEqual([]);

        // The professional was never read: their own trail is empty, not their clients'.
        await expect(accessLog(readerA)).resolves.toEqual({ entries: [], next: null });
      });

      it('has no `health` key without the health line, and a health read under it is refused and leaves nothing', async () => {
        const before = (await trail(awaiting.id)).length;
        const read = await overview(readerA, links.awaiting ?? '').expect(200);
        const page = read.body as Overview;

        expect(page).not.toHaveProperty('health');
        expect(Object.keys(page).sort()).toEqual(['client', 'plan', 'plans', 'progress', 'targets']);
        expect(page.client).toEqual({
          linkId: links.awaiting,
          name: nameOf(awaiting),
          reviewBeforePublish: true,
          sharesHealth: false,
          since: expect.any(String),
          status: 'active'
        });
        expect(JSON.stringify(page)).not.toContain(MEDICATION);
        expect((await trail(awaiting.id)).slice(before).map(row => row.kind)).toEqual(['overview']);

        // Asked directly, the way a future route would: the link does not carry the line, so there is no such read.
        const reached = jest.fn(async () => Promise.resolve('read'));

        await expect(CareController.withClient(readerA.id, links.awaiting ?? '', 'health', 'read', reached)).rejects.toThrow(NotFoundError);
        expect(reached).not.toHaveBeenCalled();
        expect(await trail(awaiting.id)).toHaveLength(before + 1);
      });

      it('with the health line, shows what the client recorded and leaves an `overview` row and then a `health` row', async () => {
        const before = (await trail(underWay.id)).length;
        const read = await overview(readerA, links.underWay ?? '').expect(200);
        const page = read.body as Overview;

        expect(page).toHaveProperty('health');
        expect(Object.keys(page.health ?? {}).sort()).toEqual(['conditions', 'medications', 'supplements']);
        expect(page.health?.medications.map(medication => medication.name)).toEqual([MEDICATION]);
        expect(page.health?.conditions).toEqual([expect.objectContaining({ conditionKey: 'hypothyroidism', label: 'Hipotiroidismo' })]);
        expect(page.client).toMatchObject({ linkId: links.underWay, sharesHealth: true, status: 'active' });
        // The plan under way and its history: the plan the client has, read through the link.
        expect(page.plan).not.toBeNull();
        expect(page.plans.map(plan => plan.id)).toContain(page.plan?.id);

        const written = (await trail(underWay.id)).slice(before);

        expect(written.map(row => [row.kind, row.action])).toEqual([
          ['overview', 'read'],
          ['health', 'read']
        ]);
        // Overview first, then health — not merely both, in either order.
        expect((written[0]?.createdAt ?? '') <= (written[1]?.createdAt ?? '')).toBe(true);
      });

      it('carries no client’s account id or address, for any client', async () => {
        for (const [key, who] of [
          ['onboarding', onboarding],
          ['awaiting', awaiting],
          ['underWay', underWay],
          ['due', due]
        ] as const) {
          const body = JSON.stringify((await overview(readerA, links[key] ?? '').expect(200)).body);

          expect(body).not.toContain(who.id);
          expect(body).not.toContain(who.email);
        }
      });

      it('refuses a paused link, an ended one, an unknown id and anything that is not an id with one 404 that writes nothing', async () => {
        const before = await counts([paused, ended, awaiting]);

        for (const linkId of [links.paused, links.ended, NOBODYS_LINK, 'not-a-link', awaiting.id]) {
          const refused = await overview(readerA, linkId ?? '');

          expect(refused.status).toBe(404);
          expect(refused.body).toEqual(NO_CLIENT);
        }

        expect(await counts([paused, ended, awaiting])).toEqual(before);
      });

      it('does not exist for an account that is not a professional, or for no session', async () => {
        const before = await counts([awaiting]);

        for (const path of ['/care/clients', `/care/clients/${links.awaiting}`]) {
          const asClient: Response = await request(server()).get(`/${PREFIX}${path}`).set('Cookie', awaiting.cookie).expect(404);

          expect(asClient.body).toEqual(NO_DOOR);
          await request(server()).get(`/${PREFIX}${path}`).expect(404);
        }

        await request(server()).get(`/${PREFIX}/care/access-log`).expect(404);

        expect(await counts([awaiting])).toEqual(before);
      });
    });

    describe('another professional', () => {
      it('cannot list, read or infer A’s clients — by link id, by guessing, or by the invitation route', async () => {
        const mine = [onboarding, awaiting, underWay, due, paused, ended];
        const before = await counts(mine);

        // The list: B's client alone, and nothing of A's in it.
        const listed = await roster(readerB);
        const body = JSON.stringify(listed);

        expect(listed.clients.map(row => row.linkId)).toEqual([links.theirs]);

        for (const who of mine) {
          expect(body).not.toContain(nameOf(who));
          expect(body).not.toContain(who.id);
          expect(body).not.toContain(who.email);
        }

        for (const linkId of Object.values(links).filter(id => id !== links.theirs)) {
          expect(body).not.toContain(linkId);
        }

        // Every one of A's link ids answers B exactly as an id nobody holds, and as something that is not an id.
        const unknown: Response = await overview(readerB, NOBODYS_LINK);
        const malformed: Response = await overview(readerB, 'not-a-link');

        expect(unknown.status).toBe(404);
        expect(unknown.body).toEqual(NO_CLIENT);
        expect(malformed.status).toBe(404);
        expect(malformed.body).toEqual(NO_CLIENT);

        for (const linkId of Object.values(links).filter(id => id !== links.theirs)) {
          const refused = await overview(readerB, linkId);

          expect(refused.status).toBe(404);
          expect(refused.body).toEqual(unknown.body);
        }

        // And nothing was written about anybody by trying.
        expect(await counts(mine)).toEqual(before);

        // Inviting A's client answers exactly as inviting an address nobody holds.
        const linkedElsewhere = await request(server())
          .post(`/${PREFIX}/care/invitations`)
          .set('Cookie', readerB.cookie)
          .send({ email: awaiting.email });
        const nobody = address('reader-nobody');
        const unregistered = await request(server()).post(`/${PREFIX}/care/invitations`).set('Cookie', readerB.cookie).send({ email: nobody });

        expect(linkedElsewhere.status).toBe(unregistered.status);
        expect(linkedElsewhere.body).toEqual({ email: awaiting.email, expiresAt: expect.any(String) });
        expect(unregistered.body).toEqual({ email: nobody, expiresAt: expect.any(String) });

        // On B's list the two are the same kind of line, and A's client is still not a client of B's.
        const after = await roster(readerB);

        expect(after.clients.map(row => row.linkId)).toEqual([links.theirs]);
        expect(after.invitations.map(invitation => Object.keys(invitation).sort())).toEqual([
          ['email', 'expiresAt'],
          ['email', 'expiresAt']
        ]);
        expect(await counts(mine)).toEqual(before);
      });

      it('is refused symmetrically: A cannot read B’s client', async () => {
        const before = await counts([theirs]);
        const refused = await overview(readerA, links.theirs ?? '');

        expect(refused.status).toBe(404);
        expect(refused.body).toEqual(NO_CLIENT);
        expect(await counts([theirs])).toEqual(before);
      });
    });

    describe('access that closes', () => {
      it('ends mid-session: the professional’s very next request after the client ends the link is a 404', async () => {
        await overview(readerA, links.due ?? '').expect(200);

        const rows = (await trail(due.id)).length;

        await request(server()).delete(`/${PREFIX}/care/links/${links.due}`).set('Cookie', due.cookie).expect(204);

        const next = await overview(readerA, links.due ?? '');

        expect(next.status).toBe(404);
        expect(next.body).toEqual(NO_CLIENT);
        expect(await trail(due.id)).toHaveLength(rows);

        // Gone from the list too, and the list wrote nothing about them.
        expect((await roster(readerA)).clients.map(row => row.linkId)).not.toContain(links.due);
        expect(await trail(due.id)).toHaveLength(rows);
      });

      it('closes while the switch is off, and the client still reads their trail', async () => {
        const before = await counts([awaiting]);
        const trailBefore = await accessLog(awaiting);

        await setSwitch(false);

        try {
          const listed: Response = await request(server()).get(`/${PREFIX}/care/clients`).set('Cookie', readerA.cookie).expect(404);
          const refused = await overview(readerA, links.awaiting ?? '');

          expect(listed.body).toEqual(NO_DOOR);
          expect(refused.status).toBe(404);
          expect(refused.body).toEqual(NO_DOOR);
          // The core read asks the switch too, for any caller that is not a route.
          await expect(
            CareController.withClient(readerA.id, links.awaiting ?? '', 'overview', 'read', async () => Promise.resolve(0))
          ).rejects.toThrow(NotFoundError);
          await expect(accessLog(awaiting)).resolves.toEqual(trailBefore);
        } finally {
          await setSwitch(true);
        }

        expect(await counts([awaiting])).toEqual(before);
      });

      it('closes when the grant is taken back while the link is active', async () => {
        const revoked = await account('reader-revoked');
        const client = await account('reader-revoked-client');

        await grant(revoked);
        const linkId = await link(revoked, client);

        await overview(revoked, linkId).expect(200);
        const rows = (await trail(client.id)).length;

        await request(server()).delete(`/${PREFIX}/admin/accounts/${revoked.id}/professional`).set('Cookie', owner.cookie).expect(204);

        const refused = await overview(revoked, linkId);

        // At the door, as for an account that never was a professional.
        expect(refused.status).toBe(404);
        expect(refused.body).toEqual(NO_DOOR);
        const listed: Response = await request(server()).get(`/${PREFIX}/care/clients`).set('Cookie', revoked.cookie).expect(404);

        expect(listed.body).toEqual(NO_DOOR);
        // And behind it: the core read refuses the link on its own, for any caller that is not a route.
        const reached = jest.fn(async () => Promise.resolve('read'));

        await expect(CareController.withClient(revoked.id, linkId, 'overview', 'read', reached)).rejects.toThrow(NotFoundError);
        expect(reached).not.toHaveBeenCalled();
        expect(await trail(client.id)).toHaveLength(rows);
        // The link itself is still the client's.
        await expect(myLink(client)).resolves.toMatchObject({ id: linkId, status: 'active' });
      });
    });

    /*
     * `CareController.activeProfessional` end to end (project 004 Phase 6; PRD
     * criterion 10) — who a client's check-in notice goes to. Exercised by
     * calling core directly against the real database, the way
     * `reminders.e2e-spec.ts` exercises `NotificationController.checkInDue`:
     * the e2e environment never configures mail or push (see ./README.md), so
     * `CheckInSubmittedService.notify` no-ops at its first line and never
     * writes a `notifications` row the HTTP surface could observe. This is
     * where the eligibility itself — the real link and grant rows — is
     * checked instead.
     */
    describe('CareController.activeProfessional', () => {
      it('finds the professional of an active link, by id and address', async () => {
        await expect(CareController.activeProfessional(underWay.id)).resolves.toEqual({ id: readerA.id, email: readerA.email });
      });

      it('is null for a paused link', async () => {
        await expect(CareController.activeProfessional(paused.id)).resolves.toBeNull();
      });

      it('is null for an ended link', async () => {
        await expect(CareController.activeProfessional(ended.id)).resolves.toBeNull();
      });

      it('is null with no link at all', async () => {
        const alone = await account('checkin-no-link');

        await expect(CareController.activeProfessional(alone.id)).resolves.toBeNull();
      });

      it('is null once the professional’s grant is revoked, even though the link row stays active', async () => {
        const revokedPro = await account('checkin-pro-revoked');
        const revokedClient = await account('checkin-pro-revoked-client');

        await grant(revokedPro);
        const linkId = await link(revokedPro, revokedClient);

        await expect(CareController.activeProfessional(revokedClient.id)).resolves.toEqual({ id: revokedPro.id, email: revokedPro.email });

        await request(server()).delete(`/${PREFIX}/admin/accounts/${revokedPro.id}/professional`).set('Cookie', owner.cookie).expect(204);

        // At the door, as `access that closes` proves for the HTTP route — the link row is untouched.
        await expect(CareController.activeProfessional(revokedClient.id)).resolves.toBeNull();
        await expect(myLink(revokedClient)).resolves.toMatchObject({ id: linkId, status: 'active' });
      });
    });

    describe('the client’s trail, paged', () => {
      it('comes newest first, a hundred at a time, every row exactly once — rows a microsecond apart included', async () => {
        const client = await account('reader-paged');

        // 230 rows in threes at one instant, each three seven microseconds before the last: many share a
        // millisecond and some share the microsecond, so a cursor that kept only milliseconds, or ignored
        // the id that breaks a tie, would drop or repeat rows at a page boundary.
        await tables()`
          insert into care_access_log (user_id, action, kind, professional_id, professional_name, created_at)
          select ${client.id}, 'read'::care_access_action, 'plan'::care_access_kind, null, ${`care-paging-${stamp}`},
                 now() - (n / 3) * interval '7 microseconds'
            from generate_series(1, 230) as n`;

        const stored = await trail(client.id);
        const { entries, pages } = await wholeTrail(client);

        expect(stored).toHaveLength(230);
        expect(new Set(stored.map(row => row.createdAt)).size).toBeLessThan(230);
        expect(pages).toEqual([100, 100, 30]);
        expect(entries.map(entry => entry.id)).toEqual([...stored].reverse().map(row => row.id));

        // `next` is the last entry of its page, and null on the last one.
        const first = await accessLog(client);

        expect(first.next).toBe(first.entries.at(-1)?.id);
        expect((await accessLog(client, entries.at(200)?.id)).next).toBeNull();
      });

      it('is a position in the session’s own trail: another client’s row id reads nothing, and a non-id is refused', async () => {
        const somebodyElses = (await trail(awaiting.id)).at(-1)?.id;
        const before = await counts([onboarding]);

        expect(somebodyElses).toBeDefined();
        await expect(accessLog(onboarding, somebodyElses)).resolves.toEqual({ entries: [], next: null });
        // The owner of that row, following it, reads their own older rows — so it was a real position, just not theirs.
        const own = await accessLog(awaiting, somebodyElses);
        const theirsStored = (await trail(awaiting.id)).map(row => row.id);

        for (const entry of own.entries) {
          expect(theirsStored).toContain(entry.id);
        }

        // `InputParseError`, which this API answers with 422 everywhere.
        const malformed: Response = await accessLogPage(onboarding, 'not-a-row').expect(422);

        expect(malformed.body).toMatchObject({ code: 'INVALID_INPUT', fieldErrors: { before: ['invalid'] } });
        expect(await counts([onboarding])).toEqual(before);
      });
    });

    describe('deleting an account (PRD 14)', () => {
      it('deleting the professional keeps the client’s trail, with the name they had and no account behind it', async () => {
        const leaving = await account('reader-leaving');
        const client = await account('reader-stays');

        await grant(leaving);
        const linkId = await link(leaving, client);

        await roster(leaving);
        await overview(leaving, linkId).expect(200);
        const before = await trail(client.id);

        expect(before.map(row => row.kind)).toEqual(['list', 'overview']);
        expect(before.every(row => row.professionalId === leaving.id)).toBe(true);

        await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', leaving.cookie).expect(204);

        const after = await trail(client.id);

        expect(after.map(row => row.id)).toEqual(before.map(row => row.id));
        expect(after.every(row => row.professionalId === null && row.professionalName === nameOf(leaving))).toBe(true);
        expect((await accessLog(client)).entries.map(entry => [entry.kind, entry.professionalName])).toEqual([
          ['overview', nameOf(leaving)],
          ['list', nameOf(leaving)]
        ]);
      });

      it('deleting the client takes their trail with it', async () => {
        const leaving = await account('reader-client-gone');
        const linkId = await link(readerA, leaving);

        await overview(readerA, linkId).expect(200);
        expect(await trail(leaving.id)).toHaveLength(1);

        await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', leaving.cookie).expect(204);

        expect(await trail(leaving.id)).toEqual([]);
        // And only theirs: another client of the same professional keeps every row.
        expect((await trail(awaiting.id)).length).toBeGreaterThan(0);
      });
    });

    /*
     * Supervised targets (project 004 Phase 4; PRD criterion 7).
     *
     * The professional sets a client's targets through the link, with the
     * client's own body, bounds and refusal. The answer — and every screen that
     * shows the targets — says who set them by name (`setBy`), never by account
     * id; the client changing them afterwards makes them theirs again; and a
     * professional who deletes their account leaves the targets standing as the
     * client's own. Every write is one `targets`/`write` row in the client's
     * trail, and every refusal at the link writes nothing, on either table.
     *
     * Fresh accounts: the professionals and clients above carry state this
     * block would otherwise have to reason around.
     */
    describe('a professional setting a client’s targets', () => {
      type OverrideRow = {
        readonly carbsG: number | null;
        readonly fatG: number | null;
        readonly kcal: number | null;
        readonly proteinG: number | null;
        readonly setByProfessionalId: string | null;
      };

      let setter: Account;
      let otherSetter: Account;
      let supervised: Account;
      let otherClient: Account;
      let endedClient: Account;
      let pausedClient: Account;
      /** The supervised client's targets before anybody corrected them. */
      let computed: ResolvedTargets;
      const targetLinks: Record<'ended' | 'other' | 'paused' | 'supervised', string> = { ended: '', other: '', paused: '', supervised: '' };

      function setTargets(professional: Account, linkId: string, body: object) {
        return request(server()).patch(`/${PREFIX}/care/clients/${linkId}/targets`).set('Cookie', professional.cookie).send(body);
      }

      function setOwnTargets(who: Account, body: object) {
        return request(server()).patch(`/${PREFIX}/profile/targets`).set('Cookie', who.cookie).send(body);
      }

      async function ownTargets(who: Account): Promise<ResolvedTargets> {
        const response: Response = await request(server()).get(`/${PREFIX}/profile`).set('Cookie', who.cookie).expect(200);

        return (response.body as { targets: ResolvedTargets }).targets;
      }

      /** The stored override, straight from the table: the setter's id is only ever visible here. */
      async function overrideRow(who: Account): Promise<OverrideRow | undefined> {
        const [row] = await tables()<OverrideRow>`
          select kcal, protein_g as "proteinG", carbs_g as "carbsG", fat_g as "fatG", set_by_professional_id as "setByProfessionalId"
            from target_overrides
           where user_id = ${who.id}`;

        return row;
      }

      /** The targets rows in a client's trail. */
      async function targetRows(who: Account): Promise<TrailRow[]> {
        return (await trail(who.id)).filter(row => row.kind === 'targets');
      }

      beforeAll(async () => {
        setter = await account('targets-pro');
        otherSetter = await account('targets-pro-b');
        await grant(setter);
        await grant(otherSetter);

        supervised = await account('targets-client');
        otherClient = await account('targets-theirs');
        endedClient = await account('targets-ended');
        pausedClient = await account('targets-paused');

        // A client with no profile has no targets to set; each of these has one, as anybody would.
        for (const who of [supervised, otherClient, endedClient, pausedClient]) {
          await completeOnboarding(app, who);
        }

        targetLinks.supervised = await link(setter, supervised);
        targetLinks.ended = await link(setter, endedClient);
        targetLinks.paused = await link(setter, pausedClient);
        targetLinks.other = await link(otherSetter, otherClient);

        await request(server()).delete(`/${PREFIX}/care/links/${targetLinks.ended}`).set('Cookie', endedClient.cookie).expect(204);
        await tables()`update care_links set status = 'paused' where id = ${targetLinks.paused}`;

        // Targets of their own on the clients the refusals are about, so "nothing written" is a row that did not move.
        for (const who of [otherClient, endedClient, pausedClient]) {
          await setOwnTargets(who, { proteinG: 120 }).expect(200);
        }

        computed = await ownTargets(supervised);
        expect(computed.overrideStatus).toBe('none');
        expect(computed.setBy).toBeNull();
      });

      it('sets them, answers with the professional’s name as the setter, and the client sees the same on their profile', async () => {
        const target = Math.round(computed.computed.kcal) - 100;
        const rowsBefore = (await trail(supervised.id)).length;

        const response: Response = await setTargets(setter, targetLinks.supervised, { kcal: target }).expect(200);
        const resolved = response.body as ResolvedTargets;

        expect(resolved).toMatchObject({
          effective: { kcal: target },
          overrideStatus: 'applied',
          setBy: { kind: 'professional', name: nameOf(setter) }
        });
        // Exhaustive: a name and a kind, nothing that leads to the account.
        expect(Object.keys(resolved.setBy ?? {}).sort()).toEqual(['kind', 'name']);

        // The same set the client's own route answers, key for key.
        const mine = await ownTargets(supervised);

        expect(Object.keys(resolved).sort()).toEqual(Object.keys(mine).sort());
        expect(mine).toMatchObject({ effective: { kcal: target }, overrideStatus: 'applied', setBy: { kind: 'professional', name: nameOf(setter) } });
        expect(await overrideRow(supervised)).toMatchObject({ kcal: target, setByProfessionalId: setter.id });

        // One row, for the one write, and the client reads it in their trail.
        const written = (await trail(supervised.id)).slice(rowsBefore);

        expect(written).toEqual([
          expect.objectContaining({ action: 'write', kind: 'targets', professionalId: setter.id, professionalName: nameOf(setter) })
        ]);
        expect((await accessLog(supervised)).entries[0]).toMatchObject({ action: 'write', kind: 'targets', professionalName: nameOf(setter) });

        // The professional's page for the client says the same.
        const page = (await overview(setter, targetLinks.supervised).expect(200)).body as Overview;

        expect(page.targets).toMatchObject({ effective: { kcal: target }, setBy: { kind: 'professional', name: nameOf(setter) } });
      });

      it('writes exactly one `targets` row per write, and a field left out is left as it was', async () => {
        const before = await targetRows(supervised);
        const stored = await overrideRow(supervised);
        const protein = Math.round(computed.computed.proteinG) + 10;

        await setTargets(setter, targetLinks.supervised, { proteinG: protein }).expect(200);
        expect(await targetRows(supervised)).toHaveLength(before.length + 1);

        await setTargets(setter, targetLinks.supervised, { proteinG: protein }).expect(200);
        expect(await targetRows(supervised)).toHaveLength(before.length + 2);

        // Only `targets`/`write` rows, all the setter's.
        for (const row of (await targetRows(supervised)).slice(before.length)) {
          expect(row).toMatchObject({ action: 'write', kind: 'targets', professionalId: setter.id });
        }

        expect(await overrideRow(supervised)).toMatchObject({ kcal: stored?.kcal, proteinG: protein, setByProfessionalId: setter.id });
      });

      it('carries no account id or address in any answer that names the setter', async () => {
        const answers = [
          (await setTargets(setter, targetLinks.supervised, {}).expect(200)).body as unknown,
          await ownTargets(supervised),
          (await overview(setter, targetLinks.supervised).expect(200)).body as unknown,
          (await accessLog(supervised)) as unknown
        ];

        for (const answer of answers) {
          const body = JSON.stringify(answer);

          expect(body).toContain(nameOf(setter));
          expect(body).not.toContain(setter.id);
          expect(body).not.toContain(setter.email);
          expect(body).not.toContain(supervised.id);
        }
      });

      it('refuses a figure out of bounds with the same code and field errors as the client’s own route, and stores nothing', async () => {
        const floor = computed.bounds.floorKcal;
        // Past the schema's 500, below the floor: refused by the bounds, not the pipe.
        const low = Math.max(500, Math.floor(floor) - 100);

        expect(low).toBeLessThan(floor);

        const stored = await overrideRow(supervised);
        const rows = (await trail(supervised.id)).length;
        const professional: Response = await setTargets(setter, targetLinks.supervised, { kcal: low });
        const self: Response = await setOwnTargets(supervised, { kcal: low });

        expect(professional.status).toBe(422);
        expect(self.status).toBe(422);
        expect(professional.body).toMatchObject({ code: 'INVALID_INPUT', message: 'Targets out of bounds' });
        // The whole answer, not only its code: the same sentences under the same key, naming the same bound.
        expect(professional.body).toEqual(self.body);
        expect((professional.body as { fieldErrors: { targets: string[] } }).fieldErrors.targets.join(' ')).toContain(String(Math.ceil(floor)));

        // Neither refusal moved the stored targets, or whose they are.
        expect(await overrideRow(supervised)).toEqual(stored);
        // Nor the client's trail: a `write` row for a write that was refused would tell the client something changed.
        expect(await trail(supervised.id)).toHaveLength(rows);
        await expect(ownTargets(supervised)).resolves.toMatchObject({ setBy: { kind: 'professional', name: nameOf(setter) } });
      });

      it('refuses a body the client’s schema refuses, at the pipe, before the link is looked at', async () => {
        const stored = await overrideRow(supervised);
        const rows = (await trail(supervised.id)).length;

        for (const body of [{ kcal: 100 }, { kcal: 1800.5 }, { proteinG: 'lots' }]) {
          const professional: Response = await setTargets(setter, targetLinks.supervised, body);
          const self: Response = await setOwnTargets(supervised, body);

          expect(professional.status).toBe(422);
          expect(self.status).toBe(422);
          expect((professional.body as { code: string }).code).toBe((self.body as { code: string }).code);
        }

        expect(await overrideRow(supervised)).toEqual(stored);
        expect(await trail(supervised.id)).toHaveLength(rows);
      });

      it('refuses another professional’s link, a paused or ended one, an unknown id and a non-id with one 404 that writes nothing', async () => {
        const clients = [supervised, otherClient, endedClient, pausedClient];
        const rowsBefore = await counts(clients);
        const storedBefore = await Promise.all(clients.map(overrideRow));
        const attempts: [Account, string][] = [
          [otherSetter, targetLinks.supervised],
          [setter, targetLinks.other],
          [setter, targetLinks.ended],
          [setter, targetLinks.paused],
          [setter, NOBODYS_LINK],
          [setter, 'not-a-link'],
          [setter, supervised.id]
        ];

        for (const [professional, linkId] of attempts) {
          // A valid body, so the only thing refused is the link.
          const refused: Response = await setTargets(professional, linkId, { kcal: Math.round(computed.computed.kcal) - 50 });

          expect(refused.status).toBe(404);
          expect(refused.body).toEqual(NO_CLIENT);
        }

        expect(await counts(clients)).toEqual(rowsBefore);
        expect(await Promise.all(clients.map(overrideRow))).toEqual(storedBefore);
      });

      it('does not exist for an account that is not a professional, for no session, or with the switch off', async () => {
        const rows = (await trail(supervised.id)).length;
        const stored = await overrideRow(supervised);
        const body = { kcal: Math.round(computed.computed.kcal) - 50 };

        // The client themselves, on their own link: not a professional, so no such route.
        const asClient: Response = await setTargets(supervised, targetLinks.supervised, body);

        expect(asClient.status).toBe(404);
        expect(asClient.body).toEqual(NO_DOOR);
        await request(server()).patch(`/${PREFIX}/care/clients/${targetLinks.supervised}/targets`).send(body).expect(404);

        await setSwitch(false);

        try {
          const switchedOff: Response = await setTargets(setter, targetLinks.supervised, body);

          expect(switchedOff.status).toBe(404);
          expect(switchedOff.body).toEqual(NO_DOOR);
          // Before any body is read: a body the schema refuses is the same 404, not a 422.
          expect((await setTargets(setter, targetLinks.supervised, { kcal: 100 })).status).toBe(404);
        } finally {
          await setSwitch(true);
        }

        expect(await trail(supervised.id)).toHaveLength(rows);
        expect(await overrideRow(supervised)).toEqual(stored);
      });

      it('becomes the client’s own when the client changes it, on both sides', async () => {
        const own = Math.round(computed.computed.kcal) - 80;
        const rows = (await trail(supervised.id)).length;

        const response: Response = await setOwnTargets(supervised, { kcal: own }).expect(200);

        expect(response.body).toMatchObject({ effective: { kcal: own }, overrideStatus: 'applied', setBy: { kind: 'self' } });
        expect(Object.keys((response.body as ResolvedTargets).setBy ?? {})).toEqual(['kind']);
        await expect(ownTargets(supervised)).resolves.toMatchObject({ setBy: { kind: 'self' } });
        expect(await overrideRow(supervised)).toMatchObject({ kcal: own, setByProfessionalId: null });
        // The client's own change is not a professional's access: no trail row for it.
        expect(await trail(supervised.id)).toHaveLength(rows);

        const page = (await overview(setter, targetLinks.supervised).expect(200)).body as Overview;

        expect(page.targets).toMatchObject({ effective: { kcal: own }, setBy: { kind: 'self' } });
      });

      it('clears back to the computed figures when the professional sends every field as null', async () => {
        const response: Response = await setTargets(setter, targetLinks.supervised, { carbsG: null, fatG: null, kcal: null, proteinG: null }).expect(
          200
        );

        expect(response.body).toMatchObject({ effective: computed.effective, overrideStatus: 'none', setBy: null });
        await expect(ownTargets(supervised)).resolves.toMatchObject({ overrideStatus: 'none', setBy: null });
      });

      it('reads as the client’s own once the professional who set it deletes their account, and the figures stay', async () => {
        const leaving = await account('targets-pro-gone');
        const kept = await account('targets-kept');

        await grant(leaving);
        await completeOnboarding(app, kept);

        const linkId = await link(leaving, kept);
        const target = Math.round((await ownTargets(kept)).computed.kcal) - 100;

        await setTargets(leaving, linkId, { kcal: target }).expect(200);
        await expect(ownTargets(kept)).resolves.toMatchObject({ setBy: { kind: 'professional', name: nameOf(leaving) } });

        await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', leaving.cookie).expect(204);

        // The column went null with the account; the client's targets did not go with it.
        expect(await overrideRow(kept)).toMatchObject({ kcal: target, setByProfessionalId: null });
        await expect(ownTargets(kept)).resolves.toMatchObject({ effective: { kcal: target }, overrideStatus: 'applied', setBy: { kind: 'self' } });
        // And the trail still says who wrote it, by the name they had.
        expect(await targetRows(kept)).toEqual([
          expect.objectContaining({ action: 'write', professionalId: null, professionalName: nameOf(leaving) })
        ]);
      });

      /*
       * The check-in's nudge is somebody else's to give (project 004 Phase 6;
       * PRD criterion 10, owner's decision 2026-09-24). A supervised client
       * answering "hungry" or "full" must not silently turn a professional's
       * override into their own — the check-in is still recorded, the weight
       * still logged, but the targets and their `setByProfessionalId` mark
       * stand exactly as they were. The professional's own read carries the
       * kcal the nudge would have set; the client's own reads never do.
       */
      describe('a check-in from a client whose targets a professional set', () => {
        let checkinClient: Account;
        let checkinLinkId: string;
        let plan: PlanView;

        beforeAll(async () => {
          checkinClient = await account('targets-checkin');
          await completeOnboarding(app, checkinClient);

          // Generated before the link exists: a link's `reviewBeforePublish` (on by
          // default, project 004 Phase 5) only holds back a plan generated *after*
          // it — this suite is not about that gate, so the client gets their plan
          // the ordinary way, then is linked and put under supervision.
          const job = await generateAndWait(app, checkinClient);

          expect(job.status).toBe('succeeded');

          const active: Response = await request(server()).get(`/${PREFIX}/meal-plans/active`).set('Cookie', checkinClient.cookie).expect(200);

          plan = active.body as PlanView;

          checkinLinkId = await link(setter, checkinClient);

          const target = Math.round((await ownTargets(checkinClient)).computed.kcal) - 120;

          await setTargets(setter, checkinLinkId, { kcal: target }).expect(200);
        });

        it('is recorded, with the weight logged, and does not move the professional’s targets', async () => {
          const before = await overrideRow(checkinClient);

          expect(before?.setByProfessionalId).toBe(setter.id);

          const response: Response = await request(server())
            .post(`/${PREFIX}/check-ins`)
            .set('Cookie', checkinClient.cookie)
            .send({ difficulty: 'ok', hunger: 'hungry', planId: plan.id, satisfaction: 4, weightKg: 71 })
            .expect(201);
          const body = response.body as CheckInResultView;

          expect(body.targets).toBeNull();
          expect(body.weightLogged).toBe(true);
          // Byte-identical: not just the same kcal, the same row.
          expect(await overrideRow(checkinClient)).toEqual(before);

          // Still recorded: a second submission for the same plan is a conflict, not a silent no-op.
          await request(server())
            .post(`/${PREFIX}/check-ins`)
            .set('Cookie', checkinClient.cookie)
            .send({ difficulty: 'ok', hunger: 'hungry', planId: plan.id, satisfaction: 4, weightKg: 71 })
            .expect(409);

          const status: Response = await request(server()).get(`/${PREFIX}/check-ins/status`).set('Cookie', checkinClient.cookie).expect(200);

          expect(status.body).toMatchObject({ done: true });
        });

        it('carries the kcal the nudge would have set on the professional’s own read, never on the client’s', async () => {
          type CareCheckIn = { checkIn: { hunger: string | null; suggestedKcal: number | null } | null; planId: string };
          const page = (await overview(setter, checkinLinkId).expect(200)).body as Overview & {
            progress: { fortnights: readonly CareCheckIn[] };
            targets: ResolvedTargets;
          };
          const fortnight = page.progress.fortnights.find(row => row.planId === plan.id);
          const expected = nudgedKcal('hungry', page.targets);

          expect(expected).not.toBeNull();
          expect(fortnight?.checkIn?.hunger).toBe('hungry');
          expect(fortnight?.checkIn?.suggestedKcal).toBe(expected);

          // Never on the client's own reads.
          const mine: Response = await request(server()).get(`/${PREFIX}/progress/summary`).set('Cookie', checkinClient.cookie).expect(200);

          expect(JSON.stringify(mine.body)).not.toContain('suggestedKcal');
        });

        it('carries no suggestion for a check-in that answered "right"', async () => {
          const right = await account('targets-checkin-right');

          await completeOnboarding(app, right);

          const job = await generateAndWait(app, right);

          expect(job.status).toBe('succeeded');

          const active: Response = await request(server()).get(`/${PREFIX}/meal-plans/active`).set('Cookie', right.cookie).expect(200);
          const rightPlan = active.body as PlanView;
          const rightLinkId = await link(setter, right);

          await request(server())
            .post(`/${PREFIX}/check-ins`)
            .set('Cookie', right.cookie)
            .send({ difficulty: 'ok', hunger: 'right', planId: rightPlan.id, satisfaction: 5 })
            .expect(201);

          type CareCheckIn = { checkIn: { hunger: string | null; suggestedKcal: number | null } | null; planId: string };
          const page = (await overview(setter, rightLinkId).expect(200)).body as Overview & { progress: { fortnights: readonly CareCheckIn[] } };
          const fortnight = page.progress.fortnights.find(row => row.planId === rightPlan.id);

          expect(fortnight?.checkIn?.hunger).toBe('right');
          expect(fortnight?.checkIn?.suggestedKcal).toBeNull();
        });
      });
    });
  });
});
