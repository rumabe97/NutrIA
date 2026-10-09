import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { UserController } from 'core/controllers/User';
import { signInBrakeKey } from 'core/domain/SignInBrake';
import { database } from 'database';

import {
  CookieJar,
  createApp,
  deleteAccountByEmail,
  deleteAccounts,
  enableTotp,
  httpServer,
  paced,
  PREFIX,
  register,
  ScriptedAiClient,
  TotpClock
} from './harness.js';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The browser that signed in before is not braked (PLAN 011 phase 7b, decision
 * 0089), against the real database and the real Better Auth: a completed
 * password sign-in sets the `sign_in_device` cookie, and a request carrying a
 * cookie earned for the account that owns the typed address is neither
 * refused nor counted by the per-address brake (`sign-in-brake.e2e-spec.ts`).
 *
 * - the cookie is `HttpOnly`, `SameSite=Lax`, ninety days; the table holds the
 *   SHA-256 of its token beside the account's id, and nowhere the token or an
 *   address;
 * - a braked address still lets its owner's browser in, and still answers 429
 *   to everyone else, whatever they type;
 * - the cookie exempts that account's address and no other: a request for
 *   another address, or one with no account, gets the very 429 a request with
 *   no cookie gets;
 * - the cookie waives the brake and nothing else: a wrong password with it is
 *   401, and is not counted;
 * - a change or a reset of the password ends every cookie;
 * - an account with a second factor earns the cookie only when the code
 *   finishes the sign-in, and the cookie does not skip the code;
 * - the daily sweep deletes an expired device row and keeps a live one.
 *
 * The suite sends each client from an address of its own (`X-Forwarded-For`)
 * and keeps a cookie jar per browser. It computes the digest itself, with
 * nothing of the product's own code. No mail is sent, no model is called.
 *
 * Requires a real database — see ./README.md.
 */
type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;
type Browser = { readonly id: string; readonly email: string; readonly jar: CookieJar };

const PASSWORD = 'correct-horse-battery-staple-9';
const WRONG = 'not-the-password-at-all-9';
/** Better Auth prefixes it (`better-auth.sign_in_device`; `__Secure-` in production), as it does the session's. */
const DEVICE = 'sign_in_device';
const DEVICE_LINE = /^(?:__Secure-)?(?:[\w-]+\.)?sign_in_device=/;
const DEVICE_ROW = /^sign-in-device:[0-9a-f]{64}$/;
const NINETY_DAYS = 90 * 24 * 60 * 60;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

