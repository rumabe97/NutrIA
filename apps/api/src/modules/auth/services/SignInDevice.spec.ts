import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';
import { MailBudgetController } from 'core/controllers/MailBudget';
import { SignInBrakeController } from 'core/controllers/SignInBrake';
import { SignInDeviceController } from 'core/controllers/SignInDevice';
import { UserController } from 'core/controllers/User';
import { decideAttempt, signInBrakeKey } from 'core/domain/SignInBrake';
import { isSameAddress, newSignInDeviceToken, signInDeviceBrakeKey } from 'core/domain/SignInDevice';

import { validateEnv } from '../../../config/Env.validation.js';

import type { SignInAttempts } from 'core/domain/SignInBrake';

/**
 * The browser that signed in before is not braked (PLAN 011 phase 7b), on the
 * real Better Auth built by the real `createAuth` over its in-memory adapter,
 * driven over HTTP, as `SignInBrake.spec.ts` does.
 *
 * Swapped: the storage, the mails, the `UserController` and
 * `AnalyticsController` writes, the brake's rows and the device rows — maps
 * keyed as the tables are, behind the real rules (`decideAttempt`,
 * `isSameAddress`). The SQL is `packages/core`'s to prove. Every line written
 * to a Nest logger or the console is kept, to show no address reaches one.
 */
type Row = Record<string, unknown>;

const store: { account: Row[]; rateLimit: Row[]; session: Row[]; user: Row[]; verification: Row[] } = {
  account: [],
  rateLimit: [],
  session: [],
  user: [],
  verification: []
};
const resetUrls: string[] = [];

jest.unstable_mockModule('better-auth/adapters/drizzle', () => ({ drizzleAdapter: () => memoryAdapter(store) }));
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

const { createAuth } = await import('../auth.config.js');
const { deviceOnSignIn } = await import('./SignInDevice.js');

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery-staple-9';
const WRONG = 'not-the-password-at-all-9';
const ANA = { email: 'ana@example.invalid', name: 'Ana' };
const BEA = { email: 'bea@example.invalid', name: 'Bea' };
const STRANGER = 'nadie@example.invalid';
const SECRET = 'a'.repeat(32);
const NEW_PASSWORD = 'otra-frase-de-caballos-azules';

/** The key the brake counts an address under, and the key it counts a device cookie's token under. */
function addressKey(email: string): string {
  return signInBrakeKey(email, SECRET);
}

function deviceKey(cookie: string): string {
  return signInDeviceBrakeKey(cookie.split('=')[1] ?? '', SECRET);
}

/** The brake's table, by key, and the clock its decisions read. */
const brakeRows = new Map<string, SignInAttempts>();
/** The device rows: the token (the table keeps its digest) and the account it was earned for. */
const devices = new Map<string, string>();
let now = new Date('2026-10-09T10:00:00.000Z');
const lines: string[] = [];

function advance(ms: number): void {
  now = new Date(now.getTime() + ms);
}

function build(): ReturnType<typeof createAuth> {
  const env = validateEnv({
    APP_URL: ORIGIN,
    BETTER_AUTH_SECRET: SECRET,
    BETTER_AUTH_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    NODE_ENV: 'test'
  });

  return createAuth(
    env,
    { configured: true, send: async () => Promise.resolve(true) },
    { cancelEverything: async () => Promise.resolve() },
    { run: (_label: string, work: (() => Promise<unknown>) | Promise<unknown>) => void (typeof work === 'function' ? work() : work) }
  );
}

type Auth = ReturnType<typeof createAuth>;
type Answer = {
  body: Record<string, unknown> | null;
  /** The device cookie this answer set, whole, as the browser will read it. */
  device: string | null;
  retryAfter: string | null;
  /** The session cookie this answer set, as `name=value`. */
  session: string | null;
  status: number;
  xRetryAfter: string | null;
};

/** Which browser asks: the device cookie it holds, if any. */
async function call(auth: Auth, path: string, body: unknown, cookie?: string | null): Promise<Answer> {
  const response = await auth.handler(
    new Request(`http://localhost:3001${auth.options.basePath}${path}`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...(cookie ? { cookie } : {}) },
      method: 'POST'
    })
  );
  const text = await response.text();

  return {
    body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
    device: response.headers.getSetCookie().find(line => /sign_in_device=/.test(line)) ?? null,
    retryAfter: response.headers.get('retry-after'),
    session: (response.headers.getSetCookie().find(line => /session_token=[^;]/.test(line)) ?? '').split(';')[0] || null,
    status: response.status,
    xRetryAfter: response.headers.get('x-retry-after')
  };
}

