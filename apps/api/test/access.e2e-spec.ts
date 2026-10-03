import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { UserController } from 'core/controllers/User';
import { UNAUDITED } from 'core/entities/Audit';
import { signInBrakeKey } from 'core/domain/SignInBrake';
import { database } from 'database';

import { createApp, deleteAccountByEmail, deleteAccounts, httpServer, PREFIX, ScriptedAiClient, unconfirmAddress } from './harness.js';

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

/** The suite's raw handle on the tables, for what no route may write or read. */
function tables() {
  return (database() as unknown as { readonly $client: <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]> })
    .$client;
}

/**
 * Sets every session of this account back two days, past Better Auth's
 * `freshAge` (one day), so the next delete meets the session a person has
 * after signing in on Monday and deleting on Wednesday. Written on the table:
 * no route can age a session, and waiting a day is not a test.
 */
async function ageSessions(userId: string): Promise<void> {
  const aged = await tables()<{ id: string }>`
    update session set created_at = now() - interval '2 days' where user_id = ${userId} returning id`;

  if (aged.length === 0) {
    throw new Error(`No session to age for: ${userId}`);
  }
}

/**
 * An invitation addressed to `email` from `professionalId`, written on the table.
 * What it stands for is `beforeDelete`'s own work: `CareController.forgetAddress`
 * deletes it, so while it is there, `beforeDelete` has not run. Written on the
 * table because the route needs the whole workspace (switch, grant, agreement,
 * practice), and `care.e2e-spec.ts` is the suite about that.
 */
async function invitationTo(email: string, professionalId: string): Promise<void> {
  await tables()`
    insert into care_invitations (email, expires_at, professional_id, token_hash)
    values (${email.toLowerCase()}, now() + interval '14 days', ${professionalId}, ${`e2e-stale-delete-${Date.now()}`})`;
}

async function invitationsTo(email: string): Promise<number> {
  const rows = await tables()<{ id: string }>`select id from care_invitations where email = ${email.toLowerCase()}`;

  return rows.length;
}