function setCookies(response: Response): string[] {
  return (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
}

function deviceLine(response: Response): string | undefined {
  return setCookies(response).find(line => DEVICE_LINE.test(line));
}

function hasSession(response: Response): boolean {
  return setCookies(response).some(line => /session_token=[^;]/.test(line));
}

/** `name=value`, the part of a `Set-Cookie` line a browser sends back. */
function pairOf(line: string | undefined): string {
  return line?.split(';')[0] ?? '';
}

function tokenOf(line: string | undefined): string {
  return pairOf(line).split('=').slice(1).join('=');
}

function digestOf(token: string): string {
  return `sign-in-device:${createHash('sha256').update(token).digest('hex')}`;
}

describe('a browser that signed in before is not braked', () => {
  let app: INestApplication;
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const addressOf = (name: string) => `device-${name}-${stamp}@e2e.invalid`;
  const cronSecret = randomBytes(24).toString('hex');
  const previousCronSecret = process.env['CRON_SECRET'];
  const keyOf = (email: string) => signInBrakeKey(email, process.env['BETTER_AUTH_SECRET'] ?? '');
  const brakeKeys: string[] = [];
  const userIds: string[] = [];
  /** Accounts to delete in `afterAll`, with the password each ends up with. */
  const made: { email: string; password: string }[] = [];
  const sessions: string[] = [];
  let clients = 0;

  const server = () => httpServer(app);

  /** A different address for every call, as a different client. */
  function clientAddress(): string {
    clients += 1;

    return `198.51.100.${clients}`;
  }

  /** `browser` is a jar the response is taken into, or the bare `Cookie` header of a client that keeps nothing. */
  async function signIn(email: string, password: string, browser?: CookieJar | string, from: string = clientAddress()): Promise<Response> {
    const header = typeof browser === 'string' ? browser : browser?.header;
    const response = await paced(() => {
      const sent = request(server()).post(`/${PREFIX}/auth/sign-in/email`).set('X-Forwarded-For', from);

      return (header === undefined ? sent : sent.set('Cookie', header)).send({ email, password });
    });

    if (browser instanceof CookieJar) {
      browser.take(response);
    }

    return response;
  }

  async function brakeRow(email: string): Promise<{ count: number; next_allowed_at: Date | null } | undefined> {
    const [row] = await sql()<{ count: number; next_allowed_at: Date | null }>`
      select count, next_allowed_at from sign_in_failure where key = ${keyOf(email)}`;

    return row;
  }

  /** Somebody with no cookie guesses at the address until it waits: the wrong passwords, then the 429. */
  async function brake(email: string): Promise<void> {
    brakeKeys.push(keyOf(email));

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await signIn(email, WRONG);

      if (response.status === 429) {
        return;
      }

      expect(response.status).toBe(401);
    }

    throw new Error(`${email} was not braked after twelve wrong passwords`);
  }

  /** Signs up, confirms the address as its link would, and signs in with a browser of its own. */
  async function accountWithBrowser(name: string, password = PASSWORD): Promise<Browser> {
    const email = addressOf(name);
    const signUp = await paced(() => request(server()).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Device', password }));

    expect(signUp.status).toBe(200);
    made.push({ email, password });
    await UserController.confirmAddress(email);

    const jar = new CookieJar();
    const signedIn = await signIn(email, password, jar);

    expect(signedIn.status).toBe(200);

    const id = (signedIn.body as { user: { id: string } }).user.id;

    userIds.push(id);
    brakeKeys.push(keyOf(email));

    return { id, email, jar };
  }

  async function devicesOf(userId: string): Promise<string[]> {
    const rows = await sql()<{ identifier: string }>`
      select identifier from verification where value = ${userId} and identifier like 'sign-in-device:%' order by identifier`;

    return rows.map(row => row.identifier);
  }

  beforeAll(async () => {
    process.env['CRON_SECRET'] = cronSecret;
    app = await createApp(new ScriptedAiClient([]));
  });

  afterAll(async () => {
    // Before the clean-up signs in: a brake left standing would refuse it and leave the account behind.
    await sql()`delete from sign_in_failure where key = any(${brakeKeys})`;

    // The clean-up signs in, which earns cookies: every account's id is known before it is gone, to delete those rows after.
    const known = await sql()<{ id: string }>`select id from "user" where email = any(${made.map(account => account.email)})`;

    userIds.push(...known.map(row => row.id));
    await deleteAccounts(app, sessions);

    for (const { email, password } of made) {
      try {
        await deleteAccountByEmail(app, email, password);
      } catch {
        // An account that could not be signed in to (a failed test left it half-made) is left for the run's final check to name.
      }
    }

    // The clean-up's own sign-ins earned cookies too, and a deleted account's rows stay until they expire.
    await sql()`delete from sign_in_failure where key = any(${brakeKeys})`;
    await sql()`delete from verification where identifier like 'sign-in-device:%' and value = any(${userIds})`;
    await sql()`delete from verification where identifier like 'sign-in-device:%' and value like ${`e2e-device-${stamp}%`}`;

    if (previousCronSecret === undefined) {
      delete process.env['CRON_SECRET'];
    } else {
      process.env['CRON_SECRET'] = previousCronSecret;
    }

    await app?.close();
  });

  let ana: Browser;
  let anaToken = '';

  it('sets the cookie on a password sign-in, and keeps in the table only its digest beside the account', async () => {
    const email = addressOf('ana');
    const signUp = await paced(() => request(server()).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Ana', password: PASSWORD }));

    expect(signUp.status).toBe(200);
    made.push({ email, password: PASSWORD });
    await UserController.confirmAddress(email);

    // Signing up opens no device: only a password sign-in earns one.
    expect(deviceLine(signUp)).toBeUndefined();

    const jar = new CookieJar();
    const signedIn = await signIn(email, PASSWORD, jar);
    const id = (signedIn.body as { user: { id: string } }).user.id;

    userIds.push(id);
    brakeKeys.push(keyOf(email));
    ana = { id, email, jar };

    expect(signedIn.status).toBe(200);
    expect(hasSession(signedIn)).toBe(true);

    const line = deviceLine(signedIn);

    expect(line).toBeDefined();
    expect(line).toMatch(/;\s*HttpOnly/i);
    expect(line).toMatch(/;\s*SameSite=Lax/i);
    expect(line).toMatch(/;\s*Path=\//i);
    expect(Number(/Max-Age=(\d+)/i.exec(line ?? '')?.[1])).toBe(NINETY_DAYS);

    anaToken = tokenOf(line);
    expect(anaToken.length).toBeGreaterThanOrEqual(40);

    const rows = await sql()<{ identifier: string; value: string }>`
      select identifier, value from verification where value = ${id} and identifier like 'sign-in-device:%'`;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.identifier).toMatch(DEVICE_ROW);
    expect(rows[0]?.identifier).toBe(digestOf(anaToken));

    // Neither the token nor the address is anywhere in any device row, and the value is the account's id.
    const everyRow = JSON.stringify(await sql()`select * from verification where identifier like 'sign-in-device:%'`);

    expect(everyRow).not.toContain(anaToken);
    expect(everyRow).not.toContain(email);
    expect(everyRow).not.toContain('device-ana');
  });

  it('renews the same cookie, and the same row, when the browser signs in again', async () => {
    const again = await signIn(ana.email, PASSWORD, ana.jar);

    expect(again.status).toBe(200);
    expect(tokenOf(deviceLine(again))).toBe(anaToken);
    expect(await devicesOf(ana.id)).toEqual([digestOf(anaToken)]);
  });

  it('does not count the typos of a browser that signed in before, and answers each 401', async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const wrong = await signIn(ana.email, WRONG, ana.jar);

      expect(wrong.status).toBe(401);
      expect(hasSession(wrong)).toBe(false);
    }

    // Twelve wrong passwords would have braked the address at the tenth: no row at all.
    expect(await brakeRow(ana.email)).toBeUndefined();
  });

  it('still lets the cookie in when the address is braked, and still answers 429 to anybody else', async () => {
    await brake(ana.email);

    const stranger = await signIn(ana.email, PASSWORD);

    expect(stranger.status).toBe(429);
    expect(stranger.body).toEqual({ code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Try again later.' });
    expect(Number(stranger.headers['retry-after'])).toBeGreaterThan(0);
    expect(hasSession(stranger)).toBe(false);

    // Another browser of hers, signed in to nothing yet, is a stranger too: no cookie, no way past.
    expect((await signIn(ana.email, PASSWORD, new CookieJar())).status).toBe(429);

    const owner = await signIn(ana.email, PASSWORD, ana.jar);

    expect(owner.status).toBe(200);
    expect(hasSession(owner)).toBe(true);
    expect(tokenOf(deviceLine(owner))).toBe(anaToken);
  });

  it('answers a wrong password to the cookie with 401, and the address’s count does not move', async () => {
    await brake(ana.email);

    const before = await brakeRow(ana.email);

    expect(before?.count).toBeGreaterThanOrEqual(10);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wrong = await signIn(ana.email, WRONG, ana.jar);

      expect(wrong.status).toBe(401);
      expect(wrong.headers['retry-after']).toBeUndefined();
      expect(hasSession(wrong)).toBe(false);
    }

    expect(await brakeRow(ana.email)).toEqual(before);
    // The braked address stays braked for a stranger.
    expect((await signIn(ana.email, PASSWORD)).status).toBe(429);
  });

  it('does not exempt another address: the 429 is the one no cookie gets, with an account or without', async () => {
    const bea = addressOf('bea');
    const ghost = addressOf('ghost');
    const signUp = await paced(() => request(server()).post(`/${PREFIX}/auth/sign-up/email`).send({ email: bea, name: 'Bea', password: PASSWORD }));

    expect(signUp.status).toBe(200);
    made.push({ email: bea, password: PASSWORD });
    await UserController.confirmAddress(bea);
    await brake(bea);
    await brake(ghost);

    for (const target of [bea, ghost]) {
      const bare = await signIn(target, PASSWORD);
      const withCookie = await signIn(target, PASSWORD, ana.jar);

      expect(bare.status).toBe(429);
      expect(withCookie.status).toBe(429);
      expect(hasSession(withCookie)).toBe(false);
      expect(deviceLine(withCookie)).toBeUndefined();
      expect(withCookie.body).toEqual(bare.body);
      expect(Object.keys(withCookie.headers).sort()).toEqual(Object.keys(bare.headers).sort());
      // The wait ticks down between the two requests: a second at most.
      expect(Math.abs(Number(withCookie.headers['retry-after']) - Number(bare.headers['retry-after']))).toBeLessThanOrEqual(1);
      expect(withCookie.headers['x-retry-after']).toBe(withCookie.headers['retry-after']);
    }
  });

  describe('a change of password', () => {
    it('ends the cookies of the account, and the old one no longer gets in past a brake', async () => {
      const cleo = await accountWithBrowser('cleo');
      const token = tokenOf(cleo.jar.only(DEVICE));

      expect(await devicesOf(cleo.id)).toEqual([digestOf(token)]);

      // Before: the cookie works.
      await brake(cleo.email);
      expect((await signIn(cleo.email, PASSWORD, cleo.jar)).status).toBe(200);

      const renewed = 'violet-kettle-umbrella-8';
      const changed = await paced(() =>
        request(server())
          .post(`/${PREFIX}/auth/change-password`)
          .set('Cookie', cleo.jar.header)
          .send({ currentPassword: PASSWORD, newPassword: renewed })
      );

      expect(changed.status).toBe(200);
      cleo.jar.take(changed);
      made[made.findIndex(account => account.email === cleo.email)] = { email: cleo.email, password: renewed };

      expect(await devicesOf(cleo.id)).toEqual([]);

      // The browser still holds the cookie; it points at nothing.
      expect(cleo.jar.has(DEVICE)).toBe(true);

      await brake(cleo.email);

      const refused = await signIn(cleo.email, renewed, cleo.jar);

      expect(refused.status).toBe(429);
      expect(hasSession(refused)).toBe(false);
      expect(await devicesOf(cleo.id)).toEqual([]);
    });
  });

  describe('a change of password, then a braked address', () => {
    it('answers the old cookie the very 429 a request with no cookie gets', async () => {
      const eve = await accountWithBrowser('eve');
      const renewed = 'lantern-orchard-copper-7';
      const changed = await paced(() =>
        request(server())
          .post(`/${PREFIX}/auth/change-password`)
          .set('Cookie', eve.jar.header)
          .send({ currentPassword: PASSWORD, newPassword: renewed })
      );

      expect(changed.status).toBe(200);
      eve.jar.take(changed);
      made[made.findIndex(account => account.email === eve.email)] = { email: eve.email, password: renewed };

      await brake(eve.email);

      const bare = await signIn(eve.email, renewed);
      const withCookie = await signIn(eve.email, renewed, eve.jar);

      expect(bare.status).toBe(429);
      expect(withCookie.status).toBe(429);
      expect(withCookie.body).toEqual(bare.body);
      expect(Object.keys(withCookie.headers).sort()).toEqual(Object.keys(bare.headers).sort());
      expect(Math.abs(Number(withCookie.headers['retry-after']) - Number(bare.headers['retry-after']))).toBeLessThanOrEqual(1);
      expect(withCookie.headers['x-retry-after']).toBe(withCookie.headers['retry-after']);
      expect(hasSession(withCookie)).toBe(false);
      expect(deviceLine(withCookie)).toBeUndefined();
    });
  });

  describe('a reset of the password', () => {
    it('ends the cookies of the account, and the old one no longer gets in past a brake', async () => {
      const dani = await accountWithBrowser('dani');

      expect(await devicesOf(dani.id)).toHaveLength(1);

      await paced(() => request(server()).post(`/${PREFIX}/auth/request-password-reset`).send({ email: dani.email })).then(response =>
        expect(response.status).toBe(200)
      );

      // Read from the table, not from the mail: nothing is sent here.
      const [row] = await sql()<{ identifier: string }>`
        select identifier from verification where value = ${dani.id} and identifier like 'reset-password:%' order by created_at desc limit 1`;
      const resetToken = row?.identifier.slice('reset-password:'.length) ?? '';

      expect(resetToken).not.toBe('');

      const renewed = 'harbor-pencil-meadow-6';
      const reset = await paced(() => request(server()).post(`/${PREFIX}/auth/reset-password`).send({ newPassword: renewed, token: resetToken }));

      expect(reset.status).toBe(200);
      made[made.findIndex(account => account.email === dani.email)] = { email: dani.email, password: renewed };

      expect(await devicesOf(dani.id)).toEqual([]);
      expect(dani.jar.has(DEVICE)).toBe(true);

      await brake(dani.email);

      const refused = await signIn(dani.email, renewed, dani.jar);

      expect(refused.status).toBe(429);
      expect(hasSession(refused)).toBe(false);
    });
  });

  describe('an account with the authenticator app on', () => {
    it('earns no cookie from the password alone, earns it from the code, and the cookie does not skip the code', async () => {
      const email = addressOf('tess');
      const plain = await register(app, email);
      const clock = new TotpClock();

      // Deleted through its verified session below, not by `made`: signing in again would ask for a code.
      userIds.push(plain.id);
      brakeKeys.push(keyOf(email));

      // `register` signed in once with the password: one device, before the factor existed.
      expect(await devicesOf(plain.id)).toHaveLength(1);

      const withFactor = await enableTotp(app, plain);

      sessions.push(withFactor.cookie);
      // The code that turns the factor on, with a session already open, earns nothing.
      expect(await devicesOf(plain.id)).toHaveLength(1);

      const jar = new CookieJar();
      const challenge = await signIn(email, PASSWORD, jar);

      // The right password alone: the challenge, no session, no cookie, no new row.
      expect(challenge.status).toBe(200);
      expect((challenge.body as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBe(true);
      expect(hasSession(challenge)).toBe(false);
      expect(deviceLine(challenge)).toBeUndefined();
      expect(jar.has(DEVICE)).toBe(false);
      expect(await devicesOf(plain.id)).toHaveLength(1);

      // The code that finishes it earns the cookie.
      clock.claim(withFactor.totpURI, Math.floor(Date.now() / 30_000));

      const code = await clock.fresh(withFactor.totpURI);
      const finished = await paced(() =>
        request(server())
          .post(`/${PREFIX}/auth/two-factor/verify-totp`)
          .set('Cookie', jar.header)
          .set('X-Forwarded-For', clientAddress())
          .send({ code })
      );

      expect(finished.status).toBe(200);
      expect(hasSession(finished)).toBe(true);
      jar.take(finished);
      sessions.push(jar.header);

      const line = deviceLine(finished);

      expect(line).toBeDefined();
      expect(line).toMatch(/;\s*HttpOnly/i);
      expect(await devicesOf(plain.id)).toContain(digestOf(tokenOf(line)));
      expect(await devicesOf(plain.id)).toHaveLength(2);

      // The cookie waives the brake and nothing else: past it the password is still followed by the challenge.
      await brake(email);

      const past = await signIn(email, PASSWORD, pairOf(line));

      expect(past.status).toBe(200);
      expect((past.body as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBe(true);
      expect(hasSession(past)).toBe(false);
    });
  });

  describe('the daily sweep', () => {
    it('deletes an expired device row and keeps a live one', async () => {
      const owner = `e2e-device-${stamp}`;
      const expired = `sign-in-device:${randomBytes(32).toString('hex')}`;
      const live = `sign-in-device:${randomBytes(32).toString('hex')}`;

      await sql()`
        insert into verification (id, identifier, value, expires_at, created_at, updated_at)
        values (${randomUUID()}, ${expired}, ${`${owner}-a`}, now() - interval '2 days', now() - interval '92 days', now() - interval '92 days'),
               (${randomUUID()}, ${live}, ${`${owner}-b`}, now() + interval '30 days', now(), now())`;

      const swept: Response = await request(server())
        .get(`/${PREFIX}/cron/sweep-verifications`)
        .set('Authorization', `Bearer ${cronSecret}`)
        .expect(200);

      expect((swept.body as { deleted: number }).deleted).toBeGreaterThanOrEqual(1);

      const left = await sql()<{ identifier: string }>`select identifier from verification where identifier = any(${[expired, live]})`;

      expect(left.map(row => row.identifier)).toEqual([live]);
    });
  });
});
