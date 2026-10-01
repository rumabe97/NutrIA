import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { hashPassword } from 'better-auth/crypto';

import { SettingsController } from 'core/controllers/Settings';
import { database } from 'database';

import { EmailService } from '../src/modules/email/services/index.js';
import { activate, CookieJar, createApp, deleteAccountByEmail, httpServer, PREFIX, ScriptedAiClient, totpCode, totpSecret } from './harness.js';
import { hibpAttempts, hibpTripwireInstalled } from './hibp-tripwire.js';

import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * A second factor (project 011, phase 3): Better Auth's `twoFactor` plugin,
 * used as it is, with the product's hooks around it.
 *
 * - `/two-factor/enable` makes an unverified secret and turns nothing on; the
 *   first right `/two-factor/verify-totp` does, and only then is
 *   `auth.2fa_enabled` written and its mail sent;
 * - with the factor on, `/sign-in/email` answers `twoFactorRedirect` and no
 *   usable session, and only a TOTP code or a backup code finishes it;
 * - a backup code works once (`auth.backup_code_used {remaining}`, and a mail);
 * - turning it off and new backup codes both need the password; new codes
 *   write `auth.backup_codes_regenerated` and send a mail; turning off what is
 *   already off writes and sends nothing;
 * - Google is never joined implicitly to an account with the factor on; the
 *   signed-in owner can still join it on purpose;
 * - `/two-factor/get-totp-uri` is the guard's 404;
 * - a trusted device is forgotten when the factor is turned off and on again,
 *   the password changes or is reset, or every session is revoked;
 * - a reset or a password change neither skips the challenge nor turns it off;
 * - an account with no password (Google only) cannot turn it on: the guard's 404;
 * - email OTP is not offered and grants nothing;
 * - one `session_started` per real sign-in, with the factor or without it;
 * - the secret and the codes are nowhere but the two responses that hand them
 *   to their owner.
 *
 * The codes are computed here from the `otpauth://` URI, the way a phone does
 * (`harness.ts` → `totpCode`), with nothing of the product's own code. Google
 * is never called: its token exchange is answered by the test, as in
 * `social-sign-in.e2e-spec.ts`. Mail is caught at `EmailService.send`, as in
 * `account-security.e2e-spec.ts`; nothing is sent. HIBP stays unreachable
 * (`hibp-tripwire.ts`).
 *
 * Requires a real database — see ./README.md.
 */
const ORIGINAL = 'correct-horse-battery-staple-9';
/** Used only to delete what is left: written straight into an account's credential, then signed in with. */
const CLEANUP_PASSWORD = 'quiet-orchard-lamp-velvet-3';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ENABLED_MAIL = /activado la verificaci[oó]n en dos pasos/i;
const DISABLED_MAIL = /desactivado la verificaci[oó]n en dos pasos/i;
const BACKUP_MAIL = /c[oó]digo de respaldo/i;
const REGENERATED_MAIL = /c[oó]digos de respaldo nuevos/i;
/** M14: the mail says nothing of health. */
const HEALTH_WORDS = /alerg|allerg|salud|health|dieta|diet\b|peso|weight|calor|medic|embaraz|pregnan/i;
const GOOGLE = { clientId: 'nutria-e2e.apps.googleusercontent.com', clientSecret: 'not-a-real-secret' };
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const APP = 'http://localhost:3000';

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;
type Made = { readonly id: string; readonly email: string };
type WithFactor = Made & { readonly backupCodes: readonly string[]; readonly jar: CookieJar; readonly uri: string };
type AuditRow = {
  readonly actorId: string | null;
  readonly entity: string;
  readonly entityId: string | null;
  readonly ipHash: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly subjectUserId: string | null;
};
type TwoFactorRow = { readonly backupCodes: string; readonly secret: string; readonly verified: boolean | null };

function code(response: Response): string | undefined {
  return (response.body as { code?: string }).code;
}

function pause(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/** Every cookie a response set, joined as they come — expired ones included, as a careless client would send them back. */
function rawCookies(response: Response): string {
  return ((response.headers['set-cookie'] as unknown as string[] | undefined) ?? []).map(cookie => cookie.split(';')[0]).join('; ');
}

function part(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Shaped like Google's, signed by nobody: the callback reads the claims of a token it fetched itself over TLS. */
function idToken(email: string, sub: string): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: GOOGLE.clientId,
    email,
    email_verified: true,
    exp: now + 3600,
    iat: now,
    iss: 'https://accounts.google.com',
    name: 'Gala',
    sub
  };

  return `${part({ alg: 'RS256', typ: 'JWT' })}.${part(claims)}.unsigned`;
}

/** A code outside the server's ±1 window, and none of the three inside it. */
function wrongCode(uri: string): string {
  const accepted = new Set([-1, 0, 1].map(steps => totpCode(uri, steps)));

  for (let steps = 3; ; steps += 1) {
    const candidate = totpCode(uri, steps);

    if (!accepted.has(candidate)) {
      return candidate;
    }
  }
}

