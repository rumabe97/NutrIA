import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { hashPassword } from 'better-auth/crypto';

import { UserController } from 'core/controllers/User';
import { database } from 'database';

import { EmailService } from '../src/modules/email/services/index.js';
import { activate, createApp, deleteAccountByEmail, httpServer, PREFIX, ScriptedAiClient } from './harness.js';
import { hibpAttempts, hibpTripwireInstalled } from './hibp-tripwire.js';

import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * Harder to take (project 011, phase 2): changing the password, the sessions a
 * person sees and closes, the mail that says the password changed, and the
 * password found breached that must be changed before anything else.
 *
 * Better Auth's own routes, used as they are — `/auth/change-password`,
 * `/auth/list-sessions`, `/auth/revoke-session`, `/auth/revoke-other-sessions`,
 * `/auth/revoke-sessions` — with the product's hooks around them:
 *
 * - a change revokes every other session whatever the body says;
 * - a change or a reset clears `password_compromised_at`, writes one
 *   `auth.password_changed` and sends "your password has changed", after the
 *   response;
 * - each revoke writes one `auth.sessions_revoked` with its scope;
 * - while `password_compromised_at` is set, every route but `GET`/`DELETE
 *   /users/me` and Better Auth's own answers 409 `PASSWORD_CHANGE_REQUIRED`,
 *   after the two locks and before onboarding.
 *
 * The breach check that sets the mark at sign-in never runs under
 * `NODE_ENV=test` (`hibp-tripwire.ts` makes that a fact): the mark is seeded on
 * the table here, and the check itself is the unit specs'.
 *
 * Mail is caught at `EmailService.send`, as `care.e2e-spec.ts` does, with
 * `configured` answered true so the mail functions reach it instead of the
 * log; nothing is sent.
 *
 * Requires a real database — see ./README.md.
 */
const ORIGINAL = 'correct-horse-battery-staple-9';
/** Used only to delete what is left: written straight into an account's credential, then signed in with. */
const CLEANUP_PASSWORD = 'quiet-orchard-lamp-velvet-3';
/** Sent on every request, so "no user agent in an audit row" and "the device family only" have something to look for. */
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const CHANGED_SUBJECT = /contraseña (?:de NutrIA )?ha cambiado|password has changed/i;
/** M14: the mail says nothing of health. */
const HEALTH_WORDS = /alerg|allerg|salud|health|dieta|diet\b|peso|weight|calor|medic|embaraz|pregnan/i;

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;
type Session = { readonly cookie: string; readonly token: string };
type ListedSession = { readonly token: string; readonly userAgent?: string | null };
type Me = { readonly hasPassword?: boolean; readonly passwordChangeRequired?: boolean };
type AuditMeta = { readonly ipHash: string | null; readonly metadata: Record<string, unknown> | null; };

function cookiesOf(response: Response): string {
  return ((response.headers['set-cookie'] as unknown as string[] | undefined) ?? []).map(cookie => cookie.split(';')[0]).join('; ');
}

function code(response: Response): string | undefined {
  return (response.body as { code?: string }).code;
}