describe('access: two locks, and the shape of a denial', () => {
  let app: INestApplication;
  let stamp: number;
  /** Every account this suite signed up, so `afterAll` can delete each one — `locks-delete` deletes itself and is not added twice. */
  const made: string[] = [];

  /**
   * Signed up and signed in, its address left unconfirmed and its account
   * unopened. An unconfirmed account cannot sign in with its password (PLAN
   * 011 phase 8), so it signs in confirmed and is put back: the session of an
   * address nobody proved, as one from before phase 8 still is.
   */
  async function signUp(email: string): Promise<string> {
    const server = httpServer(app);

    await request(server).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Test', password: PASSWORD }).expect(200);
    await UserController.confirmAddress(email);

    const signIn: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: PASSWORD }).expect(200);
    const cookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');

    await unconfirmAddress(email);
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
      // Plan quality and retention (project 008 phase 5): plain, and with a query they would refuse.
      '/admin/plans/quality',
      '/admin/plans/quality?period=12',
      '/admin/retention',
      '/admin/retention?grouping=year',
      // One recipe and the file of its rejected picture (project 009 phase 2): an id that is no recipe, and one that is no id.
      '/admin/catalogue/recipes/00000000-0000-4000-8000-000000000000',
      '/admin/catalogue/recipes/not-a-uuid',
      '/admin/catalogue/recipes/00000000-0000-4000-8000-000000000000/picture/candidate',
      '/admin/catalogue/recipes/not-a-uuid/picture/candidate',
      '/admin/catalogue/recipes?picture=accepted_by_hand',
      '/health-data'
    ];

    for (const path of paths) {
      await request(server).get(`/${PREFIX}${path}`).expect(404);
    }

    // The owner's acceptance of a rejected picture and its removal (project 009 phase 3): writes, and the same 404 —
    // with the body the route takes, with one it would refuse, and with none.
    const writes: [string, unknown][] = [
      [
        '/admin/catalogue/recipes/00000000-0000-4000-8000-000000000000/picture/candidate/accept',
        { allergens: [], expiresAt: '2026-10-07T00:00:00.000Z' }
      ],
      ['/admin/catalogue/recipes/00000000-0000-4000-8000-000000000000/picture/candidate/accept', { allergens: 'gluten', confirmed: true }],
      ['/admin/catalogue/recipes/not-a-uuid/picture/candidate/accept', undefined],
      ['/admin/catalogue/recipes/00000000-0000-4000-8000-000000000000/picture/remove', undefined],
      ['/admin/catalogue/recipes/not-a-uuid/picture/remove', undefined]
    ];

    for (const [path, body] of writes) {
      const call = request(server).post(`/${PREFIX}${path}`);
      const response: Response = await (body === undefined ? call : call.send(body as object));

      expect({ body, path, status: response.status }).toEqual({ body, path, status: 404 });
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

  /*
   * Production, 2026-09-30: deleting from a session older than a day was a 500.
   * Better Auth refuses it on purpose, since a stolen session must not delete an
   * account, and the refusal is now a state to act on: sign in again, then delete.
   * It comes before anything is touched: Stripe, invitations, rows.
   */
  it('refuses to delete from a session older than a day, touching nothing, and deletes from a fresh one', async () => {
    const email = `locks-stale-delete-${stamp}@e2e.invalid`;
    const staleCookie = await signUp(email);
    const server = httpServer(app);

    try {
      await UserController.confirmAddress(email);
      await UserController.activate({ email }, UNAUDITED);
      await request(server).patch(`/${PREFIX}/profile`).set('Cookie', staleCookie).send({ displayName: 'Stays' }).expect(200);

      const me: Response = await request(server).get(`/${PREFIX}/users/me`).set('Cookie', staleCookie).expect(200);
      const userId = (me.body as { id: string }).id;

      // Somebody who invited this address: the row `beforeDelete` would clear. Deleted with the suite's accounts.
      const inviterCookie = await signUp(`locks-stale-inviter-${stamp}@e2e.invalid`);
      const inviter: Response = await request(server).get(`/${PREFIX}/users/me`).set('Cookie', inviterCookie).expect(200);

      await invitationTo(email, (inviter.body as { id: string }).id);
      await ageSessions(userId);

      const refused: Response = await request(server).delete(`/${PREFIX}/users/me`).set('Cookie', staleCookie).expect(409);

      expect(refused.body).toEqual({
        code: 'REAUTHENTICATION_REQUIRED',
        message: 'Por seguridad, vuelve a iniciar sesión para borrar tu cuenta.',
        statusCode: 409
      });

      // Nothing went: the account, its profile, its session and its password all still answer.
      const still: Response = await request(server).get(`/${PREFIX}/users/me`).set('Cookie', staleCookie).expect(200);
      const profile: Response = await request(server).get(`/${PREFIX}/profile`).set('Cookie', staleCookie).expect(200);

      expect((still.body as { id: string }).id).toBe(userId);
      expect(profile.body).toMatchObject({ profile: { displayName: 'Stays' } });
      // …and `beforeDelete` never ran: the invitation it clears first is still there.
      expect(await invitationsTo(email)).toBe(1);

      // The way through, the one the screen offers: sign in again, then delete.
      const signIn: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: PASSWORD }).expect(200);
      const freshCookie = (signIn.headers['set-cookie'] as unknown as string[]).join('; ');

      await request(server).delete(`/${PREFIX}/users/me`).set('Cookie', freshCookie).expect(204);
      // The fresh delete does run it: the address is forgotten along with the account.
      expect(await invitationsTo(email)).toBe(0);
      await request(server).get(`/${PREFIX}/users/me`).set('Cookie', freshCookie).expect(404);
      await request(server).get(`/${PREFIX}/users/me`).set('Cookie', staleCookie).expect(404);
      await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: PASSWORD }).expect(401);
    } finally {
      // The aged cookie in `made` can no longer delete it; if the test stopped half-way, this still does.
      await deleteAccountByEmail(app, email, PASSWORD);
    }
  });
});

/**
 * Sign-up reveals nothing (PLAN 011 phase 8, `0074`): an address that already
 * has an account is answered exactly as a new one — status, headers and body
 * but for the values new on every answer (the id, the instants) — neither
 * gets a session, and each address gets one mail after the response: the
 * confirmation to the new one, "somebody tried" to the existing one. Mail is
 * not configured under the suites, so each mail is its one log line.
 *
 * Nor does the sign-in after it (phase 8, amended): the stranger who signed
 * up both addresses with a password of their own and signs in with it gets
 * the same 401 for both — the new account is unconfirmed, the existing one's
 * password is not theirs — and the same row in the per-address brake.
 */
