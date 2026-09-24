import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { CARE_CONSENT_VERSION, CARE_HEALTH_SHARED, CARE_SHARED } from 'core/entities/Care';
import { CareController } from 'core/controllers/Care';
import { NotFoundError } from 'core/entities/Error';
import { UserController } from 'core/controllers/User';
import { database } from 'database';

import { createApp, httpServer, PREFIX, register, ScriptedAiClient } from './harness.js';
import { EmailService } from '../src/modules/email/services/index.js';

import type { Account } from './harness.js';
import type { AcceptInvitation } from 'core/entities/Care';
import type { CareInvitationDetailView, CareLinkView, CareSession } from 'core/controllers/Care';
import type { ProfessionalAccountView } from 'core/controllers/Professional';
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
    app = await createApp(new ScriptedAiClient([]));
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

        if (accounts.length > 0 || invitations.length > 0) {
          throw new Error(`care left ${accounts.length} account(s) and ${invitations.length} invitation(s) behind`);
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
});