function pause(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

describe('account security: the password, the sessions, and a password found breached', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const sql = (): Sql => (database() as unknown as { readonly $client: Sql }).$client;
  const outbox: OutgoingEmail[] = [];
  /** Every session token this suite was handed, so the end can assert none of them reached an audit row. */
  const tokens: string[] = [];
  /** While set, a mail handed to `send` waits for it: a response that waited for its mail would wait too. */
  let held: Promise<void> | null = null;
  let started = '';

  const server = () => httpServer(app);
  const emailFor = (label: string) => `account-security-${label}-${String(stamp)}@e2e.invalid`;
  const mailsTo = (email: string) => outbox.filter(mail => mail.to === email && CHANGED_SUBJECT.test(mail.subject));

  async function signUp(label: string, name: string): Promise<{ id: string; email: string; }> {
    const email = emailFor(label);
    const made = await request(server()).post(`/${PREFIX}/auth/sign-up/email`).set('User-Agent', IPHONE).send({ email, name, password: ORIGINAL }).expect(200);

    return { id: (made.body as { user: { id: string } }).user.id, email };
  }

  /** An account with both locks open, as `harness.ts` → `register` makes one, but keeping its id for the table. */
  async function account(label: string, name: string): Promise<{ id: string; email: string; }> {
    const made = await signUp(label, name);

    await activate(made.email);

    return made;
  }

  async function signIn(email: string, password = ORIGINAL): Promise<Session> {
    const response = await request(server()).post(`/${PREFIX}/auth/sign-in/email`).set('User-Agent', IPHONE).send({ email, password }).expect(200);
    const token = (response.body as { token: string }).token;

    tokens.push(token);

    return { cookie: cookiesOf(response), token };
  }

  const get = (path: string, cookie: string) => request(server()).get(`/${PREFIX}/${path}`).set('Cookie', cookie).set('User-Agent', IPHONE);

  const post = (path: string, cookie: string, body: object = {}) =>
    request(server()).post(`/${PREFIX}/${path}`).set('Cookie', cookie).set('User-Agent', IPHONE).send(body);

  async function listSessions(cookie: string): Promise<string[]> {
    const listed = await get('auth/list-sessions', cookie).expect(200);

    return (listed.body as ListedSession[]).map(session => session.token);
  }

  /**
   * Better Auth allows three changes in ten seconds per path (its own rule, which
   * the test environment does not raise), and the suite before this one may have
   * spent them: a 429 is waited out once, for as long as it says, and tried again.
   */
  async function change(cookie: string, body: Record<string, unknown>): Promise<Response> {
    const send = () => post('auth/change-password', cookie, body).set('Accept-Language', 'es');
    let response = await send();

    for (let retry = 0; retry < 2 && response.status === 429; retry += 1) {
      const wait = Number(response.headers['x-retry-after'] ?? 10);

      await pause((Number.isFinite(wait) ? wait : 10) * 1000 + 500);
      response = await send();
    }

    return response;
  }

  async function auditRows(userId: string, action: string): Promise<AuditMeta[]> {
    return sql()<AuditMeta>`
      select metadata, ip_hash as "ipHash" from audit_logs
      where action = ${action} and created_at >= ${started} and (actor_id = ${userId} or subject_user_id = ${userId})
      order by created_at, id`;
  }

  async function mark(userId: string): Promise<void> {
    const marked = await sql()<{ id: string }>`update "user" set password_compromised_at = now() where id = ${userId} returning id`;

    expect(marked).toHaveLength(1);
  }

  async function markOf(userId: string): Promise<string | null> {
    const [row] = await sql()<{ at: string | null }>`select password_compromised_at::text as at from "user" where id = ${userId}`;

    return row?.at ?? null;
  }

  async function passwordHash(userId: string): Promise<string> {
    const [row] = await sql()<{ password: string }>`select password from account where user_id = ${userId} and provider_id = 'credential'`;

    return row?.password ?? '';
  }

  async function until(check: () => boolean | Promise<boolean>, what: string): Promise<void> {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      if (await check()) {
        return;
      }

      await pause(100);
    }

    throw new Error(`${what} did not happen within 10 s`);
  }

  beforeAll(async () => {
    // The tripwire must be live before anything here could reach HIBP, or "no attempt" at the end proves nothing.
    expect(hibpTripwireInstalled()).toBe(true);
    await expect(fetch('https://api.pwnedpasswords.com/range/00000')).rejects.toThrow();
    expect(hibpAttempts()).toBe(1);

    // On the prototype, so whichever instance a module was handed is the one caught.
    jest.spyOn(EmailService.prototype, 'configured', 'get').mockReturnValue(true);
    jest.spyOn(EmailService.prototype, 'send').mockImplementation(async message => {
      outbox.push(message);

      if (held) {
        await held;
      }

      return true;
    });

    const [clock] = await sql()<{ now: string }>`select now()::text as now`;

    started = clock?.now ?? '';
    app = await createApp(new ScriptedAiClient([]));
  });

  afterAll(async () => {
    try {
      // Whatever this suite made, whatever password or mark it ended with: given a known password, then deleted through the product's own door.
      const pattern = `account-security-%-${String(stamp)}@e2e.invalid`;
      const left = await sql()<{ id: string; email: string }>`select id, email from "user" where email like ${pattern}`;
      const known = await hashPassword(CLEANUP_PASSWORD);

      for (const { id, email } of left) {
        await sql()`update account set password = ${known} where user_id = ${id} and provider_id = 'credential'`;
        await deleteAccountByEmail(app, email, CLEANUP_PASSWORD);
      }

      const [remaining] = await sql()<{ n: number }>`select count(*)::int as n from "user" where email like ${pattern}`;

      expect(remaining?.n ?? 0).toBe(0);
    } finally {
      jest.restoreAllMocks();
      await app?.close();
    }
  });

  describe('changing the password', () => {
    it('refuses a wrong current password with Better Auth’s INVALID_PASSWORD, and changes nothing', async () => {
      const { id, email } = await account('alba', 'Alba Robledo');
      const session = await signIn(email);
      const before = await passwordHash(id);

      const refused = await change(session.cookie, { currentPassword: 'not-the-one-at-all-41', newPassword: 'amber-lantern-quietly-7' });

      expect(refused.status).toBe(400);
      expect(code(refused)).toBe('INVALID_PASSWORD');
      expect(await passwordHash(id)).toBe(before);
      await signIn(email, ORIGINAL);
      await request(server()).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: 'amber-lantern-quietly-7' }).expect(401);

      // A refusal is not a change: no row, no mail, and the session that asked is still a session.
      expect(await auditRows(id, 'auth.password_changed')).toEqual([]);
      await pause(500);
      expect(mailsTo(email)).toEqual([]);
      await get('users/me', session.cookie).expect(200);

      // Not marked, the same password back is a change like any other: the refusal is the mark's alone.
      const same = await change(session.cookie, { currentPassword: ORIGINAL, newPassword: ORIGINAL });

      expect(same.status).toBe(200);
    });

    it('ends every other session even when the body asks to keep them, hands the caller a new one, and mails after answering', async () => {
      const { id, email } = await account('bruno', 'Bruno Lozano');
      const caller = await signIn(email);
      const other = await signIn(email);

      expect((await listSessions(caller.cookie)).sort()).toEqual([caller.token, other.token].sort());

      let release: () => void = () => undefined;

      held = new Promise<void>(resolve => {
        release = resolve;
      });

      let changed: Response | null;

      try {
        // Raced against a clock: the mail is held, so a change that waited for its mail would not answer.
        changed = await Promise.race([
          change(caller.cookie, { currentPassword: ORIGINAL, newPassword: 'amber-lantern-quietly-7', revokeOtherSessions: false }),
          pause(15_000).then(() => null)
        ]);
      } finally {
        held = null;
        release();
      }

      if (!changed) {
        throw new Error('The change did not answer while its mail was held: it waits for the mail');
      }

      expect(changed.status).toBe(200);

      // Better Auth hands a token back only when it revoked the others — what the body asked is ignored.
      const handed = (changed.body as { token: string | null }).token;

      expect(handed).toEqual(expect.any(String));
      tokens.push(handed ?? '');

      const renewed = cookiesOf(changed);

      expect(renewed).not.toBe('');
      await get('users/me', other.cookie).expect(404);
      await get('users/me', renewed).expect(200);
      expect(await listSessions(renewed)).toEqual([handed]);

      await signIn(email, 'amber-lantern-quietly-7');
      await request(server()).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: ORIGINAL }).expect(401);

      const rows = await auditRows(id, 'auth.password_changed');

      expect(rows).toHaveLength(1);
      expect(rows[0]?.metadata).toEqual({ via: 'change' });

      await until(() => mailsTo(email).length > 0, 'The "password changed" mail');
      await pause(500);

      const mails = mailsTo(email);

      expect(mails).toHaveLength(1);

      const [mail] = mails;
      const said = `${mail?.subject ?? ''}\n${mail?.text ?? ''}\n${mail?.html ?? ''}`;

      // Where to go if it was not them, roughly from where, and nothing more.
      expect(mail?.text).toContain('/recuperar');
      expect(said).toMatch(/iPhone|iOS/);
      expect(said).not.toContain(IPHONE);
      expect(said).not.toMatch(/127\.0\.0\.1|::1|::ffff/);
      expect(said).not.toMatch(HEALTH_WORDS);

      for (const token of tokens) {
        expect(said).not.toContain(token);
      }
    });
  });

  describe('the sessions', () => {
    it('lists both, closes one, then all the others, then all — one audit row each, with its scope', async () => {
      const { id, email } = await account('carmen', 'Carmen Ortuño');
      const kept = await signIn(email);
      const closed = await signIn(email);

      expect((await listSessions(kept.cookie)).sort()).toEqual([kept.token, closed.token].sort());

      await post('auth/revoke-session', kept.cookie, { token: closed.token }).expect(200);
      await get('users/me', closed.cookie).expect(404);
      expect(await listSessions(kept.cookie)).toEqual([kept.token]);

      const third = await signIn(email);
      const fourth = await signIn(email);

      await post('auth/revoke-other-sessions', kept.cookie).expect(200);
      await get('users/me', third.cookie).expect(404);
      await get('users/me', fourth.cookie).expect(404);
      await get('users/me', kept.cookie).expect(200);
      expect(await listSessions(kept.cookie)).toEqual([kept.token]);

      await post('auth/revoke-sessions', kept.cookie).expect(200);
      await get('users/me', kept.cookie).expect(404);

      const rows = await auditRows(id, 'auth.sessions_revoked');

      expect(rows.map(row => row.metadata)).toEqual([{ scope: 'one' }, { scope: 'others' }, { scope: 'all' }]);
    });

    it('refuses the list to a session older than a day with SESSION_NOT_FRESH, and still lets it close the others', async () => {
      const { id, email } = await account('julia', 'Julia Pedraza');
      const old = await signIn(email);
      const other = await signIn(email);

      // Two days back, past Better Auth's `freshAge`: no route can age a session, and waiting a day is not a test.
      const aged = await sql()<{ id: string }>`
        update session set created_at = now() - interval '2 days' where user_id = ${id} and token = ${old.token} returning id`;

      expect(aged).toHaveLength(1);

      const refused = await get('auth/list-sessions', old.cookie);

      expect(refused.status).toBe(403);
      expect(code(refused)).toBe('SESSION_NOT_FRESH');

      await post('auth/revoke-other-sessions', old.cookie).expect(200);
      await get('users/me', other.cookie).expect(404);
      await get('users/me', old.cookie).expect(200);
    });

    it('never lists or closes another person’s session: A’s cookie with B’s token changes nothing for B', async () => {
      const dario = await account('dario', 'Darío Montes');
      const elena = await account('elena', 'Elena Saavedra');
      const his = await signIn(dario.email);
      const hers = await signIn(elena.email);
      const hersToo = await signIn(elena.email);

      expect(await listSessions(his.cookie)).toEqual([his.token]);

      // Better Auth answers as if it had, and deletes only a session of the caller's own.
      const attempt = await post('auth/revoke-session', his.cookie, { token: hers.token });

      expect(attempt.status).toBeLessThan(500);
      await get('users/me', hers.cookie).expect(200);
      // Nothing was removed, so nothing is recorded: a row means a session really ended.
      expect(await auditRows(dario.id, 'auth.sessions_revoked')).toEqual([]);

      await post('auth/revoke-other-sessions', his.cookie).expect(200);
      await post('auth/revoke-sessions', his.cookie).expect(200);

      await get('users/me', hers.cookie).expect(200);
      await get('users/me', hersToo.cookie).expect(200);
      expect((await listSessions(hers.cookie)).sort()).toEqual([hers.token, hersToo.token].sort());
      expect(await auditRows(elena.id, 'auth.sessions_revoked')).toEqual([]);
      // His own session did end, by the last call: that one is recorded, and the attempt on hers still is not.
      expect((await auditRows(dario.id, 'auth.sessions_revoked')).map(row => row.metadata)).not.toContainEqual({ scope: 'one' });
      expect((await auditRows(dario.id, 'auth.sessions_revoked')).map(row => row.metadata)).toContainEqual({ scope: 'all' });
    });
  });

  describe('a password found breached', () => {
    it('shuts every data route with 409 PASSWORD_CHANGE_REQUIRED, leaves /users/me and Better Auth’s own, and a change opens them again', async () => {
      const { id, email } = await account('fermin', 'Fermín Carrasco');
      const session = await signIn(email);
      const leaving = await signIn(email);

      // Open before the mark, so the 409 below is the mark's and nothing else's.
      await get('profile', session.cookie).expect(200);
      expect(code(await get('meal-plans/active', session.cookie).expect(409))).toBe('ONBOARDING_INCOMPLETE');

      await mark(id);

      const me = await get('users/me', session.cookie).expect(200);

      expect(me.body as Me).toMatchObject({ hasPassword: true, passwordChangeRequired: true });

      expect(code(await get('profile', session.cookie).expect(409))).toBe('PASSWORD_CHANGE_REQUIRED');
      expect(code(await request(server()).patch(`/${PREFIX}/profile`).set('Cookie', session.cookie).send({ locale: 'es' }).expect(409))).toBe(
        'PASSWORD_CHANGE_REQUIRED'
      );
      // Before onboarding: the mark is what the person must deal with first.
      expect(code(await get('meal-plans/active', session.cookie).expect(409))).toBe('PASSWORD_CHANGE_REQUIRED');
      // `@AllowUnverified()` is not an exemption: only GET and DELETE /users/me are.
      expect(code(await get('settings', session.cookie).expect(409))).toBe('PASSWORD_CHANGE_REQUIRED');

      // Better Auth's own routes stay reachable: the sessions, and leaving.
      expect((await listSessions(session.cookie)).sort()).toEqual([session.token, leaving.token].sort());
      await post('auth/sign-out', leaving.cookie).expect(200);
      await get('users/me', leaving.cookie).expect(404);

      const changed = await change(session.cookie, { currentPassword: ORIGINAL, newPassword: 'violet-kettle-umbrella-8' });

      expect(changed.status).toBe(200);
      expect(await markOf(id)).toBeNull();

      const renewed = cookiesOf(changed);
      const after = await get('users/me', renewed).expect(200);

      expect(after.body as Me).toMatchObject({ hasPassword: true, passwordChangeRequired: false });
      await get('profile', renewed).expect(200);
      expect(code(await get('meal-plans/active', renewed).expect(409))).toBe('ONBOARDING_INCOMPLETE');
      await get('settings', renewed).expect(200);

      const rows = await auditRows(id, 'auth.password_changed');

      expect(rows.map(row => row.metadata)).toEqual([{ via: 'change' }]);
      await until(() => mailsTo(email).length === 1, 'The "password changed" mail');
    });

    it('cannot be cleared through Better Auth’s update-user: the field is not input', async () => {
      const { id, email } = await account('kevin', 'Kevin Aldana');
      const session = await signIn(email);

      await mark(id);

      const refused = await post('auth/update-user', session.cookie, { passwordCompromisedAt: null });

      expect(refused.status).toBe(400);
      expect(await markOf(id)).not.toBeNull();

      expect(code(await get('profile', session.cookie).expect(409))).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('refuses the same password back, by change or by reset, with PASSWORD_COMPROMISED, and the mark stays', async () => {
      const { id, email } = await account('luis', 'Luis Arriaga');
      const session = await signIn(email);
      const elsewhere = await signIn(email);

      await mark(id);

      // A wrong current password is the route's own refusal, whatever the new one is: the hook is no oracle for the stored hash.
      const guessed = await change(session.cookie, { currentPassword: 'a-guess-at-the-password-5', newPassword: 'a-guess-at-the-password-5' });

      expect(guessed.status).toBe(400);
      expect(code(guessed)).toBe('INVALID_PASSWORD');

      // HIBP is off under NODE_ENV=test: this is the comparison with the stored hash, nothing else.
      const changed = await change(session.cookie, { currentPassword: ORIGINAL, newPassword: ORIGINAL });

      expect(changed.status).toBe(400);
      expect(code(changed)).toBe('PASSWORD_COMPROMISED');
      expect(await markOf(id)).not.toBeNull();
      expect(code(await get('profile', session.cookie).expect(409))).toBe('PASSWORD_CHANGE_REQUIRED');
      // Refused, so nothing was revoked.
      await get('users/me', elsewhere.cookie).expect(200);

      const token = `account-security-same-${String(stamp)}`;

      await sql()`
        insert into verification (id, identifier, value, expires_at, created_at, updated_at)
        values (${token}, ${`reset-password:${token}`}, ${id}, now() + interval '1 hour', now(), now())`;

      const reset = await request(server()).post(`/${PREFIX}/auth/reset-password`).send({ newPassword: ORIGINAL, token });

      expect(reset.status).toBe(400);
      expect(code(reset)).toBe('PASSWORD_COMPROMISED');
      expect(await markOf(id)).not.toBeNull();
      expect(code(await get('profile', session.cookie).expect(409))).toBe('PASSWORD_CHANGE_REQUIRED');

      // Refusals all: no row, no mail.
      expect(await auditRows(id, 'auth.password_changed')).toEqual([]);
      await pause(500);
      expect(mailsTo(email)).toEqual([]);

      // The refusal did not spend the token: the same link with a new password goes through and clears the mark.
      await request(server()).post(`/${PREFIX}/auth/reset-password`).send({ newPassword: 'saffron-meadow-ladder-9', token }).expect(200);
      expect(await markOf(id)).toBeNull();
      expect((await auditRows(id, 'auth.password_changed')).map(row => row.metadata)).toEqual([{ via: 'reset' }]);
      await sql()`delete from verification where id = ${token}`;
    });

    it('still lets a marked account delete itself', async () => {
      const { id, email } = await account('gema', 'Gema Villalobos');
      const session = await signIn(email);

      await mark(id);
      await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', session.cookie).expect(204);

      const [row] = await sql()<{ n: number }>`select count(*)::int as n from "user" where id = ${id}`;

      expect(row?.n).toBe(0);
    });

    it('is cleared by a reset too, which writes {via: reset} and sends the same mail', async () => {
      const { id, email } = await account('hugo', 'Hugo Benavente');

      await mark(id);

      // The row a reset request writes, written here: Better Auth allows three requests a minute, and the
      // reset is what is under test, not the request. The mail that request sends is `passwords.e2e-spec.ts`'s.
      const token = `account-security-reset-${String(stamp)}`;

      await sql()`
        insert into verification (id, identifier, value, expires_at, created_at, updated_at)
        values (${token}, ${`reset-password:${token}`}, ${id}, now() + interval '1 hour', now(), now())`;

      await request(server())
        .post(`/${PREFIX}/auth/reset-password`)
        .set('Accept-Language', 'es')
        .set('User-Agent', IPHONE)
        .send({ newPassword: 'cobalt-harbour-willow-7', token })
        .expect(200);

      expect(await markOf(id)).toBeNull();

      const session = await signIn(email, 'cobalt-harbour-willow-7');
      const me = await get('users/me', session.cookie).expect(200);

      expect(me.body as Me).toMatchObject({ passwordChangeRequired: false });
      await get('profile', session.cookie).expect(200);

      const rows = await auditRows(id, 'auth.password_changed');

      expect(rows.map(row => row.metadata)).toEqual([{ via: 'reset' }]);
      await until(() => mailsTo(email).length === 1, 'The "password changed" mail after a reset');
      expect(mailsTo(email)[0]?.text).not.toMatch(HEALTH_WORDS);
    });

    it('comes after both locks: an unconfirmed address first, then an unopened account, then the mark', async () => {
      const { id, email } = await signUp('irene', 'Irene Gallardo');
      const session = await signIn(email);

      await mark(id);
      expect(code(await get('profile', session.cookie).expect(409))).toBe('EMAIL_NOT_VERIFIED');

      await UserController.confirmAddress(email);
      expect(code(await get('profile', session.cookie).expect(409))).toBe('ACCOUNT_NOT_ACTIVATED');

      await activate(email);
      expect(code(await get('profile', session.cookie).expect(409))).toBe('PASSWORD_CHANGE_REQUIRED');
    });
  });

  describe('what is left behind', () => {
    it('the mark is a timestamp and nothing else of the password sits on the account', async () => {
      const columns = await sql()<{ name: string; type: string }>`
        select column_name as name, data_type as type from information_schema.columns
        where table_name = 'user' and table_schema = current_schema() and column_name like '%password%'`;

      expect(columns).toEqual([{ name: 'password_compromised_at', type: 'timestamp with time zone' }]);
    });

    it('no token, address or user agent in an audit row this suite caused, and no request to HIBP', async () => {
      const rows = await sql()<AuditMeta & { action: string }>`
        select action, metadata, ip_hash as "ipHash" from audit_logs
        where created_at >= ${started} and action in ('auth.password_changed', 'auth.sessions_revoked')`;

      // Two changes and a reset, three scopes, and whatever the isolation case's own revokes wrote.
      expect(rows.length).toBeGreaterThanOrEqual(6);

      for (const row of rows) {
        const said = JSON.stringify(row.metadata ?? {});

        expect(row.ipHash).toBeNull();
        expect(Object.keys(row.metadata ?? {})).toEqual([row.action === 'auth.password_changed' ? 'via' : 'scope']);
        expect(said).not.toMatch(/Mozilla|iPhone|127\.0\.0\.1|::1|::ffff/);

        for (const token of tokens) {
          expect(said).not.toContain(token);
        }
      }

      // The one attempt is the tripwire's own check in `beforeAll`; the API made none.
      expect(hibpAttempts()).toBe(1);
    });
  });
});