async function signIn(auth: Auth, email: string, password: string, cookie?: string | null): Promise<Answer> {
  return call(auth, '/sign-in/email', { email, password }, cookie);
}

/** The `name=value` a browser sends back for the cookie a response set. */
function jar(answer: Answer): string {
  return (answer.device ?? '').split(';')[0] ?? '';
}

async function signUp(auth: Auth, account: { email: string; name: string }): Promise<void> {
  await call(auth, '/sign-up/email', { ...account, password: PASSWORD });

  const row = store.user.find(candidate => candidate.email === account.email);

  if (row) {
    row.emailVerified = true;
  }
}

async function fail(auth: Auth, email: string, n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    expect((await signIn(auth, email, WRONG)).status).toBe(401);
  }
}

jest.setTimeout(30_000);

describe('the device cookie that exempts a browser from the per-address brake', () => {
  let exempts: jest.SpiedFunction<typeof SignInDeviceController.exempts>;
  let forgetAll: jest.SpiedFunction<typeof SignInDeviceController.forgetAll>;

  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    brakeRows.clear();
    devices.clear();
    resetUrls.length = 0;
    lines.length = 0;
    now = new Date('2026-10-09T10:00:00.000Z');

    jest.spyOn(SignInBrakeController, 'attempt').mockImplementation(async key => {
      const decision = decideAttempt(brakeRows.get(key), now);

      if (decision.kind === 'allowed') {
        brakeRows.set(key, decision.next);
      }

      return Promise.resolve(decision);
    });
    jest.spyOn(SignInBrakeController, 'signedIn').mockImplementation(async key => {
      brakeRows.delete(key);

      return Promise.resolve();
    });
    exempts = jest.spyOn(SignInDeviceController, 'exempts').mockImplementation(async (token, email) => {
      const owner = token ? devices.get(token) : undefined;
      const account = store.user.find(candidate => candidate.id === owner);

      return Promise.resolve(typeof account?.email === 'string' && isSameAddress(account.email, email));
    });
    jest.spyOn(SignInDeviceController, 'remember').mockImplementation(async (userId, presented) => {
      if (presented && devices.get(presented) === userId) {
        return Promise.resolve(presented);
      }

      const token = newSignInDeviceToken();

      devices.set(token, userId);

      return Promise.resolve(token);
    });
    forgetAll = jest.spyOn(SignInDeviceController, 'forgetAll').mockResolvedValue(0);
    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(MailBudgetController, 'spend').mockResolvedValue(true);
    // The transaction's own effect on the device rows (`UserRepository.passwordChanged`, proved at SQL level in `packages/core`).
    jest.spyOn(UserController, 'passwordChanged').mockImplementation(async userId => {
      for (const [token, owner] of devices) {
        if (owner === userId) {
          devices.delete(token);
        }
      }

      return Promise.resolve(0);
    });

    const capture = (...args: unknown[]) => {
      lines.push(args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
    };

    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(capture);
      jest.spyOn(console, level).mockImplementation(capture);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('earning it', () => {
    it('sets it on a completed password sign-in: HttpOnly, SameSite=Lax, ninety days, with a token that names neither the address nor the account', async () => {
      const auth = build();
      await signUp(auth, ANA);

      const answer = await signIn(auth, ANA.email, PASSWORD);
      const cookie = answer.device ?? '';
      const value = jar(answer).split('=')[1] ?? '';
      const account = store.user.find(candidate => candidate.email === ANA.email);

      expect(answer.status).toBe(200);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//i);
      expect(cookie).toMatch(/Max-Age=7776000/i);
      expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(devices.get(value)).toBe(account?.id);
      expect(cookie).not.toContain(ANA.email);
      expect(cookie).not.toContain(String(account?.id));
    });

    it('is Secure, and prefixed so, in production, as the session cookie is', async () => {
      const production = createAuth(
        validateEnv({
          ALLOWED_ORIGINS: 'https://app.example.invalid',
          APP_URL: 'https://app.example.invalid',
          BETTER_AUTH_SECRET: 'a'.repeat(32),
          BETTER_AUTH_URL: 'https://api.example.invalid',
          DATABASE_URL: 'postgresql://user:pass@host/db',
          NODE_ENV: 'production'
        }),
        { configured: true, send: async () => Promise.resolve(true) },
        { cancelEverything: async () => Promise.resolve() },
        { run: () => undefined }
      );
      const { attributes, name } = (await production.$context).createAuthCookie('sign_in_device', { maxAge: 7_776_000 });

      expect(name).toMatch(/^__Secure-.*sign_in_device$/);
      expect(attributes).toMatchObject({ httpOnly: true, maxAge: 7_776_000, sameSite: 'lax', secure: true });
    });

    it('sets none on a wrong password, and none on a braked attempt', async () => {
      const auth = build();
      await signUp(auth, ANA);

      expect((await signIn(auth, ANA.email, WRONG)).device).toBeNull();

      await fail(auth, ANA.email, 9);

      const braked = await signIn(auth, ANA.email, PASSWORD);

      expect(braked.status).toBe(429);
      expect(braked.device).toBeNull();
      expect(devices.size).toBe(0);
    });

    it('renews the browser’s own cookie instead of issuing another, and issues a new one to a browser that has none', async () => {
      const auth = build();
      await signUp(auth, ANA);

      const first = await signIn(auth, ANA.email, PASSWORD);
      const again = await signIn(auth, ANA.email, PASSWORD, jar(first));
      const elsewhere = await signIn(auth, ANA.email, PASSWORD);

      expect(jar(again)).toBe(jar(first));
      expect(jar(elsewhere)).not.toBe(jar(first));
      expect(devices.size).toBe(2);
    });

    it('does not carry one account’s cookie to another: it earns the other account its own', async () => {
      const auth = build();
      await signUp(auth, ANA);
      await signUp(auth, BEA);

      const ana = await signIn(auth, ANA.email, PASSWORD);
      const bea = await signIn(auth, BEA.email, PASSWORD, jar(ana));

      expect(jar(bea)).not.toBe(jar(ana));
      expect(devices.size).toBe(2);
    });

    it('lets a sign-in succeed when the cookie cannot be written, and says so without the address', async () => {
      const auth = build();
      await signUp(auth, ANA);
      jest.spyOn(SignInDeviceController, 'remember').mockRejectedValue(new Error('database down'));

      const answer = await signIn(auth, ANA.email, PASSWORD);

      expect(answer.status).toBe(200);
      expect(answer.device).toBeNull();
      expect(lines.filter(line => line.includes('sign_in_device_unrecorded'))).toHaveLength(1);
      expect(lines.join('\n')).not.toContain(ANA.email);
    });
  });

  describe('using it', () => {
    it('lets the browser that earned it in with the right password while another client is braked', async () => {
      const auth = build();
      await signUp(auth, ANA);
      const mine = jar(await signIn(auth, ANA.email, PASSWORD));

      await fail(auth, ANA.email, 10);

      const stranger = await signIn(auth, ANA.email, PASSWORD);
      const owner = await signIn(auth, ANA.email, PASSWORD, mine);

      expect(stranger.status).toBe(429);
      expect(owner.status).toBe(200);
      expect(owner.body).toMatchObject({ user: { email: ANA.email } });
    });

    it('still checks the password: the cookie waives the brake and nothing else', async () => {
      const auth = build();
      await signUp(auth, ANA);
      const mine = jar(await signIn(auth, ANA.email, PASSWORD));

      await fail(auth, ANA.email, 10);

      const wrong = await signIn(auth, ANA.email, WRONG, mine);

      expect(wrong.status).toBe(401);
      expect(wrong.body).toMatchObject({ code: 'INVALID_EMAIL_OR_PASSWORD' });
    });

    it('counts that browser’s attempts under a key of its own: its typos slow only that browser, and the address’s wait does not move', async () => {
      const auth = build();
      await signUp(auth, ANA);
      const mine = jar(await signIn(auth, ANA.email, PASSWORD));

      await fail(auth, ANA.email, 10);
      const address = { ...brakeRows.get(addressKey(ANA.email)) };

      for (let i = 0; i < 5; i += 1) {
        expect((await signIn(auth, ANA.email, WRONG, mine)).status).toBe(401);
      }

      expect(brakeRows.get(addressKey(ANA.email))).toEqual(address);
      expect(brakeRows.get(deviceKey(mine))?.count).toBe(5);
      expect([...brakeRows.keys()].every(key => /^[0-9a-f]{64}$/.test(key))).toBe(true);
    });

    it('holds a stolen cookie to the brake’s rate: ten wrong passwords, then the same 429 and wait as anybody, in its own bucket', async () => {
      const auth = build();
      await signUp(auth, ANA);
      const stolen = jar(await signIn(auth, ANA.email, PASSWORD));

      await fail(auth, ANA.email, 10);
      advance(60_000);

      for (let i = 0; i < 10; i += 1) {
        expect((await signIn(auth, ANA.email, WRONG, stolen)).status).toBe(401);
      }

      const braked = await signIn(auth, ANA.email, PASSWORD, stolen);

      expect(braked).toMatchObject({ device: null, retryAfter: '30', status: 429, xRetryAfter: '30' });
      expect(braked.body).toEqual({ code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Try again later.' });
    });

    it('clears the device’s count and leaves the address’s wait alone when the owner signs in: an attacker is not given a fresh window', async () => {
      const auth = build();
      await signUp(auth, ANA);
      const mine = jar(await signIn(auth, ANA.email, PASSWORD));

      await fail(auth, ANA.email, 10);
      await signIn(auth, ANA.email, WRONG, mine);
      const address = { ...brakeRows.get(addressKey(ANA.email)) };

      expect((await signIn(auth, ANA.email, PASSWORD, mine)).status).toBe(200);

      expect(brakeRows.has(deviceKey(mine))).toBe(false);
      expect(brakeRows.get(addressKey(ANA.email))).toEqual(address);
      expect((await signIn(auth, ANA.email, PASSWORD)).status).toBe(429);
    });

    it('still clears the address’s count on a sign-in with no cookie, as before', async () => {
      const auth = build();
      await signUp(auth, ANA);

      await fail(auth, ANA.email, 3);
      expect(brakeRows.has(addressKey(ANA.email))).toBe(true);
      expect((await signIn(auth, ANA.email, PASSWORD)).status).toBe(200);
      expect(brakeRows.has(addressKey(ANA.email))).toBe(false);
    });

    it('does not exempt another address: a cookie earned for Ana leaves Bea’s braked address 429, to the byte', async () => {
      const auth = build();
      await signUp(auth, ANA);
      await signUp(auth, BEA);
      const ana = jar(await signIn(auth, ANA.email, PASSWORD));

      await fail(auth, BEA.email, 10);

      const without = await signIn(auth, BEA.email, PASSWORD);
      const withAnas = await signIn(auth, BEA.email, PASSWORD, ana);

      expect(withAnas).toEqual(without);
      expect(withAnas).toMatchObject({ device: null, retryAfter: '30', status: 429, xRetryAfter: '30' });
    });

    it('answers a cookie for an address with no account exactly as no cookie: the 429 is the same for a known and an unknown address', async () => {
      const auth = build();
      await signUp(auth, ANA);
      const ana = jar(await signIn(auth, ANA.email, PASSWORD));

      await fail(auth, ANA.email, 10);
      await fail(auth, STRANGER, 10);

      const unknown = await signIn(auth, STRANGER, WRONG, ana);
      const unknownBare = await signIn(auth, STRANGER, WRONG);
      const known = await signIn(auth, ANA.email, WRONG);

      expect(unknown).toEqual(unknownBare);
      expect(unknown).toEqual(known);
      expect(unknown).toMatchObject({ retryAfter: '30', status: 429, xRetryAfter: '30' });
    });

    it('answers a made-up cookie, an expired one and a malformed header exactly as no cookie', async () => {
      const auth = build();
      await signUp(auth, ANA);
      await fail(auth, ANA.email, 10);

      const bare = await signIn(auth, ANA.email, PASSWORD);

      for (const cookie of ['better-auth.sign_in_device=made-up-by-hand', 'better-auth.sign_in_device=', 'sign_in_device', '; ;=;']) {
        expect(await signIn(auth, ANA.email, PASSWORD, cookie)).toEqual(bare);
      }

      expect(bare.status).toBe(429);
    });

    it('applies the brake when the cookie cannot be checked, and says so without the address', async () => {
      const auth = build();
      await signUp(auth, ANA);
      const mine = jar(await signIn(auth, ANA.email, PASSWORD));

      await fail(auth, ANA.email, 10);
      exempts.mockRejectedValue(new Error('database down'));

      expect((await signIn(auth, ANA.email, PASSWORD, mine)).status).toBe(429);
      expect(lines.filter(line => line.includes('sign_in_device_unavailable'))).toHaveLength(1);
      expect(lines.join('\n')).not.toContain(ANA.email);
    });

    it('is matched to the address however it is cased, as Better Auth finds the account', async () => {
      const auth = build();
      await signUp(auth, ANA);
      const mine = jar(await signIn(auth, ANA.email, PASSWORD));

      await fail(auth, ANA.email, 10);

      expect((await signIn(auth, 'ANA@Example.invalid', PASSWORD, mine)).status).toBe(200);
    });
  });

  describe('losing it', () => {
    it('ends with a change of the password: the old cookie is braked like anybody, with the 429 a cookieless request gets', async () => {
      const auth = build();
      await signUp(auth, ANA);
      const earned = await signIn(auth, ANA.email, PASSWORD);
      const mine = jar(earned);
      const changed = await call(auth, '/change-password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, `${earned.session}; ${mine}`);

      expect(changed.status).toBe(200);
      expect(devices.size).toBe(0);

      await fail(auth, ANA.email, 10);

      const withOld = await signIn(auth, ANA.email, NEW_PASSWORD, mine);
      const bare = await signIn(auth, ANA.email, NEW_PASSWORD);

      expect(withOld).toEqual(bare);
      expect(withOld.status).toBe(429);
    });

    it('ends with a reset of the password when the transaction that clears the rest fails: the cookies are removed on their own', async () => {
      const auth = build();
      await signUp(auth, ANA);
      const account = store.user.find(candidate => candidate.email === ANA.email);

      jest.spyOn(UserController, 'passwordChanged').mockRejectedValue(new Error('database down'));
      jest.spyOn(UserController, 'forgetPasskeys').mockResolvedValue(0);

      await auth.api.requestPasswordReset({ body: { email: ANA.email } });
      await new Promise(resolve => setImmediate(resolve));

      const token = new URL(resetUrls.at(-1) ?? '').pathname.split('/').at(-1) ?? '';

      expect((await call(auth, '/reset-password', { newPassword: 'otra-frase-de-caballos-azules', token })).status).toBe(200);
      expect(forgetAll).toHaveBeenCalledWith(String(account?.id));
    });
  });
});

describe('deviceOnSignIn', () => {
  type Context = { context: { newSession: { user: { id: string } } | null; session: { session: unknown } | null }; path: string };

  const remember = jest.fn<(context: unknown, userId: string) => Promise<void>>();
  const hook = deviceOnSignIn({ remember }).hooks?.after?.[0];

  function matches(path: string, session: Context['context']['session']): boolean {
    return hook?.matcher({ context: { newSession: null, session }, path } as never) ?? false;
  }

  beforeEach(() => {
    remember.mockReset();
  });

  it('is listed to run on a password sign-in and on the two routes that finish a second-factor challenge, and on nothing else', () => {
    expect(matches('/sign-in/email', null)).toBe(true);
    expect(matches('/two-factor/verify-totp', null)).toBe(true);
    expect(matches('/two-factor/verify-backup-code', null)).toBe(true);

    for (const path of ['/sign-in/social', '/passkey/verify-authentication', '/sign-up/email', '/change-password', '/two-factor/enable']) {
      expect(matches(path, null)).toBe(false);
    }
  });

  it('does not run on a code verified by somebody already signed in: turning the factor on opens nothing new', () => {
    expect(matches('/two-factor/verify-totp', { session: {} })).toBe(false);
    expect(matches('/two-factor/verify-backup-code', { session: {} })).toBe(false);
  });

  it('earns the cookie for the account whose session is open', async () => {
    await hook?.handler({ context: { newSession: { user: { id: 'usr-1' } }, session: null }, path: '/sign-in/email' } as never);

    expect(remember).toHaveBeenCalledWith(expect.anything(), 'usr-1');
  });

  it('earns nothing while a second-factor challenge is pending: the plugin has left no session', async () => {
    await hook?.handler({ context: { newSession: null, session: null }, path: '/sign-in/email' } as never);

    expect(remember).not.toHaveBeenCalled();
  });
});
