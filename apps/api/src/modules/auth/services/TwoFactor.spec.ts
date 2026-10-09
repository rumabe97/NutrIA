import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';
import { SignInDeviceController } from 'core/controllers/SignInDevice';
import { TwoFactorController } from 'core/controllers/TwoFactor';
import { UserController } from 'core/controllers/User';

import { validateEnv } from '../../../config/Env.validation.js';

import type { TwoFactorEvent } from '../../email/templates/TwoFactorChanged.js';
import type { TwoFactorRemovalEvent } from '../../email/templates/TwoFactorRemoval.js';

/**
 * The second factor (PLAN 011 phase 3), on the real Better Auth built by the
 * real `createAuth` — the real two-factor plugin — over its in-memory adapter,
 * driven over HTTP with real cookies, the way `AccountSecurity.spec.ts` drives
 * phase 2.
 *
 * Swapped: the storage, the mails (captured, never sent), the `UserController`
 * and `AnalyticsController` writes (spied — their SQL is `packages/core`'s to
 * prove) and the background runner (collected; `drain()` is "after the
 * response"). Every line written to the console or a Nest logger is kept, to
 * show no secret and no code ever reaches one.
 */
type Row = Record<string, unknown>;

const store: { account: Row[]; rateLimit: Row[]; session: Row[]; twoFactor: Row[]; user: Row[]; verification: Row[] } = {
  account: [],
  rateLimit: [],
  session: [],
  twoFactor: [],
  user: [],
  verification: []
};
const resetUrls: string[] = [];
const mails: { event: TwoFactorEvent; to: string; userId: string }[] = [];
const sentOtps: unknown[] = [];
const removalMails: { event: TwoFactorRemovalEvent; to: string; userId: string }[] = [];

type Where = { field: string; operator?: string; value: unknown };
type Adapter = { deleteMany: (query: { model: string; where?: Where[] }) => Promise<number> };

/** The next this many deletes of "every session but one" (`closeOtherSessions`) fail, as a dropped connection would. */
const closing = { failures: 0 };

jest.unstable_mockModule('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: () => {
    const memory = memoryAdapter(store) as unknown as (options: unknown) => Adapter;

    return (options: unknown): Adapter => {
      const adapter = memory(options);

      return {
        ...adapter,
        deleteMany: async query => {
          if (closing.failures > 0 && query.model === 'session' && query.where?.some(clause => clause.operator === 'ne')) {
            closing.failures -= 1;

            throw new Error('down');
          }

          return adapter.deleteMany(query);
        }
      };
    };
  }
}));
jest.unstable_mockModule('database', () => ({ database: () => ({}) }));
jest.unstable_mockModule('./SelfService.js', () => ({
  onAccountCreated: async () => Promise.resolve(),
  onAddressConfirmed: async () => Promise.resolve()
}));
jest.unstable_mockModule('./VerificationMail.js', () => ({ sendVerificationMail: async () => Promise.resolve() }));
jest.unstable_mockModule('./PasswordChangedMail.js', () => ({ sendPasswordChangedMail: async () => Promise.resolve() }));
jest.unstable_mockModule('./PasswordResetMail.js', () => ({
  sendPasswordResetMail: async (_mailer: unknown, { url }: { url: string }) => {
    resetUrls.push(url);

    return Promise.resolve();
  }
}));
jest.unstable_mockModule('./TwoFactorMail.js', () => ({
  sendTwoFactorMail: async (_mailer: unknown, { event, to, userId }: { event: TwoFactorEvent; to: string; userId: string }) => {
    mails.push({ event, to, userId });

    return Promise.resolve();
  }
}));

jest.unstable_mockModule('./TwoFactorRemovalMail.js', () => ({
  sendTwoFactorRemovalMail: async (_mailer: unknown, { event, to, userId }: { event: TwoFactorRemovalEvent; to: string; userId: string }) => {
    removalMails.push({ event, to, userId });

    return Promise.resolve();
  }
}));

const { createAuth } = await import('../auth.config.js');
const { refusesLinkPastTheFactor, totpStepOf } = await import('./TwoFactor.js');

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery-staple-9';
const NEW_PASSWORD = 'otra-frase-de-caballos-azules';
const ACCOUNT = { email: 'ana@example.invalid', name: 'Ana' };
const NOT_FOUND = '{"code":"NOT_FOUND","message":"Not Found","statusCode":404}';

const tasks: ((() => Promise<unknown>) | Promise<unknown>)[] = [];
const background = {
  run: (_label: string, work: (() => Promise<unknown>) | Promise<unknown>) => {
    tasks.push(work);
  }
};

async function drain(): Promise<void> {
  while (tasks.length > 0) {
    await Promise.all(tasks.splice(0).map(async work => (typeof work === 'function' ? work() : work)));
  }
}

type Auth = ReturnType<typeof createAuth>;

function build(): Auth {
  const env = validateEnv({
    APP_URL: ORIGIN,
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    NODE_ENV: 'test'
  });

  return createAuth(
    env,
    {
      configured: true,
      send: async message => {
        sentOtps.push(message);

        return Promise.resolve(true);
      }
    },
    { cancelEverything: async () => Promise.resolve() },
    background
  );
}

/** One browser: the cookies Better Auth set on it, sent back on every call. */
class Browser {
  private readonly cookies = new Map<string, string>();

  header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  has(fragment: string): boolean {
    return [...this.cookies.keys()].some(name => name.includes(fragment));
  }