describe('sign-up: the same answer for a new address and an existing one', () => {
  let app: INestApplication;
  const stamp = `${Date.now()}`;
  const existing = `signup-existing-${stamp}@e2e.invalid`;
  const fresh = `signup-new-${stamp}@e2e.invalid`;
  const OTHER_PASSWORD = 'otra-frase-de-caballos-azules';
  const logged: string[] = [];
  let restore: (() => void) | undefined;

  /** The values new on every answer, whoever asks; everything else must match to the byte, key order included. */
  function shape(body: string): string {
    return body
      .replace(/"id":"[^"]+"/, '"id":"<id>"')
      .replace(/"(createdAt|updatedAt|termsAcceptedAt)":"[^"]+"/g, '"$1":"<at>"')
      .replace(/"email":"[^"]+"/, '"email":"<email>"');
  }

  /** The headers that are the same thing on every answer; `date` and the request id differ by when, not by whom. */
  function headerShape(response: Response): Record<string, string> {
    const { date: _date, 'x-request-id': _id, ...rest } = response.headers as Record<string, string>;

    return rest;
  }

  const keyOf = (email: string) => signInBrakeKey(email, process.env['BETTER_AUTH_SECRET'] ?? '');

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([]));
    await request(httpServer(app)).post(`/${PREFIX}/auth/sign-up/email`).send({ email: existing, name: 'Ana', password: PASSWORD }).expect(200);
    // An account somebody already has: its address confirmed, as its link would.
    await UserController.confirmAddress(existing);

    const info = console.info;

    console.info = (...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    };

    restore = () => {
      console.info = info;
    };
  });

  afterAll(async () => {
    restore?.();
    await tables()`delete from sign_in_failure where key = any(${[keyOf(existing), keyOf(fresh)]})`;
    await deleteAccountByEmail(app, existing, PASSWORD);
    await deleteAccountByEmail(app, fresh, OTHER_PASSWORD);
    await app?.close();
  });

  it('answers both with the same status, headers and body, opens no session, and mails each once', async () => {
    const server = httpServer(app);
    const [existingUser] = await tables()<{ id: string }>`select id from "user" where email = ${existing}`;

    await settle();
    logged.length = 0;

    const toExisting: Response = await request(server)
      .post(`/${PREFIX}/auth/sign-up/email`)
      .send({ email: existing, name: 'Bea', password: OTHER_PASSWORD });
    const toFresh: Response = await request(server)
      .post(`/${PREFIX}/auth/sign-up/email`)
      .send({ email: fresh, name: 'Bea', password: OTHER_PASSWORD });

    expect(toExisting.status).toBe(200);
    expect(toFresh.status).toBe(200);
    expect(shape(toExisting.text)).toBe(shape(toFresh.text));
    expect(headerShape(toExisting)).toEqual(headerShape(toFresh));
    expect(toExisting.headers['set-cookie']).toBeUndefined();
    expect(toFresh.headers['set-cookie']).toBeUndefined();
    expect(toExisting.body).toMatchObject({ token: null, user: { email: existing, emailVerified: false, name: 'Bea' } });

    // The existing account answered with a fresh id, never its own.
    expect((toExisting.body as { user: { id: string } }).user.id).not.toBe(existingUser?.id);

    await settle();

    const [freshUser] = await tables()<{ id: string }>`select id from "user" where email = ${fresh}`;

    expect(logged.filter(line => line.includes('sign-up with an existing address'))).toEqual([
      `[auth] sign-up with an existing address (user ${existingUser?.id}); no SMTP configured, mail not sent`
    ]);
    expect(logged.filter(line => line.includes('verification url'))).toHaveLength(1);
    expect(logged.filter(line => line.includes('verification url'))[0]).toContain(`for ${freshUser?.id}:`);
  });

  it('answers the sign-in with the stranger’s password the same for both: status, headers, body, and the brake’s row', async () => {
    const server = httpServer(app);
    const [freshUser] = await tables()<{ id: string }>`select id from "user" where email = ${fresh}`;

    await tables()`delete from sign_in_failure where key = any(${[keyOf(existing), keyOf(fresh)]})`;
    await settle();
    logged.length = 0;

    const toExisting: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email: existing, password: OTHER_PASSWORD });
    const toFresh: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email: fresh, password: OTHER_PASSWORD });

    expect(toExisting.status).toBe(401);
    expect(toFresh.status).toBe(toExisting.status);
    expect(toFresh.text).toBe(toExisting.text);
    expect(headerShape(toFresh)).toEqual(headerShape(toExisting));
    expect(toFresh.headers['set-cookie']).toBeUndefined();

    const rows = async (email: string) => tables()<{ count: number; next: Date | null }>`
      select count, next_allowed_at as next from sign_in_failure where key = ${keyOf(email)}`;

    expect(await rows(fresh)).toEqual([{ count: 1, next: null }]);
    expect(await rows(existing)).toEqual(await rows(fresh));

    // A fresh link to the unconfirmed address, after the response; the confirmed account is sent none.
    await settle();
    expect(logged.filter(line => line.includes('verification url'))).toEqual([expect.stringContaining(`for ${freshUser?.id}:`)]);
  });

  it('changes nothing of the existing account: its name and its password still stand', async () => {
    const server = httpServer(app);
    const [user] = await tables()<{ n: number; name: string }>`
      select name, (select count(*)::int from "user" where email = ${existing}) as n from "user" where email = ${existing}`;

    expect(user).toEqual({ n: 1, name: 'Ana' });
    await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email: existing, password: OTHER_PASSWORD }).expect(401);
    await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email: existing, password: PASSWORD }).expect(200);
  });
});
