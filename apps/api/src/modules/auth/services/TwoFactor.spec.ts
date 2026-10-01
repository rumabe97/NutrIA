import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';
import { UserController } from 'core/controllers/User';

import { validateEnv } from '../../../config/Env.validation.js';

import type { TwoFactorEvent } from '../../email/templates/TwoFactorChanged.js';

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
jest.unstable_mockModule('./TwoFactorMail.js', () => ({
  sendTwoFactorMail: async (_mailer: unknown, { event, to, userId }: { event: TwoFactorEvent; to: string; userId: string }) => {
    mails.push({ event, to, userId });

    return Promise.resolve();
  }
}));

const { createAuth } = await import('../auth.config.js');
const { refusesLinkPastTheFactor } = await import('./TwoFactor.js');

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

async function signUp(auth: Auth): Promise<Browser> {
  const browser = new Browser();
  await call(auth, browser, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });

  return browser;
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
  let analytics: jest.SpiedFunction<typeof AnalyticsController.record>;
  const logged: string[] = [];

  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    resetUrls.length = 0;
    mails.length = 0;
    sentOtps.length = 0;
    tasks.length = 0;
    logged.length = 0;
    twoFactorChanged = jest.spyOn(UserController, 'twoFactorChanged').mockResolvedValue(undefined);
    backupCodeUsed = jest.spyOn(UserController, 'backupCodeUsed').mockResolvedValue(undefined);
    jest.spyOn(UserController, 'passwordChanged').mockResolvedValue(undefined);
    jest.spyOn(UserController, 'sessionsRevoked').mockResolvedValue(undefined);
    analytics = jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(AnalyticsController, 'recordUse').mockResolvedValue(undefined);

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
      expect(store.user[0]?.twoFactorEnabled).toBe(true);
      expect(twoFactorChanged).toHaveBeenCalledTimes(1);
      expect(twoFactorChanged).toHaveBeenCalledWith(userId, true);
      expect(mails).toEqual([]);
      await drain();
      expect(mails).toEqual([{ event: { kind: 'enabled' }, to: ACCOUNT.email, userId }]);
      // The rotation of the session the person already had is not a visit.
      expect(sessionsStarted()).toHaveLength(1);
      await expect(sessionOf(auth, browser)).resolves.toMatchObject({ user: { twoFactorEnabled: true } });
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

      const finished = await call(auth, browser, '/two-factor/verify-totp', { code: totp(uri) });

      expect(finished.status).toBe(200);
      await expect(sessionOf(auth, browser)).resolves.toMatchObject({ user: { email: ACCOUNT.email } });
      expect(sessionsStarted()).toEqual([['session_started', store.user[0]?.id]]);
      expect(twoFactorChanged).not.toHaveBeenCalled();
    });

    it('lets a trusted device in with no code, counted once', async () => {
      const auth = build();
      const { uri } = await withFactor(auth);
      const browser = new Browser();
      await call(auth, browser, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });
      await call(auth, browser, '/two-factor/verify-totp', { code: totp(uri), trustDevice: true });
      await call(auth, browser, '/sign-out', {});
      analytics.mockClear();

      const again = await call(auth, browser, '/sign-in/email', { email: ACCOUNT.email, password: PASSWORD });

      expect(again.body?.twoFactorRedirect).toBeUndefined();
      await expect(sessionOf(auth, browser)).resolves.toMatchObject({ user: { email: ACCOUNT.email } });
      expect(sessionsStarted()).toHaveLength(1);
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