describe('two-factor: a second factor on Better Auth’s own plugin', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pattern = `two-factor-%-${String(stamp)}@e2e.invalid`;
  const sql = (): Sql => (database() as unknown as { readonly $client: Sql }).$client;
  const realFetch = globalThis.fetch;
  const outbox: OutgoingEmail[] = [];
  const logged: string[] = [];
  const restoreLogs: (() => void)[] = [];
  /** Every secret and backup code this suite was handed: they may appear in the enable and generate responses and nowhere else. */
  const secrets: string[] = [];
  /** Every TOTP code this suite typed. */
  const codes: string[] = [];
  /** Every response body but enable's and generate's, so the end can look for the secret in them. */
  const bodies: string[] = [];
  const ids: string[] = [];
  let googleCookie = '';
  let googleSub = '';
  let googleEmail = '';
  let started = '';

  const server = () => httpServer(app);
  const emailFor = (label: string) => `two-factor-${label}-${String(stamp)}@e2e.invalid`;
  const mailsTo = (email: string, subject: RegExp) => outbox.filter(mail => mail.to === email && subject.test(`${mail.subject}\n${mail.text}`));

  function seen(response: Response): Response {
    bodies.push(JSON.stringify(response.body ?? {}));

    return response;
  }

  async function post(path: string, cookie: string, body: object = {}): Promise<Response> {
    return seen(
      await request(server()).post(`/${PREFIX}/${path}`).set('Cookie', cookie).set('User-Agent', IPHONE).set('Accept-Language', 'es').send(body)
    );
  }

  async function get(path: string, cookie: string): Promise<Response> {
    return seen(await request(server()).get(`/${PREFIX}/${path}`).set('Cookie', cookie).set('User-Agent', IPHONE));
  }

  async function account(label: string, name: string): Promise<Made> {
    const email = emailFor(label);
    const made = await request(server())
      .post(`/${PREFIX}/auth/sign-up/email`)
      .set('User-Agent', IPHONE)
      .send({ email, name, password: ORIGINAL })
      .expect(200);
    const id = (made.body as { user: { id: string } }).user.id;

    ids.push(id);
    // Sign-up signs the person in, and this suite keeps no cookie of that session: gone, so every count is the tests' own.
    await sql()`delete from session where user_id = ${id}`;
    await activate(email);

    return { id, email };
  }

  /** `/sign-in/email`, with whatever cookies the browser already holds. */
  async function signIn(email: string, password = ORIGINAL, cookie = ''): Promise<Response> {
    return post('auth/sign-in/email', cookie, { email, password });
  }

  /** A sign-in the factor does not interrupt: the session lands in a fresh jar. */
  async function signedIn(email: string, password = ORIGINAL): Promise<CookieJar> {
    const response = await signIn(email, password);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ token: expect.any(String) });
    expect(response.body).not.toHaveProperty('twoFactorRedirect');

    return new CookieJar().take(response);
  }

  /** A sign-in the factor interrupts: the challenge cookie lands in the jar, and no session does. */
  async function challenged(email: string, password = ORIGINAL, cookie = ''): Promise<{ readonly jar: CookieJar; readonly response: Response }> {
    const response = await signIn(email, password, cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ twoFactorMethods: ['totp'], twoFactorRedirect: true });

    const jar = new CookieJar().take(response);

    expect(jar.has('two_factor')).toBe(true);
    expect(jar.has('session_token')).toBe(false);

    return { jar, response };
  }

  async function enable(jar: CookieJar, password = ORIGINAL): Promise<{ readonly backupCodes: string[]; readonly totpURI: string }> {
    // Not through `post`: this is one of the two responses the secret may be in.
    const response = await request(server())
      .post(`/${PREFIX}/auth/two-factor/enable`)
      .set('Cookie', jar.header)
      .set('User-Agent', IPHONE)
      .send({ password })
      .expect(200);
    const body = response.body as { backupCodes: string[]; totpURI: string };
    const secret = totpSecret(body.totpURI);

    secrets.push(secret.base32, secret.raw, ...body.backupCodes);

    return body;
  }

  async function verifyTotp(cookie: string, typed: string, trustDevice?: boolean): Promise<Response> {
    codes.push(typed);

    return post('auth/two-factor/verify-totp', cookie, trustDevice === undefined ? { code: typed } : { code: typed, trustDevice });
  }

  /** An account with the factor on, signed in by the session the enabling verify handed back. */
  async function withFactor(label: string, name: string): Promise<WithFactor> {
    const made = await account(label, name);
    const jar = await signedIn(made.email);
    const { backupCodes, totpURI } = await enable(jar);
    const verified = await verifyTotp(jar.header, totpCode(totpURI));

    expect(verified.status).toBe(200);
    // The enabling verify swaps the session for a new one: the cookie sent is dead from here.
    jar.take(verified);
    expect(await flagOf(made.id)).toBe(true);

    return { ...made, backupCodes, jar, uri: totpURI };
  }

  /**
   * Better Auth allows three password changes in ten seconds (its own rule, which
   * the test environment does not raise): a 429 is waited out once, for as long as
   * it says, and tried again — as in `account-security.e2e-spec.ts`.
   */
  async function change(cookie: string, body: Record<string, unknown>): Promise<Response> {
    let response = await post('auth/change-password', cookie, body);

    for (let retry = 0; retry < 2 && response.status === 429; retry += 1) {
      const wait = Number(response.headers['x-retry-after'] ?? 10);

      await pause((Number.isFinite(wait) ? wait : 10) * 1000 + 500);
      response = await post('auth/change-password', cookie, body);
    }

    return response;
  }

  async function flagOf(userId: string): Promise<boolean | null> {
    const [row] = await sql()<{ on: boolean }>`select two_factor_enabled as on from "user" where id = ${userId}`;

    return row?.on ?? null;
  }

  async function twoFactorRows(userId: string): Promise<TwoFactorRow[]> {
    return sql()<TwoFactorRow>`select secret, backup_codes as "backupCodes", verified from two_factor where user_id = ${userId}`;
  }

  async function sessionsOf(userId: string): Promise<number> {
    const [row] = await sql()<{ n: number }>`select count(*)::int as n from session where user_id = ${userId}`;

    return row?.n ?? 0;
  }

  async function sessionStarts(userId: string): Promise<number> {
    const [row] = await sql()<{ n: number }>`
      select count(*)::int as n from analytics_events where user_id = ${userId} and event = 'session_started'`;

    return row?.n ?? 0;
  }

  async function auditRows(userId: string, action: string): Promise<AuditRow[]> {
    return sql()<AuditRow>`
      select actor_id as "actorId", entity, entity_id as "entityId", ip_hash as "ipHash", metadata, subject_user_id as "subjectUserId"
      from audit_logs
      where action = ${action} and created_at >= ${started} and (actor_id = ${userId} or subject_user_id = ${userId})
      order by created_at, id`;
  }

  /** The account's id where it may be, and nothing else anywhere (the phase 2 rule). */
  function expectOwnRow(row: AuditRow | undefined, userId: string): void {
    expect(row).toMatchObject({ actorId: userId, entityId: null, ipHash: null, subjectUserId: userId });
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

  /** What the session guard answers a caller with no session: the 404 every denial here must be, byte for byte. */
  async function guardsNotFound(): Promise<{ readonly status: number; readonly text: string }> {
    const answer = await request(server()).get(`/${PREFIX}/profile`);

    return { status: answer.status, text: answer.text };
  }

  /**
   * The round trip through Google as `email`/`sub`: `/sign-in/social`, or `/link-social` when `cookie` holds a session,
   * then back to `/callback/google` with whatever the start set. Returns the callback's answer.
   */
  async function throughGoogle(email: string, sub: string, cookie = ''): Promise<Response> {
    googleEmail = email;
    googleSub = sub;

    const route = cookie ? 'auth/link-social' : 'auth/sign-in/social';
    const start = await post(route, cookie, { callbackURL: `${APP}/inicio`, errorCallbackURL: `${APP}/acceder`, provider: 'google' });

    expect(start.status).toBe(200);

    const state = new URL((start.body as { url: string }).url).searchParams.get('state') ?? '';

    return request(server())
      .get(`/${PREFIX}/auth/callback/google`)
      .query({ code: 'e2e-code', state })
      .set('Cookie', [cookie, rawCookies(start)].filter(Boolean).join('; '));
  }

  async function providerAccounts(userId: string): Promise<string[]> {
    const rows = await sql()<{ provider: string }>`select provider_id as provider from account where user_id = ${userId} order by provider_id`;

    return rows.map(row => row.provider);
  }

  /** A sign-in finished with "trust this device": the `trust_device` cookie it handed back, and nothing else. */
  async function trustedDevice(email: string, uri: string, password = ORIGINAL): Promise<string> {
    const { jar } = await challenged(email, password);
    const trusted = await verifyTotp(jar.header, totpCode(uri), true);

    expect(trusted.status).toBe(200);
    expect(jar.take(trusted).has('trust_device')).toBe(true);

    return jar.only('trust_device');
  }

  /**
   * Whether the plugin still holds the row a `trust_device` cookie points at (`<hmac>!<identifier>`, signed):
   * read before the change under test, so a refused skip afterwards is the change's doing and not a cookie that was
   * dead already.
   */
  async function trustIsLive(cookie: string): Promise<boolean> {
    const value = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));
    const identifier = value.slice(0, value.lastIndexOf('.')).split('!')[1] ?? '';
    const [row] = await sql()<{ n: number }>`
      select count(*)::int as n from verification where identifier = ${identifier} and expires_at > now()`;

    expect(identifier).toMatch(/^trust-device-/);

    return (row?.n ?? 0) === 1;
  }

  /** How many trusted devices the plugin still remembers for this account: its `trust-device-*` rows, each valued with the account id. */
  async function trustRows(userId: string): Promise<number> {
    const [row] = await sql()<{ n: number }>`
      select count(*)::int as n from verification where identifier like 'trust-device-%' and value = ${userId}`;

    return row?.n ?? 0;
  }

  function words(mail: OutgoingEmail | undefined): string {
    return `${mail?.subject ?? ''}\n${mail?.text ?? ''}\n${mail?.html ?? ''}`;
  }

  /** What every mail of this phase may and may not say. */
  function expectQuietMail(mail: OutgoingEmail | undefined): void {
    const said = words(mail);

    expect(said).toMatch(/iPhone|iOS/);
    expect(said).not.toContain(IPHONE);
    expect(said).not.toMatch(/127\.0\.0\.1|::1|::ffff/);
    expect(`${mail?.subject ?? ''}\n${mail?.text ?? ''}`).not.toMatch(HEALTH_WORDS);

    for (const secret of [...secrets, ...codes]) {
      expect(said).not.toContain(secret);
    }
  }

  beforeAll(async () => {
    // The tripwire must be live before anything here could reach HIBP, or "no attempt" at the end proves nothing.
    expect(hibpTripwireInstalled()).toBe(true);
    await expect(fetch('https://api.pwnedpasswords.com/range/00000')).rejects.toThrow();
    expect(hibpAttempts()).toBe(1);

    for (const method of ['debug', 'error', 'info', 'log', 'warn'] as const) {
      const original = console[method];

      console[method] = (...line: unknown[]) => {
        logged.push(line.map(item => (typeof item === 'string' ? item : (JSON.stringify(item) ?? String(item)))).join(' '));
        original.apply(console, line);
      };

      restoreLogs.push(() => {
        console[method] = original;
      });
    }

    for (const stream of [process.stdout, process.stderr]) {
      const original = stream.write;

      stream.write = ((chunk: unknown, ...rest: unknown[]) => {
        logged.push(String(chunk));

        return (original as (...args: unknown[]) => boolean).call(stream, chunk, ...rest);
      }) as typeof stream.write;
      restoreLogs.push(() => {
        stream.write = original;
      });
    }

    // On the prototype, so whichever instance a module was handed is the one caught.
    jest.spyOn(EmailService.prototype, 'configured', 'get').mockReturnValue(true);
    jest.spyOn(EmailService.prototype, 'send').mockImplementation(message => {
      outbox.push(message);

      return Promise.resolve(true);
    });

    // Google's token exchange, answered here; everything else goes to the fetch that was there (the tripwire).
    process.env.GOOGLE_OAUTH_CLIENT_ID = GOOGLE.clientId;
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = GOOGLE.clientSecret;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (!url.startsWith(TOKEN_ENDPOINT)) {
        return realFetch(input, init);
      }

      return new Response(
        JSON.stringify({
          access_token: 'e2e-access',
          expires_in: 3600,
          id_token: idToken(googleEmail, googleSub),
          scope: 'openid email profile',
          token_type: 'Bearer'
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 }
      );
    }) as typeof fetch;

    const [clock] = await sql()<{ now: string }>`select now()::text as now`;

    started = clock?.now ?? '';
    app = await createApp(new ScriptedAiClient([]));
  });

  afterAll(async () => {
    try {
      if (googleCookie) {
        await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', googleCookie);
      }

      // Whatever this suite made, factor on or off, whatever password it ended with: the factor taken off and a
      // known password given on the table, then deleted through the product's own door.
      const left = await sql()<Made>`select id, email from "user" where email like ${pattern}`;
      const known = await hashPassword(CLEANUP_PASSWORD);

      for (const { id, email } of left) {
        await sql()`delete from two_factor where user_id = ${id}`;
        await sql()`update "user" set two_factor_enabled = false where id = ${id}`;
        await sql()`update account set password = ${known} where user_id = ${id} and provider_id = 'credential'`;
        await deleteAccountByEmail(app, email, CLEANUP_PASSWORD);
      }

      const [remaining] = await sql()<{ n: number }>`select count(*)::int as n from "user" where email like ${pattern}`;

      expect(remaining?.n ?? 0).toBe(0);
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
      delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      jest.restoreAllMocks();
      await app?.close();

      for (const restore of restoreLogs) {
        restore();
      }
    }
  });

  describe('turning it on', () => {
    it('enable makes an unverified secret and turns nothing on; a wrong first code is refused; the first right one turns it on, once', async () => {
      const { id, email } = await account('ana', 'Ana Rivas');
      const jar = await signedIn(email);

      expect((await get('users/me', jar.header)).body).toMatchObject({ hasPassword: true, twoFactorEnabled: false });

      // The password is required, and must be the right one: neither refusal leaves a secret behind.
      expect((await post('auth/two-factor/enable', jar.header, {})).status).toBe(400);
      const wrong = await post('auth/two-factor/enable', jar.header, { password: 'not-the-one-at-all-41' });

      expect(wrong.status).toBe(400);
      expect(code(wrong)).toBe('INVALID_PASSWORD');
      expect(await twoFactorRows(id)).toEqual([]);

      const { backupCodes, totpURI } = await enable(jar);
      const uri = new URL(totpURI);

      expect(uri.protocol).toBe('otpauth:');
      expect(uri.host).toBe('totp');
      expect(decodeURIComponent(uri.pathname)).toBe(`/NutrIA:${email}`);
      expect(uri.searchParams.get('issuer')).toBe('NutrIA');
      expect(backupCodes).toHaveLength(10);
      expect(new Set(backupCodes).size).toBe(10);

      // A secret, unverified, stored encrypted; nothing on yet, so nothing recorded, mailed or asked at sign-in.
      const [row] = await twoFactorRows(id);

      expect(row?.verified).toBe(false);
      expect(row?.secret).not.toContain(totpSecret(totpURI).raw);
      expect(row?.secret).not.toContain(totpSecret(totpURI).base32);

      for (const backup of backupCodes) {
        expect(row?.backupCodes).not.toContain(backup);
      }

      expect(await flagOf(id)).toBe(false);
      expect(await auditRows(id, 'auth.2fa_enabled')).toEqual([]);
      await signedIn(email);

      const refused = await verifyTotp(jar.header, wrongCode(totpURI));

      expect(refused.status).toBe(401);
      expect(code(refused)).toBe('INVALID_CODE');
      expect(await flagOf(id)).toBe(false);

      const verified = await verifyTotp(jar.header, totpCode(totpURI));

      expect(verified.status).toBe(200);
      jar.take(verified);
      expect(await flagOf(id)).toBe(true);
      expect((await twoFactorRows(id))[0]?.verified).toBe(true);
      expect((await get('users/me', jar.header)).body).toMatchObject({ twoFactorEnabled: true });

      // Written when it really turned on, and once.
      const rows = await auditRows(id, 'auth.2fa_enabled');

      expect(rows).toHaveLength(1);
      expectOwnRow(rows[0], id);
      expect(rows[0]?.metadata ?? {}).toEqual({});

      await until(() => mailsTo(email, ENABLED_MAIL).length > 0, 'The "two-step verification on" mail');
      await pause(500);
      expect(mailsTo(email, ENABLED_MAIL)).toHaveLength(1);
      expectQuietMail(mailsTo(email, ENABLED_MAIL)[0]);

      // Asking again while it is on is refused, and changes nothing.
      const again = await post('auth/two-factor/enable', jar.header, { password: ORIGINAL });

      expect(again.status).toBe(400);
      expect(code(again)).toBe('TOTP_ALREADY_ENABLED');
      expect(await auditRows(id, 'auth.2fa_enabled')).toHaveLength(1);
    });
  });

  describe('signing in with it on', () => {
    it('answers twoFactorRedirect with no usable session: a data route with that cookie gets the guard’s 404', async () => {
      const { id, email } = await withFactor('bea', 'Bea Lorca');

      await sql()`delete from session where user_id = ${id}`;

      const { jar, response } = await challenged(email);

      // The provisional session the plugin makes is gone before the answer, and its token was never handed out.
      expect(response.body).not.toHaveProperty('token');
      expect(await sessionsOf(id)).toBe(0);

      const notFound = await guardsNotFound();

      expect(notFound.status).toBe(404);

      for (const cookie of [jar.header, rawCookies(response)]) {
        for (const path of ['users/me', 'profile', 'settings']) {
          const denied = await get(path, cookie);

          expect({ status: denied.status, text: denied.text }).toEqual(notFound);
        }
      }

      // Nor does a wrong password reach the challenge.
      expect((await signIn(email, 'not-the-one-at-all-41')).status).toBe(401);
    });

    it('refuses a wrong code, gives a session for the right one, and the challenge cookie mints one session only', async () => {
      const { id, email, uri } = await withFactor('carla', 'Carla Muñoz');

      await sql()`delete from session where user_id = ${id}`;

      const { jar, response } = await challenged(email);
      const challengeCookie = jar.header;
      const refused = await verifyTotp(jar.header, wrongCode(uri));

      expect(refused.status).toBe(401);
      expect(code(refused)).toBe('INVALID_CODE');
      expect(jar.take(refused).has('session_token')).toBe(false);
      expect((await get('users/me', rawCookies(response))).status).toBe(404);

      const typed = totpCode(uri);
      const verified = await verifyTotp(jar.header, typed);

      expect(verified.status).toBe(200);
      jar.take(verified);
      expect(jar.has('session_token')).toBe(true);
      expect(jar.has('two_factor')).toBe(false);
      expect((await get('users/me', jar.header)).body).toMatchObject({ id, twoFactorEnabled: true });
      expect(await sessionsOf(id)).toBe(1);

      // The same challenge cookie again, even with a right code: it was spent by the success.
      const spent = await verifyTotp(challengeCookie, typed);

      expect(spent.status).toBe(401);
      expect(code(spent)).toBe('INVALID_TWO_FACTOR_COOKIE');
      expect(await sessionsOf(id)).toBe(1);
    });

    it('accepts the same code again on a new challenge within its window: the plugin keeps no record of used codes', async () => {
      const { id, email, uri } = await withFactor('dora', 'Dora Vidal');
      const typed = totpCode(uri);
      const first = await challenged(email);

      expect((await verifyTotp(first.jar.header, typed)).status).toBe(200);

      // Better Auth 1.7.6's `verifyTOTP` checks the code against the ±1 window and stores nothing about it, so a code
      // seen over a shoulder works again for up to ninety seconds. Pinned as it is; reported to the lead (RFC 6238 § 5.2
      // says a verifier should refuse a second use). If this starts failing with 401, the replay is now refused: flip it.
      const second = await challenged(email);
      const reused = await verifyTotp(second.jar.header, typed);

      expect(reused.status).toBe(200);
      expect((await get('users/me', second.jar.take(reused).header)).body).toMatchObject({ id });
    });

    it('takes a backup code once and not twice, and records and mails each use with the count left', async () => {
      const { id, backupCodes, email } = await withFactor('elisa', 'Elisa Ferrer');
      const [firstCode = '', secondCode = ''] = backupCodes;
      const first = await challenged(email);
      const used = await post('auth/two-factor/verify-backup-code', first.jar.header, { code: firstCode });

      expect(used.status).toBe(200);
      expect((await get('users/me', first.jar.take(used).header)).body).toMatchObject({ id });

      const rows = await auditRows(id, 'auth.backup_code_used');

      expect(rows).toHaveLength(1);
      expectOwnRow(rows[0], id);
      expect(rows[0]?.metadata).toEqual({ remaining: 9 });

      await until(() => mailsTo(email, BACKUP_MAIL).length > 0, 'The "backup code used" mail');
      expect(words(mailsTo(email, BACKUP_MAIL)[0])).toMatch(/quedan 9/);
      expectQuietMail(mailsTo(email, BACKUP_MAIL)[0]);

      const second = await challenged(email);
      const twice = await post('auth/two-factor/verify-backup-code', second.jar.header, { code: firstCode });

      expect(twice.status).toBe(401);
      expect(code(twice)).toBe('INVALID_BACKUP_CODE');
      expect(second.jar.take(twice).has('session_token')).toBe(false);
      expect(await auditRows(id, 'auth.backup_code_used')).toHaveLength(1);

      const next = await post('auth/two-factor/verify-backup-code', second.jar.header, { code: secondCode });

      expect(next.status).toBe(200);
      expect((await auditRows(id, 'auth.backup_code_used')).map(row => row.metadata)).toEqual([{ remaining: 9 }, { remaining: 8 }]);
      await until(() => mailsTo(email, BACKUP_MAIL).length === 2, 'The second "backup code used" mail');
      expect(words(mailsTo(email, BACKUP_MAIL)[1])).toMatch(/quedan 8/);
    });

    it('skips the challenge on a trusted device, renews the trust each time, and never for another account', async () => {
      const { email, uri } = await withFactor('fabio', 'Fabio Sanz');
      const other = await withFactor('gema', 'Gema Ruiz');
      const first = await challenged(email);
      const trusted = await verifyTotp(first.jar.header, totpCode(uri), true);

      expect(trusted.status).toBe(200);
      first.jar.take(trusted);
      expect(first.jar.has('trust_device')).toBe(true);

      const trust = first.jar.only('trust_device');

      // The next sign-in from that browser: a session at once, and the trust handed back renewed.
      const skipped = await signIn(email, ORIGINAL, trust);

      expect(skipped.status).toBe(200);
      expect(skipped.body).not.toHaveProperty('twoFactorRedirect');

      const second = new CookieJar().take(skipped);

      expect((await get('users/me', second.header)).status).toBe(200);
      expect(second.has('trust_device')).toBe(true);
      expect(second.only('trust_device')).not.toBe(trust);

      // The old value was spent by the renewal; the renewed one still works, and is renewed again.
      await challenged(email, ORIGINAL, trust);

      const renewed = await signIn(email, ORIGINAL, second.only('trust_device'));

      expect(renewed.body).not.toHaveProperty('twoFactorRedirect');

      const third = new CookieJar().take(renewed);

      expect(third.has('trust_device')).toBe(true);

      // Another account signing in from the same browser, with a live trust, is still asked: the trust is bound to its account.
      await challenged(other.email, ORIGINAL, third.only('trust_device'));
      expect((await signIn(email, ORIGINAL, third.only('trust_device'))).body).not.toHaveProperty('twoFactorRedirect');

      // Without asking for it, nothing is trusted.
      const plain = await challenged(email);
      const untrusted = await verifyTotp(plain.jar.header, totpCode(uri));

      expect(untrusted.status).toBe(200);
      expect(new CookieJar().take(untrusted).has('trust_device')).toBe(false);
    });
  });

  describe('turning it off, and new backup codes', () => {
    it('turns off only with the password, and the change is recorded, mailed and felt at the next sign-in', async () => {
      const { id, email, jar } = await withFactor('hugo', 'Hugo Prieto');

      expect((await post('auth/two-factor/disable', jar.header, {})).status).toBe(400);

      const wrong = await post('auth/two-factor/disable', jar.header, { password: 'not-the-one-at-all-41' });

      expect(wrong.status).toBe(400);
      expect(code(wrong)).toBe('INVALID_PASSWORD');
      expect(await flagOf(id)).toBe(true);
      expect(await twoFactorRows(id)).toHaveLength(1);
      expect(await auditRows(id, 'auth.2fa_disabled')).toEqual([]);

      const disabled = await post('auth/two-factor/disable', jar.header, { password: ORIGINAL });

      expect(disabled.status).toBe(200);
      jar.take(disabled);
      expect(await flagOf(id)).toBe(false);
      expect(await twoFactorRows(id)).toEqual([]);
      expect((await get('users/me', jar.header)).body).toMatchObject({ twoFactorEnabled: false });

      const rows = await auditRows(id, 'auth.2fa_disabled');

      expect(rows).toHaveLength(1);
      expectOwnRow(rows[0], id);
      expect(rows[0]?.metadata ?? {}).toEqual({});

      await until(() => mailsTo(email, DISABLED_MAIL).length > 0, 'The "two-step verification off" mail');
      await pause(500);
      expect(mailsTo(email, DISABLED_MAIL)).toHaveLength(1);
      expectQuietMail(mailsTo(email, DISABLED_MAIL)[0]);

      await signedIn(email);
    });

    it('makes new backup codes only with the password, records and mails it once, and the old ones stop working', async () => {
      const { id, backupCodes, email, jar } = await withFactor('ines', 'Inés Gil');

      expect((await post('auth/two-factor/generate-backup-codes', jar.header, {})).status).toBe(400);

      const wrong = await post('auth/two-factor/generate-backup-codes', jar.header, { password: 'not-the-one-at-all-41' });

      expect(wrong.status).toBe(400);
      expect(code(wrong)).toBe('INVALID_PASSWORD');
      expect(await auditRows(id, 'auth.backup_codes_regenerated')).toEqual([]);

      // Not through `post`: this is the other response the codes may be in.
      const generated = await request(server())
        .post(`/${PREFIX}/auth/two-factor/generate-backup-codes`)
        .set('Cookie', jar.header)
        .set('User-Agent', IPHONE)
        .set('Accept-Language', 'es')
        .send({ password: ORIGINAL })
        .expect(200);
      const fresh = (generated.body as { backupCodes: string[] }).backupCodes;

      secrets.push(...fresh);
      expect(fresh).toHaveLength(10);
      expect(fresh.filter(backup => backupCodes.includes(backup))).toEqual([]);

      const rows = await auditRows(id, 'auth.backup_codes_regenerated');

      expect(rows).toHaveLength(1);
      expectOwnRow(rows[0], id);
      expect(rows[0]?.metadata ?? {}).toEqual({});

      await until(() => mailsTo(email, REGENERATED_MAIL).length > 0, 'The "new backup codes" mail');
      await pause(500);
      expect(mailsTo(email, REGENERATED_MAIL)).toHaveLength(1);
      expectQuietMail(mailsTo(email, REGENERATED_MAIL)[0]);

      const old = await challenged(email);
      const refused = await post('auth/two-factor/verify-backup-code', old.jar.header, { code: backupCodes[2] ?? '' });

      expect(refused.status).toBe(401);
      expect(code(refused)).toBe('INVALID_BACKUP_CODE');

      const accepted = await post('auth/two-factor/verify-backup-code', old.jar.header, { code: fresh[0] ?? '' });

      expect(accepted.status).toBe(200);
    });

    it('never reads or changes another account’s factor: A’s session with B’s password or B’s code changes nothing for B', async () => {
      const ana = await withFactor('julio', 'Julio Pons');
      const bea = await withFactor('karen', 'Karen Soto');

      const disable = await post('auth/two-factor/disable', ana.jar.header, { password: 'not-the-one-at-all-41' });

      expect(disable.status).toBe(400);
      expect(await flagOf(bea.id)).toBe(true);
      expect(await flagOf(ana.id)).toBe(true);

      // B's code under A's session is checked against A's secret, not B's.
      if (![-1, 0, 1].map(steps => totpCode(ana.uri, steps)).includes(totpCode(bea.uri))) {
        expect((await verifyTotp(ana.jar.header, totpCode(bea.uri))).status).toBe(401);
      }

      // A's challenge cookie answered with B's code mints no session for anybody.
      const challenge = await challenged(ana.email);
      const anaWindow = [-1, 0, 1].map(steps => totpCode(ana.uri, steps));
      const beaCode = totpCode(bea.uri);

      if (!anaWindow.includes(beaCode)) {
        const foreign = await verifyTotp(challenge.jar.header, beaCode);

        expect(foreign.status).toBe(401);
        expect(code(foreign)).toBe('INVALID_CODE');
        expect(challenge.jar.take(foreign).has('session_token')).toBe(false);
      }

      // A's own disable turns off A's, and leaves B's exactly as it was.
      const before = await twoFactorRows(bea.id);

      expect((await post('auth/two-factor/disable', ana.jar.header, { password: ORIGINAL })).status).toBe(200);
      expect(await flagOf(ana.id)).toBe(false);
      expect(await flagOf(bea.id)).toBe(true);
      expect(await twoFactorRows(bea.id)).toEqual(before);
      expect(await auditRows(bea.id, 'auth.2fa_disabled')).toEqual([]);
      await challenged(bea.email);
    });
  });

  describe('the password and the factor', () => {
    it('a reset does not skip the challenge, nor turn the factor off', async () => {
      const { id, email, uri } = await withFactor('lara', 'Lara Bravo');
      // The row a reset request writes, written here: the reset is under test, not the request (`account-security.e2e-spec.ts`).
      const token = `two-factor-reset-${String(stamp)}`;

      await sql()`
        insert into verification (id, identifier, value, expires_at, created_at, updated_at)
        values (${token}, ${`reset-password:${token}`}, ${id}, now() + interval '1 hour', now(), now())`;

      const reset = await post('auth/reset-password', '', { newPassword: 'cobalt-harbour-willow-7', token });

      expect(reset.status).toBe(200);
      expect(await flagOf(id)).toBe(true);
      expect((await twoFactorRows(id))[0]?.verified).toBe(true);
      expect(await sessionsOf(id)).toBe(0);

      const { jar } = await challenged(email, 'cobalt-harbour-willow-7');

      expect((await verifyTotp(jar.header, totpCode(uri))).status).toBe(200);
      await sql()`delete from verification where id = ${token}`;
    });

    it('a password change leaves the factor on, and the next sign-in is still asked', async () => {
      const { id, email, jar } = await withFactor('marta', 'Marta Cano');
      const changed = await change(jar.header, { currentPassword: ORIGINAL, newPassword: 'amber-lantern-quietly-7' });

      expect(changed.status).toBe(200);
      expect(await flagOf(id)).toBe(true);
      expect((await twoFactorRows(id))[0]?.verified).toBe(true);
      await challenged(email, 'amber-lantern-quietly-7');
    });
  });

  describe('who cannot', () => {
    it('an account with no password (Google only) gets the guard’s 404 on enable, byte for byte, and no secret', async () => {
      jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(true);

      const back = await throughGoogle(emailFor('google'), `g-two-factor-${String(stamp)}`);

      expect(back.status).toBe(302);

      const jar = new CookieJar().take(back);

      googleCookie = jar.header;

      const me = await get('users/me', jar.header);

      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({ email: googleEmail, hasPassword: false, twoFactorEnabled: false });

      const id = (me.body as { id: string }).id;

      ids.push(id);

      const notFound = await guardsNotFound();

      for (const body of [{ password: 'anything-at-all-123' }, {}]) {
        const refused = await post('auth/two-factor/enable', jar.header, body);

        expect({ status: refused.status, text: refused.text }).toEqual(notFound);
      }

      expect(await twoFactorRows(id)).toEqual([]);
      expect(await flagOf(id)).toBe(false);
      expect(await auditRows(id, 'auth.2fa_enabled')).toEqual([]);
    });

    it('email OTP is not a second factor: it cannot be turned on, sends nothing and grants nothing', async () => {
      const plain = await account('nora', 'Nora Peña');
      const jar = await signedIn(plain.email);
      const otpEnable = await post('auth/two-factor/enable', jar.header, { method: 'otp', password: ORIGINAL });

      expect(otpEnable.status).toBe(400);
      expect(code(otpEnable)).toBe('OTP_NOT_CONFIGURED');
      expect(await flagOf(plain.id)).toBe(false);
      expect(await twoFactorRows(plain.id)).toEqual([]);

      const { id, email, uri } = await withFactor('olga', 'Olga Ibáñez');

      await sql()`delete from session where user_id = ${id}`;

      // The sign-up's address confirmation and the "turned on" mail run after their responses and may land at any
      // point here; neither is a code. Anything else to these addresses would be.
      const codeMails = (to: string) =>
        outbox.filter(mail => mail.to === to && mail.kind !== 'verify-email' && !ENABLED_MAIL.test(`${mail.subject}\n${mail.text}`));
      const mailed = codeMails(email).length;
      const { jar: challenge } = await challenged(email);
      const notFound = await guardsNotFound();
      const send = await post('auth/two-factor/send-otp', challenge.header);

      // Not offered at all: the routes answer as if they did not exist, the guard's 404 byte for byte.
      expect({ status: send.status, text: send.text }).toEqual(notFound);

      for (const typed of ['000000', '123456']) {
        const verified = await post('auth/two-factor/verify-otp', challenge.header, { code: typed });

        expect({ status: verified.status, text: verified.text }).toEqual(notFound);
        expect(new CookieJar().take(verified).has('session_token')).toBe(false);
      }

      expect(await sessionsOf(id)).toBe(0);
      expect((await get('users/me', challenge.header)).status).toBe(404);

      // The challenge is still whole: the OTP routes spent none of it, and a TOTP code still finishes it.
      expect((await verifyTotp(challenge.header, totpCode(uri))).status).toBe(200);

      // Signed in, the same: nothing to send, nothing to verify.
      const signed = await signedIn(plain.email);
      const signedSend = await post('auth/two-factor/send-otp', signed.header);
      const signedVerify = await post('auth/two-factor/verify-otp', signed.header, { code: '123456' });

      expect({ status: signedSend.status, text: signedSend.text }).toEqual(notFound);
      expect({ status: signedVerify.status, text: signedVerify.text }).toEqual(notFound);
      expect(await flagOf(plain.id)).toBe(false);
      await pause(500);
      expect(codeMails(email)).toHaveLength(mailed);
      expect(codeMails(plain.email)).toHaveLength(0);
    });
  });

  describe('what the invariant review closed', () => {
    it('an implicit Google link into a password account with the factor on is refused: no session, no account row, no new user', async () => {
      jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(true);

      const { id, email, uri } = await withFactor('sara', 'Sara Ortiz');
      const sub = `g-two-factor-link-${String(stamp)}`;

      await sql()`delete from session where user_id = ${id}`;
      expect(await providerAccounts(id)).toEqual(['credential']);

      // The address is confirmed and Google vouches for it: without the factor, `social-sign-in` shows this joining.
      const back = await throughGoogle(email, sub);
      const location = new URL(String(back.headers.location));

      expect(back.status).toBe(302);
      expect(location.origin + location.pathname).toBe(`${APP}/acceder`);
      expect(location.searchParams.get('error')).toBe('unable_to_link_account');
      expect(new CookieJar().take(back).has('session_token')).toBe(false);
      expect(await sessionsOf(id)).toBe(0);
      expect(await providerAccounts(id)).toEqual(['credential']);

      const [users] = await sql()<{ n: number }>`select count(*)::int as n from "user" where email = ${email}`;
      const [linked] = await sql()<{ n: number }>`select count(*)::int as n from account where account_id = ${sub}`;

      expect(users?.n).toBe(1);
      expect(linked?.n).toBe(0);

      // The owner, signed in with the password and the code, can still join Google to the account on purpose.
      const { jar } = await challenged(email);
      const verified = await verifyTotp(jar.header, totpCode(uri));

      expect(verified.status).toBe(200);
      jar.take(verified);

      const joined = await throughGoogle(email, sub, jar.header);

      expect(joined.status).toBe(302);
      expect(String(joined.headers.location)).toBe(`${APP}/inicio`);
      expect(await providerAccounts(id)).toEqual(['credential', 'google']);
      expect(await flagOf(id)).toBe(true);
    });

    it('a Google account joined while the factor was off still signs in through Google with no code (decision 0074)', async () => {
      jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(true);

      const { id, email } = await account('zoe', 'Zoe Navas');
      const sub = `g-two-factor-joined-${String(stamp)}`;
      const joined = await throughGoogle(email, sub);

      // Joined as `social-sign-in` shows: same address, confirmed, the factor off.
      expect(joined.status).toBe(302);
      expect(String(joined.headers.location)).toBe(`${APP}/inicio`);
      expect(await providerAccounts(id)).toEqual(['credential', 'google']);

      const jar = await signedIn(email);
      const { totpURI } = await enable(jar);

      jar.take(await verifyTotp(jar.header, totpCode(totpURI)));
      expect(await flagOf(id)).toBe(true);

      // Better Auth challenges only a password sign-in; a provider sign-in rests on the provider's own second factor.
      const again = await throughGoogle(email, sub);
      const arrived = new CookieJar().take(again);

      expect(again.status).toBe(302);
      expect(String(again.headers.location)).toBe(`${APP}/inicio`);
      expect(arrived.has('two_factor')).toBe(false);
      expect((await get('users/me', arrived.header)).body).toMatchObject({ id, twoFactorEnabled: true });

      // The password door is still asked.
      await challenged(email);
    });

    it('get-totp-uri answers the guard’s 404, byte for byte, signed in or not, and hands no secret back', async () => {
      const { jar } = await withFactor('tomas', 'Tomás Rey');
      const notFound = await guardsNotFound();

      for (const cookie of [jar.header, '']) {
        for (const body of [{ password: ORIGINAL }, {}]) {
          const asked = await post('auth/two-factor/get-totp-uri', cookie, body);

          expect({ status: asked.status, text: asked.text }).toEqual(notFound);
        }
      }
    });

    it('disable on an account with the factor already off records nothing and mails nothing', async () => {
      const { id, email } = await account('ursula', 'Úrsula Paz');
      const jar = await signedIn(email);
      const disabled = await post('auth/two-factor/disable', jar.header, { password: ORIGINAL });

      expect(disabled.status).toBe(200);
      expect(await flagOf(id)).toBe(false);
      await pause(1000);
      expect(await auditRows(id, 'auth.2fa_disabled')).toEqual([]);
      expect(mailsTo(email, DISABLED_MAIL)).toEqual([]);
    });

    it('a device trusted before the factor was turned off and on again is asked again', async () => {
      const { id, email, jar, uri } = await withFactor('vera', 'Vera Lago');
      const trust = await trustedDevice(email, uri);

      expect(await trustIsLive(trust)).toBe(true);
      // Turned off from the session, which never held the trust cookie: the plugin's own disable forgets only the device it is sent from.
      expect(jar.has('trust_device')).toBe(false);

      const disabled = await post('auth/two-factor/disable', jar.header, { password: ORIGINAL });

      expect(disabled.status).toBe(200);
      jar.take(disabled);
      expect(await trustRows(id)).toBe(0);

      const { totpURI } = await enable(jar);
      const verified = await verifyTotp(jar.header, totpCode(totpURI));

      expect(verified.status).toBe(200);
      jar.take(verified);

      const { jar: challenge } = await challenged(email, ORIGINAL, trust);

      expect((await verifyTotp(challenge.header, totpCode(totpURI))).status).toBe(200);
    });

    it('a device trusted before a password change is asked again', async () => {
      const { id, email, jar, uri } = await withFactor('wendy', 'Wendy Gómez');
      const trust = await trustedDevice(email, uri);

      expect(await trustIsLive(trust)).toBe(true);
      expect(jar.has('trust_device')).toBe(false);
      expect((await change(jar.header, { currentPassword: ORIGINAL, newPassword: 'amber-lantern-quietly-8' })).status).toBe(200);
      expect(await trustRows(id)).toBe(0);
      await challenged(email, 'amber-lantern-quietly-8', trust);
    });

    it('a device trusted before a reset is asked again', async () => {
      const { id, email, uri } = await withFactor('ximena', 'Ximena Toro');
      const trust = await trustedDevice(email, uri);
      const token = `two-factor-reset-trust-${String(stamp)}`;

      expect(await trustIsLive(trust)).toBe(true);
      await sql()`
        insert into verification (id, identifier, value, expires_at, created_at, updated_at)
        values (${token}, ${`reset-password:${token}`}, ${id}, now() + interval '1 hour', now(), now())`;
      expect((await post('auth/reset-password', '', { newPassword: 'cobalt-harbour-willow-8', token })).status).toBe(200);
      expect(await trustRows(id)).toBe(0);
      await challenged(email, 'cobalt-harbour-willow-8', trust);
      await sql()`delete from verification where id = ${token}`;
    });

    it('a device trusted before revoke-sessions is asked again', async () => {
      const { id, email, jar, uri } = await withFactor('yago', 'Yago Ríos');
      const trust = await trustedDevice(email, uri);

      expect(await trustIsLive(trust)).toBe(true);
      expect(jar.has('trust_device')).toBe(false);
      expect((await post('auth/revoke-sessions', jar.header)).status).toBe(200);
      expect(await trustRows(id)).toBe(0);
      await challenged(email, ORIGINAL, trust);
    });
  });

  describe('counting, and leaving', () => {
    it('counts one session_started per sign-in, with the factor and without it, and none for an abandoned challenge', async () => {
      const plain = await account('pablo', 'Pablo Mora');
      const before = await sessionStarts(plain.id);

      await signedIn(plain.email);
      await until(async () => (await sessionStarts(plain.id)) > before, 'The session_started of a plain sign-in');
      await pause(500);
      expect(await sessionStarts(plain.id)).toBe(before + 1);

      const { id, email, uri } = await withFactor('quique', 'Quique Leal');

      // The enabling verify made a session of its own; let its count land before measuring.
      await pause(1000);

      const atStart = await sessionStarts(id);
      const { jar } = await challenged(email);

      // The plugin's provisional session, made and deleted before the challenge, is not a sign-in.
      await pause(1000);
      expect(await sessionStarts(id)).toBe(atStart);

      expect((await verifyTotp(jar.header, totpCode(uri))).status).toBe(200);
      await until(async () => (await sessionStarts(id)) > atStart, 'The session_started of a two-factor sign-in');
      await pause(500);
      expect(await sessionStarts(id)).toBe(atStart + 1);

      // A challenge abandoned for good counts nothing either.
      const abandoned = await sessionStarts(id);

      await challenged(email);
      await pause(1000);
      expect(await sessionStarts(id)).toBe(abandoned);
    });

    it('deleting the account takes its two_factor row with it', async () => {
      const { id, jar } = await withFactor('rosa', 'Rosa Marín');

      expect(await twoFactorRows(id)).toHaveLength(1);
      expect((await request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', jar.header)).status).toBe(204);

      const [user] = await sql()<{ n: number }>`select count(*)::int as n from "user" where id = ${id}`;

      expect(user?.n).toBe(0);
      expect(await twoFactorRows(id)).toEqual([]);
    });

    it('no secret and no code in an audit row, an analytics event, a log line or any other response; no request to HIBP', async () => {
      expect(secrets.length).toBeGreaterThan(0);
      expect(codes.length).toBeGreaterThan(0);

      const rows = await sql()<AuditRow & { action: string }>`
        select action, actor_id as "actorId", entity, entity_id as "entityId", ip_hash as "ipHash", metadata, subject_user_id as "subjectUserId"
        from audit_logs
        where created_at >= ${started}
          and action in ('auth.2fa_enabled', 'auth.2fa_disabled', 'auth.backup_code_used', 'auth.backup_codes_regenerated')`;

      // Every enable, two disables and three backup codes — at least.
      expect(rows.length).toBeGreaterThanOrEqual(6);

      for (const row of rows) {
        expect(row.ipHash).toBeNull();
        expect(row.entityId).toBeNull();
        expect(Object.keys(row.metadata ?? {})).toEqual(row.action === 'auth.backup_code_used' ? ['remaining'] : []);
      }

      const events = await sql()<{ properties: Record<string, unknown> | null }>`
        select properties from analytics_events where created_at >= ${started} and user_id = any(${ids})`;
      const structured = [...rows.map(row => JSON.stringify(row.metadata ?? {})), ...events.map(event => JSON.stringify(event.properties ?? {}))];

      for (const said of [...structured, ...bodies]) {
        for (const secret of [...secrets, ...codes]) {
          expect(said).not.toContain(secret);
        }
      }

      // A six-digit code turns up by chance in timestamps and ids; in the logs only what cannot is looked for.
      const logs = logged.join('\n');

      for (const secret of secrets) {
        expect(logs).not.toContain(secret);
      }

      for (const mail of outbox) {
        for (const secret of [...secrets, ...codes]) {
          expect(words(mail)).not.toContain(secret);
        }
      }

      // The one attempt is the tripwire's own check in `beforeAll`; the API made none.
      expect(hibpAttempts()).toBe(1);
    });
  });
});