  keep(response: Response): void {
    for (const line of response.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const at = pair.indexOf('=');
      const name = pair.slice(0, at);
      const value = pair.slice(at + 1);
      const expired = value === '' || /max-age=0\b/i.test(line);

      if (expired) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }
}

async function call(
  auth: Auth,
  browser: Browser,
  path: string,
  body?: unknown
): Promise<{ body: Record<string, unknown> | null; raw: string; status: number }> {
  const response = await auth.handler(
    new Request(`http://localhost:3001${auth.options.basePath}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...(browser.header() ? { cookie: browser.header() } : {}) },
      method: body === undefined ? 'GET' : 'POST'
    })
  );
  browser.keep(response);
  const raw = await response.text();

  return { body: raw ? (JSON.parse(raw) as Record<string, unknown>) : null, raw, status: response.status };
}

async function sessionOf(auth: Auth, browser: Browser): Promise<{ user: Row } | null> {
  return auth.api.getSession({ headers: new Headers({ cookie: browser.header() }) }) as Promise<{ user: Row } | null>;
}

/** RFC 4648 base32, as the otpauth:// URI carries the secret. */
function base32(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';

  for (const char of encoded.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }

  return Buffer.from((bits.match(/.{8}/g) ?? []).map(byte => Number.parseInt(byte, 2)));
}

/** The authenticator app: RFC 6238, SHA-1, six digits, thirty seconds. */
function totp(uri: string, at = Date.now()): string {
  const key = base32(new URL(uri).searchParams.get('secret') ?? '');
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const mac = createHmac('sha1', key).update(counter).digest();
  const offset = (mac.at(-1) ?? 0) & 0xf;
  const value = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;

  return value.toString().padStart(6, '0');
}

/** Confirms the address in the store, as its link would: an unconfirmed account cannot sign in with its password (PLAN 011 phase 8). */
function confirm(email: string): void {
  const row = store.user.find(candidate => candidate.email === email);

  if (row) {
    row.emailVerified = true;
  }
}

/** Signed up and confirmed, then signed in: sign-up opens no session (PLAN 011 phase 8). */
async function signUp(auth: Auth): Promise<Browser> {
  const browser = new Browser();
  await call(auth, browser, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });
  confirm(ACCOUNT.email);
  await call(auth, browser, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

  return browser;
}

/**
 * The authenticator's next code: the one `withFactor` confirmed with is spent (PLAN 011 phase 4, a code is
 * accepted once), and the plugin's window accepts the step after the current one.
 */
function nextTotp(uri: string): string {
  return totp(uri, Date.now() + 30_000);
}

/** Signed up, the factor enabled and confirmed: the browser that did it, the URI and the ten codes. */
async function withFactor(auth: Auth): Promise<{ browser: Browser; codes: string[]; uri: string }> {
  const browser = await signUp(auth);
  const enabled = await call(auth, browser, '/two-factor/enable', { password: PASSWORD });
  const uri = enabled.body?.totpURI as string;
  await call(auth, browser, '/two-factor/verify-totp', { code: totp(uri) });

  return { browser, codes: enabled.body?.backupCodes as string[], uri };
}

describe('the second factor', () => {
  let twoFactorChanged: jest.SpiedFunction<typeof UserController.twoFactorChanged>;
  let backupCodeUsed: jest.SpiedFunction<typeof UserController.backupCodeUsed>;
  let backupCodesRegenerated: jest.SpiedFunction<typeof UserController.backupCodesRegenerated>;
  let analytics: jest.SpiedFunction<typeof AnalyticsController.record>;
  let claimTotpStep: jest.SpiedFunction<typeof TwoFactorController.claimTotpStep>;
  let cancelRemovalByAccount: jest.SpiedFunction<typeof TwoFactorController.cancelRemovalByAccount>;
  let sessionsRevoked: jest.SpiedFunction<typeof UserController.sessionsRevoked>;
  let rememberDevice: jest.SpiedFunction<typeof SignInDeviceController.remember>;
  const logged: string[] = [];

  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    resetUrls.length = 0;
    mails.length = 0;
    removalMails.length = 0;
    sentOtps.length = 0;
    tasks.length = 0;
    logged.length = 0;
    closing.failures = 0;
    twoFactorChanged = jest.spyOn(UserController, 'twoFactorChanged').mockResolvedValue(undefined);
    backupCodeUsed = jest.spyOn(UserController, 'backupCodeUsed').mockResolvedValue(undefined);
    backupCodesRegenerated = jest.spyOn(UserController, 'backupCodesRegenerated').mockResolvedValue(undefined);
    jest.spyOn(UserController, 'passwordChanged').mockResolvedValue(0);
    sessionsRevoked = jest.spyOn(UserController, 'sessionsRevoked').mockResolvedValue(undefined);
    analytics = jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(AnalyticsController, 'recordUse').mockResolvedValue(undefined);
    // The replay rule's claim (PLAN 011 phase 4), as `TwoFactorRepository.claimTotpStep`'s guarded UPDATE does it, on the store's row.
    claimTotpStep = jest.spyOn(TwoFactorController, 'claimTotpStep').mockImplementation(async (userId, step) => {
      const row = store.twoFactor.find(candidate => candidate.userId === userId);
      const last = row?.lastTotpStep;

      if (!row || (typeof last === 'number' && last >= step)) {
        return Promise.resolve(false);
      }

      row.lastTotpStep = step;

      return Promise.resolve(true);
    });
    cancelRemovalByAccount = jest.spyOn(TwoFactorController, 'cancelRemovalByAccount').mockResolvedValue(null);
    // The browser's device cookie (PLAN 011 phase 7b): the rows are `packages/core`'s; here, only when one is earned.
    rememberDevice = jest.spyOn(SignInDeviceController, 'remember').mockResolvedValue('device-token');

    const keep = (...parts: unknown[]) => {
      logged.push(parts.map(part => (typeof part === 'string' ? part : JSON.stringify(part))).join(' '));
    };

    for (const level of ['debug', 'error', 'info', 'log', 'warn'] as const) {
      jest.spyOn(console, level).mockImplementation(keep);
    }

    for (const level of ['debug', 'error', 'log', 'verbose', 'warn'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(keep);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const sessionsStarted = () => analytics.mock.calls.filter(([name]) => name === 'session_started');

  describe('who may turn it on', () => {
    it('answers an account with no password the guard’s 404, byte for byte, and stores no secret', async () => {
      const auth = build();
      const browser = await signUp(auth);
      // What a Google-only account looks like: a session, and no credential account.
      store.account.length = 0;

      const refused = await call(auth, browser, '/two-factor/enable', { password: PASSWORD });

      expect(refused.status).toBe(404);
      expect(refused.raw).toBe(NOT_FOUND);
      expect(store.twoFactor).toEqual([]);
    });

    it('answers no session with the route’s own 401', async () => {
      const auth = build();

      await expect(call(auth, new Browser(), '/two-factor/enable', { password: PASSWORD })).resolves.toMatchObject({ status: 401 });
    });

    it('refuses a wrong password with INVALID_PASSWORD and stores nothing', async () => {
      const auth = build();
      const browser = await signUp(auth);

      const refused = await call(auth, browser, '/two-factor/enable', { password: 'not-the-password-at-all' });

      expect(refused).toMatchObject({ body: { code: 'INVALID_PASSWORD' }, status: 400 });
      expect(store.twoFactor).toEqual([]);
    });
  });

  describe('turning it on', () => {
    it('stores an unverified secret on /enable and writes nothing yet: the factor is still off', async () => {
      const auth = build();
      const browser = await signUp(auth);

      const enabled = await call(auth, browser, '/two-factor/enable', { password: PASSWORD });
      await drain();

      expect(enabled.status).toBe(200);
      expect(enabled.body?.totpURI).toMatch(/^otpauth:\/\/totp\/NutrIA:/);
      expect(enabled.body?.backupCodes).toHaveLength(10);
      expect(store.twoFactor).toMatchObject([{ verified: false }]);
      expect(store.user[0]?.twoFactorEnabled).toBe(false);
      expect(twoFactorChanged).not.toHaveBeenCalled();
      expect(mails).toEqual([]);
    });

    it('turns on at the first correct code, and writes auth.2fa_enabled then, once, with its mail after the response', async () => {
      const auth = build();
      const browser = await signUp(auth);
      const uri = (await call(auth, browser, '/two-factor/enable', { password: PASSWORD })).body?.totpURI as string;

      const wrong = await call(auth, browser, '/two-factor/verify-totp', { code: '000000' === totp(uri) ? '111111' : '000000' });

      expect(wrong).toMatchObject({ body: { code: 'INVALID_CODE' }, status: 401 });
      expect(twoFactorChanged).not.toHaveBeenCalled();

      const verified = await call(auth, browser, '/two-factor/verify-totp', { code: totp(uri) });
      const userId = store.user[0]?.id as string;

      expect(verified.status).toBe(200);
      expect(verified.body).toMatchObject({ otherSessionsClosed: true, token: expect.any(String) });
      expect(store.user[0]?.twoFactorEnabled).toBe(true);
      expect(twoFactorChanged).toHaveBeenCalledTimes(1);
      expect(twoFactorChanged).toHaveBeenCalledWith(userId, true);
      expect(mails).toEqual([]);
      await drain();
      expect(mails).toEqual([{ event: { kind: 'enabled', otherSessionsClosed: true }, to: ACCOUNT.email, userId }]);
      // The rotation of the session the person already had is not a visit.
      expect(sessionsStarted()).toHaveLength(1);
      await expect(sessionOf(auth, browser)).resolves.toMatchObject({ user: { twoFactorEnabled: true } });
    });
  });

  /*
   * PLAN 011 phase 6, the legal review: the flag rides every session's user row, so a session somebody opened
   * with the password alone before the factor went on would pass the privileged accounts' rule afterwards.
   */
  describe('turning it on closes the other sessions', () => {
    it('leaves only the session that confirmed it, and writes auth.sessions_revoked {scope: others}', async () => {
      const auth = build();
      const confirming = await signUp(auth);
      const elsewhere = new Browser();

      expect((await call(auth, elsewhere, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD })).status).toBe(200);
      await expect(sessionOf(auth, elsewhere)).resolves.not.toBeNull();

      const uri = (await call(auth, confirming, '/two-factor/enable', { password: PASSWORD })).body?.totpURI as string;

      // `/enable` alone turns nothing on, and closes nothing.
      await expect(sessionOf(auth, elsewhere)).resolves.not.toBeNull();
      expect((await call(auth, confirming, '/two-factor/verify-totp', { code: totp(uri) })).status).toBe(200);

      await expect(sessionOf(auth, elsewhere)).resolves.toBeNull();
      await expect(sessionOf(auth, confirming)).resolves.toMatchObject({ user: { twoFactorEnabled: true } });
      expect(store.session).toHaveLength(1);
      expect(sessionsRevoked.mock.calls).toEqual([[store.user[0]?.id, 'others']]);
    });

    it('writes no row when there was no other session to close', async () => {
      const auth = build();

      await withFactor(auth);

      expect(store.session).toHaveLength(1);
      expect(sessionsRevoked).not.toHaveBeenCalled();
    });

    /*
     * Delta invariant review, P1: Better Auth's `listSessions` stops at 100 rows, so a list-then-delete would leave
     * the rest alive. Here the account has 150 others — some expired, inserted in no order — and one DELETE takes all.
     */
    it('closes every other session however many there are, in one delete that lists none first', async () => {
      const auth = build();
      const confirming = await signUp(auth);
      const uri = (await call(auth, confirming, '/two-factor/enable', { password: PASSWORD })).body?.totpURI as string;
      const userId = store.user[0]?.id as string;
      const now = Date.now();

      for (let index = 0; index < 150; index += 1) {
        const at = new Date(now - index * 60_000);

        store.session.push({
          id: `other-${index}`,
          createdAt: at,
          expiresAt: new Date(index % 3 === 0 ? now - 1000 : now + 86_400_000),
          ipAddress: null,
          token: `other-token-${index}`,
          updatedAt: at,
          userAgent: null,
          userId
        });
      }

      // A session of somebody else's account is never touched.
      store.session.push({
        id: 'stranger',
        createdAt: new Date(),
        expiresAt: new Date(now + 86_400_000),
        token: 'stranger-token',
        updatedAt: new Date(),
        userId: 'someone-else'
      });

      const verified = await call(auth, confirming, '/two-factor/verify-totp', { code: totp(uri) });

      expect(verified.status).toBe(200);
      expect(verified.body).toMatchObject({ otherSessionsClosed: true });
      expect(store.session.map(row => row.userId)).toEqual(expect.arrayContaining([userId, 'someone-else']));
      expect(store.session).toHaveLength(2);
      await expect(sessionOf(auth, confirming)).resolves.toMatchObject({ user: { twoFactorEnabled: true } });
      expect(sessionsRevoked.mock.calls).toEqual([[userId, 'others']]);
    });

    it('tries the delete again once when it fails, and says nothing went wrong when the second one works', async () => {
      const auth = build();
      const confirming = await signUp(auth);
      const elsewhere = new Browser();

      await call(auth, elsewhere, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      const uri = (await call(auth, confirming, '/two-factor/enable', { password: PASSWORD })).body?.totpURI as string;

      closing.failures = 1;

      const verified = await call(auth, confirming, '/two-factor/verify-totp', { code: totp(uri) });

      expect(verified.body).toMatchObject({ otherSessionsClosed: true });
      await expect(sessionOf(auth, elsewhere)).resolves.toBeNull();
      expect(closing.failures).toBe(0);
      expect(logged.filter(line => line.includes('not_closed') || line.includes('unrecorded'))).toEqual([]);
      await drain();
      expect(mails.map(mail => mail.event)).toEqual([{ kind: 'enabled', otherSessionsClosed: true }]);
    });

    it('still turns the factor on when the delete fails twice, and neither the answer nor the mail says the sessions closed', async () => {
      const auth = build();
      const confirming = await signUp(auth);
      const elsewhere = new Browser();

      await call(auth, elsewhere, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      const uri = (await call(auth, confirming, '/two-factor/enable', { password: PASSWORD })).body?.totpURI as string;

      closing.failures = 2;

      const verified = await call(auth, confirming, '/two-factor/verify-totp', { code: totp(uri) });

      expect(verified.status).toBe(200);
      expect(verified.body).toMatchObject({ otherSessionsClosed: false, token: expect.any(String) });
      expect(store.user[0]?.twoFactorEnabled).toBe(true);
      await expect(sessionOf(auth, elsewhere)).resolves.not.toBeNull();
      expect(sessionsRevoked).not.toHaveBeenCalled();
      expect(logged.filter(line => line.includes('two_factor_sessions_not_closed') || line.includes('unrecorded'))).toEqual([
        `two_factor_sessions_not_closed ${JSON.stringify({ userId: store.user[0]?.id })}`
      ]);
      await drain();
      expect(mails.map(mail => mail.event)).toEqual([{ kind: 'enabled', otherSessionsClosed: false }]);
    });

    it('says the sessions closed when they did but their row could not be written, with its own line', async () => {
      const auth = build();
      const confirming = await signUp(auth);
      const uri = (await call(auth, confirming, '/two-factor/enable', { password: PASSWORD })).body?.totpURI as string;
      const elsewhere = new Browser();

      await call(auth, elsewhere, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });
      sessionsRevoked.mockRejectedValueOnce(new Error('down'));

      const verified = await call(auth, confirming, '/two-factor/verify-totp', { code: totp(uri) });

      expect(verified.status).toBe(200);
      expect(verified.body).toMatchObject({ otherSessionsClosed: true });
      expect(store.user[0]?.twoFactorEnabled).toBe(true);
      await expect(sessionOf(auth, elsewhere)).resolves.toBeNull();
      expect(logged.filter(line => line.includes('two_factor_sessions_not_closed') || line.includes('unrecorded'))).toEqual([
        `sessions_revoked_unrecorded ${JSON.stringify({ scope: 'others', userId: store.user[0]?.id })}`
      ]);
    });

    it('adds nothing to the answer of a code typed to sign in', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      const signingIn = new Browser();

      await call(auth, signingIn, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      const verified = await call(auth, signingIn, '/two-factor/verify-totp', { code: nextTotp(uri) });

      expect(verified.status).toBe(200);
      expect(verified.body).not.toHaveProperty('otherSessionsClosed');
    });
  });

  describe('signing in', () => {
    it('counts one session_started for a sign-in with no factor', async () => {
      const auth = build();
      await signUp(auth);
      analytics.mockClear();

      const signedIn = await call(auth, new Browser(), '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      expect(signedIn.status).toBe(200);
      expect(sessionsStarted()).toEqual([['session_started', store.user[0]?.id]]);
    });

    it('answers a challenge and no usable session, then one session_started when the code finishes it', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      analytics.mockClear();
      twoFactorChanged.mockClear();
      const browser = new Browser();
      const sessionsBefore = store.session.length;

      const challenged = await call(auth, browser, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      expect(challenged).toMatchObject({ body: { twoFactorRedirect: true }, status: 200 });
      expect(browser.has('session_token')).toBe(false);
      await expect(sessionOf(auth, browser)).resolves.toBeNull();
      expect(store.session).toHaveLength(sessionsBefore);
      expect(sessionsStarted()).toEqual([]);

      const finished = await call(auth, browser, '/two-factor/verify-totp', { code: nextTotp(uri) });

      expect(finished.status).toBe(200);
      await expect(sessionOf(auth, browser)).resolves.toMatchObject({ user: { email: ACCOUNT.email } });
      expect(sessionsStarted()).toEqual([['session_started', store.user[0]?.id]]);
      expect(twoFactorChanged).not.toHaveBeenCalled();
    });

    /* PLAN 011 phase 7b: the device cookie that exempts a browser from the per-address brake is earned by a completed sign-in. */
    it('earns the device cookie only when the code finishes the sign-in, not when the password alone is right', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      rememberDevice.mockClear();
      const browser = new Browser();

      await call(auth, browser, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      expect(rememberDevice).not.toHaveBeenCalled();
      expect(browser.has('sign_in_device')).toBe(false);

      await call(auth, browser, '/two-factor/verify-totp', { code: nextTotp(uri) });

      expect(rememberDevice).toHaveBeenCalledTimes(1);
      expect(rememberDevice).toHaveBeenCalledWith(String(store.user[0]?.id), null);
      expect(browser.has('sign_in_device')).toBe(true);
    });

    it('earns it from a backup code too, and never from a wrong code', async () => {
      const auth = build();
      const { codes } = await withFactor(auth);
      rememberDevice.mockClear();
      const browser = new Browser();

      await call(auth, browser, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });
      expect((await call(auth, browser, '/two-factor/verify-backup-code', { code: 'not-a-backup-code' })).status).toBe(401);
      expect(rememberDevice).not.toHaveBeenCalled();

      expect((await call(auth, browser, '/two-factor/verify-backup-code', { code: codes[0] })).status).toBe(200);
      expect(rememberDevice).toHaveBeenCalledTimes(1);
    });

    it('earns none from the code that turns the factor on: somebody already signed in opens nothing new', async () => {
      const auth = build();
      const browser = await signUp(auth);
      const enabled = await call(auth, browser, '/two-factor/enable', { password: PASSWORD });
      rememberDevice.mockClear();

      await call(auth, browser, '/two-factor/verify-totp', { code: totp(enabled.body?.totpURI as string) });

      expect(rememberDevice).not.toHaveBeenCalled();
    });

    it('earns it when a trusted device signs in with no code: the sign-in is complete', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      const browser = new Browser();
      await call(auth, browser, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });
      await call(auth, browser, '/two-factor/verify-totp', { code: nextTotp(uri), trustDevice: true });
      await call(auth, browser, '/sign-out', {});
      rememberDevice.mockClear();

      await call(auth, browser, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      expect(rememberDevice).toHaveBeenCalledTimes(1);
    });

    it('lets a trusted device in with no code, counted once', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      const browser = new Browser();
      await call(auth, browser, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });
      await call(auth, browser, '/two-factor/verify-totp', { code: nextTotp(uri), trustDevice: true });
      await call(auth, browser, '/sign-out', {});
      analytics.mockClear();

      const again = await call(auth, browser, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      expect(again.body?.twoFactorRedirect).toBeUndefined();
      await expect(sessionOf(auth, browser)).resolves.toMatchObject({ user: { email: ACCOUNT.email } });
      expect(sessionsStarted()).toHaveLength(1);
    });
  });

  /* PLAN 011 phase 4, amended 2026-10-01: an authenticator code is accepted once. */
  describe('a code used twice', () => {
    it('refuses the same code on a second challenge exactly as a wrong code, and opens no session', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      const code = nextTotp(uri);
      const first = new Browser();
      await call(auth, first, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      expect((await call(auth, first, '/two-factor/verify-totp', { code })).status).toBe(200);

      const second = new Browser();
      await call(auth, second, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });
      const replayed = await call(auth, second, '/two-factor/verify-totp', { code });
      const wrong = await call(auth, second, '/two-factor/verify-totp', { code: code === '000000' ? '111111' : '000000' });

      expect(replayed).toMatchObject({ body: { code: 'INVALID_CODE' }, status: 401 });
      expect(replayed.raw).toBe(wrong.raw);
      expect(replayed.status).toBe(wrong.status);
      await expect(sessionOf(auth, second)).resolves.toBeNull();
    });

    it('refuses a code from a step older than the last one accepted, and accepts the next step’s', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      const challenge = new Browser();
      await call(auth, challenge, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      // The confirmation claimed the current step; the one before it is older still.
      const older = await call(auth, challenge, '/two-factor/verify-totp', { code: totp(uri, Date.now() - 30_000) });
      const next = await call(auth, challenge, '/two-factor/verify-totp', { code: nextTotp(uri) });

      expect(older).toMatchObject({ body: { code: 'INVALID_CODE' }, status: 401 });
      expect(next.status).toBe(200);
      await expect(sessionOf(auth, challenge)).resolves.toMatchObject({ user: { email: ACCOUNT.email } });
    });

    it('refuses the confirmation’s own code from a session too: the rule covers turning it on', async () => {
      const auth = build();
      const browser = await signUp(auth);
      const uri = (await call(auth, browser, '/two-factor/enable', { password: PASSWORD })).body?.totpURI as string;
      const code = totp(uri);

      expect((await call(auth, browser, '/two-factor/verify-totp', { code })).status).toBe(200);
      expect(await call(auth, browser, '/two-factor/verify-totp', { code })).toMatchObject({ body: { code: 'INVALID_CODE' }, status: 401 });
    });

    it('claims nothing for a wrong code, and nothing while the plugin would refuse anyway — a locked account', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      claimTotpStep.mockClear();
      const challenge = new Browser();
      await call(auth, challenge, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      const code = nextTotp(uri);
      await call(auth, challenge, '/two-factor/verify-totp', { code: code === '000000' ? '111111' : '000000' });
      expect(claimTotpStep).not.toHaveBeenCalled();

      const row = store.twoFactor[0] as Row;
      row.lockedUntil = new Date(Date.now() + 60_000);
      const locked = await call(auth, challenge, '/two-factor/verify-totp', { code });

      expect(locked.status).toBe(429);
      expect(claimTotpStep).not.toHaveBeenCalled();

      // Unlocked, the same code still works: the refusal did not spend its step.
      row.lockedUntil = null;
      row.failedVerificationCount = 0;
      expect((await call(auth, challenge, '/two-factor/verify-totp', { code })).status).toBe(200);
    });

    it('finds a code two steps ahead on a thirty-second boundary, which the plugin accepts a moment later, so it is claimed', () => {
      // The secret as the plugin stores it, keyed as UTF-8 bytes (`@better-auth/utils/otp`).
      const secret = 'a-secret-the-plugin-generated';

      const at = (step: number): string => {
        const counter = Buffer.alloc(8);
        counter.writeBigUInt64BE(BigInt(step));
        const mac = createHmac('sha1', Buffer.from(secret, 'utf8')).update(counter).digest();
        const offset = (mac.at(-1) ?? 0) & 0xf;

        return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
      };

      const step = 59_000_000;
      // The hook's clock: the last millisecond of `step`. The plugin's, a millisecond on, is in `step + 1`, and its
      // window (one either side) takes `step + 2`'s code.
      const lastMillisecond = (step + 1) * 30_000 - 1;

      expect(totpStepOf(secret, at(step + 2), lastMillisecond)).toBe(step + 2);
      expect(totpStepOf(secret, at(step - 2), lastMillisecond)).toBe(step - 2);
      expect(totpStepOf(secret, at(step), lastMillisecond)).toBe(step);
      // Three away no clock a millisecond apart accepts: left to the plugin, which refuses it as a wrong code.
      expect(totpStepOf(secret, at(step + 3), lastMillisecond)).toBeNull();
      expect(totpStepOf(secret, at(step - 3), lastMillisecond)).toBeNull();
    });
  });

  /* PLAN 011 phase 4: a correct code from the account cancels the owner's pending removal of its factor. */
  describe('a pending removal', () => {
    it('is cancelled by a code that finishes a sign-in, and the account is told', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      const userId = store.user[0]?.id as string;
      cancelRemovalByAccount.mockClear();
      cancelRemovalByAccount.mockResolvedValue({ email: ACCOUNT.email });
      const challenge = new Browser();
      await call(auth, challenge, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      const finished = await call(auth, challenge, '/two-factor/verify-totp', { code: nextTotp(uri) });
      await drain();

      expect(finished.status).toBe(200);
      expect(cancelRemovalByAccount).toHaveBeenCalledTimes(1);
      expect(cancelRemovalByAccount).toHaveBeenCalledWith(userId);
      expect(removalMails).toEqual([{ event: { kind: 'cancelled' }, to: ACCOUNT.email, userId }]);
    });

    it('is cancelled by a backup code too', async () => {
      const auth = build();
      const { codes } = await withFactor(auth);
      cancelRemovalByAccount.mockClear();
      const challenge = new Browser();
      await call(auth, challenge, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      await call(auth, challenge, '/two-factor/verify-backup-code', { code: codes[0] });

      expect(cancelRemovalByAccount).toHaveBeenCalledWith(store.user[0]?.id as string);
    });

    it('is cancelled by the code that turns the factor on', async () => {
      const auth = build();
      const browser = await signUp(auth);
      const uri = (await call(auth, browser, '/two-factor/enable', { password: PASSWORD })).body?.totpURI as string;

      await call(auth, browser, '/two-factor/verify-totp', { code: totp(uri) });

      expect(cancelRemovalByAccount).toHaveBeenCalledWith(store.user[0]?.id as string);
    });

    it('is not touched by a wrong or replayed code, and says nothing when none was pending', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      cancelRemovalByAccount.mockClear();
      const challenge = new Browser();
      await call(auth, challenge, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      await call(auth, challenge, '/two-factor/verify-totp', { code: '000000' === totp(uri) ? '111111' : '000000' });
      await call(auth, challenge, '/two-factor/verify-totp', { code: totp(uri) });
      expect(cancelRemovalByAccount).not.toHaveBeenCalled();

      await call(auth, challenge, '/two-factor/verify-totp', { code: nextTotp(uri) });
      await drain();
      expect(cancelRemovalByAccount).toHaveBeenCalledTimes(1);
      expect(removalMails).toEqual([]);
    });

    it('lets the sign-in through when the cancel fails, with a line that names only the account', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      cancelRemovalByAccount.mockRejectedValue(new Error('database down'));
      const challenge = new Browser();
      await call(auth, challenge, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      const finished = await call(auth, challenge, '/two-factor/verify-totp', { code: nextTotp(uri) });

      expect(finished.status).toBe(200);
      expect(logged.join('\n')).toContain(`two_factor_removal_uncancelled {"userId":"${store.user[0]?.id as string}"}`);
    });
  });

  describe('the secret', () => {
    it('never leaves again after /enable: /get-totp-uri is the 404, even with the session and the password', async () => {
      const auth = build();
      const { browser } = await withFactor(auth);

      const refused = await call(auth, browser, '/two-factor/get-totp-uri', { password: PASSWORD });

      expect(refused).toMatchObject({ raw: NOT_FOUND, status: 404 });
    });
  });

  describe('linking a provider', () => {
    type LinkContext = Parameters<typeof refusesLinkPastTheFactor>[1];

    function context(owner: Row | null, session: { user: { id: string } } | null): LinkContext {
      return {
        context: { internalAdapter: { findUserById: async () => Promise.resolve(owner) }, session },
        headers: new Headers()
      } as unknown as LinkContext;
    }

    it('refuses Google into an account with the factor on when no session of that account asks', async () => {
      await expect(
        refusesLinkPastTheFactor({ providerId: 'google', userId: 'usr-1' }, context({ id: 'usr-1', twoFactorEnabled: true }, null))
      ).resolves.toBe(true);
      await expect(
        refusesLinkPastTheFactor(
          { providerId: 'google', userId: 'usr-1' },
          context({ id: 'usr-1', twoFactorEnabled: true }, { user: { id: 'usr-2' } })
        )
      ).resolves.toBe(true);
    });

    it('lets the account’s own session link it, an account without the factor, and the password account itself', async () => {
      await expect(
        refusesLinkPastTheFactor(
          { providerId: 'google', userId: 'usr-1' },
          context({ id: 'usr-1', twoFactorEnabled: true }, { user: { id: 'usr-1' } })
        )
      ).resolves.toBe(false);
      await expect(
        refusesLinkPastTheFactor({ providerId: 'google', userId: 'usr-1' }, context({ id: 'usr-1', twoFactorEnabled: false }, null))
      ).resolves.toBe(false);
      await expect(
        refusesLinkPastTheFactor({ providerId: 'credential', userId: 'usr-1' }, context({ id: 'usr-1', twoFactorEnabled: true }, null))
      ).resolves.toBe(false);
    });

    it('is what createAuth’s account hook answers: false refuses the link, nothing lets it through', async () => {
      const before = build().options.databaseHooks?.account?.create?.before as unknown as (
        linked: Row,
        linkContext: LinkContext
      ) => Promise<false | undefined>;
      const linked = { accountId: 'g-1', providerId: 'google', userId: 'usr-1' };

      await expect(before(linked, context({ id: 'usr-1', twoFactorEnabled: true }, null))).resolves.toBe(false);
      await expect(before(linked, context({ id: 'usr-1', twoFactorEnabled: false }, null))).resolves.toBeUndefined();
    });
  });

  describe('email OTP', () => {
    it('sends nothing and grants nothing: both routes are the 404', async () => {
      const auth = build();
      await withFactor(auth);
      const browser = new Browser();
      await call(auth, browser, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });
      sentOtps.length = 0;

      const sent = await call(auth, browser, '/two-factor/send-otp', {});
      const verified = await call(auth, browser, '/two-factor/verify-otp', { code: '123456' });
      await drain();

      expect(sent).toMatchObject({ raw: NOT_FOUND, status: 404 });
      expect(verified).toMatchObject({ raw: NOT_FOUND, status: 404 });
      expect(sentOtps).toEqual([]);
      await expect(sessionOf(auth, browser)).resolves.toBeNull();
    });

    it('will not turn the factor on as email OTP', async () => {
      const auth = build();
      const browser = await signUp(auth);

      const refused = await call(auth, browser, '/two-factor/enable', { method: 'otp', password: PASSWORD });

      expect(refused).toMatchObject({ body: { code: 'OTP_NOT_CONFIGURED' }, status: 400 });
      expect(store.user[0]?.twoFactorEnabled).toBe(false);
      expect(twoFactorChanged).not.toHaveBeenCalled();
    });
  });

  describe('a backup code', () => {
    it('finishes a challenge once, with auth.backup_code_used and the count left, and never a second time', async () => {
      const auth = build();
      const { codes } = await withFactor(auth);
      const code = codes[0] ?? '';
      const userId = store.user[0]?.id as string;
      const first = new Browser();
      await call(auth, first, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      const used = await call(auth, first, '/two-factor/verify-backup-code', { code });
      await drain();

      expect(used.status).toBe(200);
      await expect(sessionOf(auth, first)).resolves.toMatchObject({ user: { email: ACCOUNT.email } });
      expect(backupCodeUsed).toHaveBeenCalledTimes(1);
      expect(backupCodeUsed).toHaveBeenCalledWith(userId, 9);
      expect(mails).toContainEqual({ event: { kind: 'backup-code-used', remaining: 9 }, to: ACCOUNT.email, userId });

      const second = new Browser();
      await call(auth, second, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });
      const again = await call(auth, second, '/two-factor/verify-backup-code', { code });

      expect(again).toMatchObject({ body: { code: 'INVALID_BACKUP_CODE' }, status: 401 });
      await expect(sessionOf(auth, second)).resolves.toBeNull();
      expect(backupCodeUsed).toHaveBeenCalledTimes(1);
    });
  });

  describe('turning it off and new codes', () => {
    it('refuses both without the password, and changes nothing', async () => {
      const auth = build();
      const { browser } = await withFactor(auth);
      twoFactorChanged.mockClear();

      const disable = await call(auth, browser, '/two-factor/disable', { password: 'not-the-password-at-all' });
      const regenerate = await call(auth, browser, '/two-factor/generate-backup-codes', { password: 'not-the-password-at-all' });

      expect(disable).toMatchObject({ body: { code: 'INVALID_PASSWORD' }, status: 400 });
      expect(regenerate).toMatchObject({ body: { code: 'INVALID_PASSWORD' }, status: 400 });
      expect(backupCodesRegenerated).not.toHaveBeenCalled();
      expect(store.user[0]?.twoFactorEnabled).toBe(true);
      expect(twoFactorChanged).not.toHaveBeenCalled();
    });

    it('says nothing when /disable finds the factor already off', async () => {
      const auth = build();
      const browser = await signUp(auth);

      const answered = await call(auth, browser, '/two-factor/disable', { password: PASSWORD });
      await drain();

      expect(answered.status).toBe(200);
      expect(twoFactorChanged).not.toHaveBeenCalled();
      expect(mails).toEqual([]);
    });

    it('turns it off with the password, writes auth.2fa_disabled and mails, and counts no visit', async () => {
      const auth = build();
      const { browser } = await withFactor(auth);
      const userId = store.user[0]?.id as string;
      analytics.mockClear();

      const disabled = await call(auth, browser, '/two-factor/disable', { password: PASSWORD });
      await drain();

      expect(disabled).toMatchObject({ body: { status: true }, status: 200 });
      expect(store.user[0]?.twoFactorEnabled).toBe(false);
      expect(store.twoFactor).toEqual([]);
      expect(twoFactorChanged).toHaveBeenCalledWith(userId, false);
      expect(mails).toContainEqual({ event: { kind: 'disabled' }, to: ACCOUNT.email, userId });
      expect(sessionsStarted()).toEqual([]);
      await expect(sessionOf(auth, browser)).resolves.toMatchObject({ user: { twoFactorEnabled: false } });
    });

    it('gives ten new codes with the password, and the old ones stop working', async () => {
      const auth = build();
      const { browser, codes } = await withFactor(auth);

      const fresh = await call(auth, browser, '/two-factor/generate-backup-codes', { password: PASSWORD });
      const challenge = new Browser();
      await call(auth, challenge, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });
      const old = await call(auth, challenge, '/two-factor/verify-backup-code', { code: codes[0] });

      expect(fresh.body?.backupCodes).toHaveLength(10);
      expect(old).toMatchObject({ body: { code: 'INVALID_BACKUP_CODE' }, status: 401 });
      await drain();
      const userId = store.user[0]?.id as string;
      expect(backupCodesRegenerated).toHaveBeenCalledTimes(1);
      expect(backupCodesRegenerated).toHaveBeenCalledWith(userId);
      expect(mails).toContainEqual({ event: { kind: 'backup-codes-regenerated' }, to: ACCOUNT.email, userId });
    });
  });

  describe('a password change or a reset', () => {
    it('leaves the factor on after a change: the next sign-in still asks for the code', async () => {
      const auth = build();
      const { browser } = await withFactor(auth);

      const changed = await call(auth, browser, '/change-password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
      const next = await call(auth, new Browser(), '/sign-in/email', { email: ACCOUNT.email, password: NEW_PASSWORD });

      expect(changed.status).toBe(200);
      expect(store.user[0]?.twoFactorEnabled).toBe(true);
      expect(next.body).toMatchObject({ twoFactorRedirect: true });
    });

    it('leaves the factor on after a reset: the next sign-in still asks for the code', async () => {
      const auth = build();
      await withFactor(auth);
      await auth.api.requestPasswordReset({ body: { email: ACCOUNT.email } });
      await drain();
      const token = new URL(resetUrls.at(-1) ?? '').pathname.split('/').at(-1) ?? '';

      const reset = await call(auth, new Browser(), '/reset-password', { newPassword: NEW_PASSWORD, token });
      const next = await call(auth, new Browser(), '/sign-in/email', { email: ACCOUNT.email, password: NEW_PASSWORD });

      expect(reset.status).toBe(200);
      expect(store.user[0]?.twoFactorEnabled).toBe(true);
      expect(next.body).toMatchObject({ twoFactorRedirect: true });
    });
  });

  it('never writes the secret, a backup code or a TOTP code to a log', async () => {
    const auth = build();
    const { browser, codes, uri } = await withFactor(auth);
    const challenge = new Browser();
    await call(auth, challenge, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });
    await call(auth, challenge, '/two-factor/verify-totp', { code: '000000' });
    await call(auth, challenge, '/two-factor/verify-backup-code', { code: codes[1] });
    const fresh = await call(auth, browser, '/two-factor/generate-backup-codes', { password: PASSWORD });
    await call(auth, browser, '/two-factor/disable', { password: PASSWORD });
    await drain();

    const secret = new URL(uri).searchParams.get('secret') ?? '';
    const raw = base32(secret).toString('utf8');
    const forbidden = [secret, raw, totp(uri), ...codes, ...(fresh.body?.backupCodes as string[])];
    const everything = logged.join('\n');

    for (const value of forbidden) {
      expect(everything).not.toContain(value);
    }
  });
});
