import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';

import { validateEnv } from '../../../config/Env.validation.js';
import { BackgroundTaskService } from '../../../shared/services/index.js';

/**
 * The password rule on the three doors (PLAN 011 phase 1, step 2).
 *
 * The real Better Auth, built by the real `createAuth`, on Better Auth's own
 * in-memory adapter — so what is proved is the hook as wired, not the hook on
 * its own: which field each door reads, whose words it holds the password to,
 * and that a refusal is the `{ code, message }` body the web app reads.
 *
 * HIBP is the one thing mocked: `isPasswordCompromised` is replaced, and the
 * spec builds `createAuth` under `NODE_ENV=development` where it must be
 * called and under `test` where it must not.
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
const isPasswordCompromised = jest.fn<(password: string) => Promise<boolean>>();

jest.unstable_mockModule('better-auth/adapters/drizzle', () => ({ drizzleAdapter: () => memoryAdapter(store) }));
jest.unstable_mockModule('better-auth/plugins/haveibeenpwned', () => ({ isPasswordCompromised }));
jest.unstable_mockModule('database', () => ({ database: () => ({}) }));
jest.unstable_mockModule('./SelfService.js', () => ({
  onAccountCreated: async () => Promise.resolve(),
  onAddressConfirmed: async () => Promise.resolve()
}));
jest.unstable_mockModule('./VerificationMail.js', () => ({ sendVerificationMail: async () => Promise.resolve() }));
jest.unstable_mockModule('./PasswordResetMail.js', () => ({
  sendPasswordResetMail: async (_mailer: unknown, { url }: { url: string }) => {
    resetUrls.push(url);

    return Promise.resolve();
  }
}));

const { createAuth } = await import('../auth.config.js');
const { breachedOrPass, HIBP_TIMEOUT_MS } = await import('./PasswordPolicy.js');

const PASSWORD = 'correct-horse-battery-staple-9';
const SECRET_PASSWORD = 'a-secret-that-must-stay-secret';
const ACCOUNT = { email: 'maria.garcia@example.invalid', name: 'María José García-López' };

function envFor(nodeEnv: 'development' | 'test') {
  return validateEnv({
    APP_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    NODE_ENV: nodeEnv
  });
}

function build(nodeEnv: 'development' | 'test' = 'test'): ReturnType<typeof createAuth> {
  return createAuth(
    envFor(nodeEnv),
    { configured: false, send: async () => Promise.resolve(false) },
    { cancelEverything: async () => Promise.resolve() },
    new BackgroundTaskService()
  );
}

/** What a call answered: its status and Better Auth's error code, or 200. */
async function outcome(call: Promise<unknown>): Promise<{ code?: string; status: number }> {
  try {
    await call;

    return { status: 200 };
  } catch (error) {
    const failure = error as { body?: { code?: string }; statusCode?: number };

    return { code: failure.body?.code, status: failure.statusCode ?? 500 };
  }
}

async function signUp(auth: ReturnType<typeof createAuth>, password: string, account: { email: string; name: string } = ACCOUNT) {
  return auth.api.signUpEmail({ body: { ...account, password }, returnHeaders: true });
}

/** The token of the last reset link sent, as the person would click it. */
async function resetToken(auth: ReturnType<typeof createAuth>, email: string): Promise<string> {
  await auth.api.requestPasswordReset({ body: { email } });
  const url = resetUrls.at(-1) ?? '';

  return new URL(url).pathname.split('/').at(-1) ?? '';
}

function sha1(text: string): string {
  return createHash('sha1').update(text).digest('hex').toUpperCase();
}

describe('the password rule on the three doors', () => {
  let warn: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    resetUrls.length = 0;
    isPasswordCompromised.mockReset();
    isPasswordCompromised.mockResolvedValue(false);
    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sign-up — the words are the body’s email and name', () => {
    it.each([
      ['the email’s local part', 'xx-MARIA.GARCIA-xx-long'],
      ['a word of the name, accent folded', 'jose-y-sus-amigos-largos'],
      ['the second half of a hyphenated surname', 'caballo-LOPEZ-azul-largo'],
      ['the service’s name', 'mi-cuenta-de-nutria-larga']
    ])('refuses %s with PASSWORD_HAS_CONTEXT', async (_case, password) => {
      await expect(outcome(signUp(build(), password))).resolves.toEqual({ code: 'PASSWORD_HAS_CONTEXT', status: 400 });
      expect(store.user).toHaveLength(0);
    });

    it('accepts a password with none of the words', async () => {
      await expect(outcome(signUp(build(), PASSWORD))).resolves.toEqual({ status: 200 });
      expect(store.user).toHaveLength(1);
    });

    it('leaves length to Better Auth: 11 characters is PASSWORD_TOO_SHORT even with a context word, 129 is PASSWORD_TOO_LONG', async () => {
      await expect(outcome(signUp(build(), 'maria-12345'))).resolves.toEqual({ code: 'PASSWORD_TOO_SHORT', status: 400 });
      await expect(outcome(signUp(build(), `maria${'x'.repeat(124)}`))).resolves.toEqual({ code: 'PASSWORD_TOO_LONG', status: 400 });
      await expect(outcome(signUp(build(), 'a'.repeat(12)))).resolves.toEqual({ status: 200 });
    });

    it('answers over HTTP with the `{ code, message }` body, and the message names no word', async () => {
      const auth = build();
      const response = await auth.handler(
        new Request(`http://localhost:3001${auth.options.basePath}/sign-up/email`, {
          body: JSON.stringify({ ...ACCOUNT, password: 'garcia-garcia-garcia' }),
          headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
          method: 'POST'
        })
      );
      const body = (await response.json()) as { code: string; message: string };

      expect(response.status).toBe(400);
      expect(body.code).toBe('PASSWORD_HAS_CONTEXT');
      expect(body.message.toLowerCase()).not.toMatch(/garcia|maria|jose|lopez/);
      expect(JSON.stringify(body)).not.toContain('garcia-garcia-garcia');
    });
  });

  describe('reset — the words are those of the account the token belongs to', () => {
    it('refuses a context word with the token left unspent, then takes a clean password with it', async () => {
      const auth = build();
      await signUp(auth, PASSWORD);
      const token = await resetToken(auth, ACCOUNT.email);

      await expect(outcome(auth.api.resetPassword({ body: { newPassword: 'garcia-por-siempre', token } }))).resolves.toEqual({
        code: 'PASSWORD_HAS_CONTEXT',
        status: 400
      });
      await expect(outcome(auth.api.resetPassword({ body: { newPassword: 'otra-frase-de-caballos', token } }))).resolves.toEqual({ status: 200 });
    });

    it('holds the password to the account’s words, not the body’s', async () => {
      const auth = build();
      await signUp(auth, PASSWORD);
      const token = await resetToken(auth, ACCOUNT.email);

      // An email sent in the body is not whose account this is.
      await expect(
        outcome(auth.api.resetPassword({ body: { email: 'someone@example.invalid', newPassword: 'jose-de-las-montanas', token } as never }))
      ).resolves.toEqual({ code: 'PASSWORD_HAS_CONTEXT', status: 400 });
    });

    it('skips its checks for an unknown token: Better Auth answers INVALID_TOKEN, never a context refusal', async () => {
      const auth = build('development');
      await signUp(auth, PASSWORD);
      isPasswordCompromised.mockClear();

      await expect(outcome(auth.api.resetPassword({ body: { newPassword: 'garcia-por-siempre', token: 'not-a-token' } }))).resolves.toEqual({
        code: 'INVALID_TOKEN',
        status: 400
      });
      expect(isPasswordCompromised).not.toHaveBeenCalled();
    });

    it('skips its checks for an expired token as well', async () => {
      const auth = build();
      await signUp(auth, PASSWORD);
      const token = await resetToken(auth, ACCOUNT.email);

      for (const row of store.verification) {
        row.expiresAt = new Date(Date.now() - 1000);
      }

      await expect(outcome(auth.api.resetPassword({ body: { newPassword: 'garcia-por-siempre', token } }))).resolves.toEqual({
        code: 'INVALID_TOKEN',
        status: 400
      });
    });

    it('reads the token from the query when the body has none, as Better Auth does', async () => {
      const auth = build();
      await signUp(auth, PASSWORD);
      const token = await resetToken(auth, ACCOUNT.email);

      await expect(outcome(auth.api.resetPassword({ body: { newPassword: 'garcia-por-siempre' }, query: { token } }))).resolves.toEqual({
        code: 'PASSWORD_HAS_CONTEXT',
        status: 400
      });
    });
    it('reads the query token when the body carries an empty one, as Better Auth does', async () => {
      const auth = build();
      await signUp(auth, PASSWORD);
      const token = await resetToken(auth, ACCOUNT.email);

      await expect(outcome(auth.api.resetPassword({ body: { newPassword: 'garcia-garcia-garcia', token: '' }, query: { token } }))).resolves.toEqual({
        code: 'PASSWORD_HAS_CONTEXT',
        status: 400
      });
    });

    it('prefers a body token over the query one, as Better Auth does', async () => {
      const auth = build();
      await signUp(auth, PASSWORD);
      const token = await resetToken(auth, ACCOUNT.email);

      // The body's live token is the one Better Auth spends; a dead query token beside it changes nothing.
      await expect(
        outcome(auth.api.resetPassword({ body: { newPassword: 'garcia-garcia-garcia', token }, query: { token: 'not-a-token' } }))
      ).resolves.toEqual({ code: 'PASSWORD_HAS_CONTEXT', status: 400 });
      // And a dead body token is the one it refuses, whatever the query holds.
      await expect(
        outcome(auth.api.resetPassword({ body: { newPassword: 'garcia-garcia-garcia', token: 'not-a-token' }, query: { token } }))
      ).resolves.toEqual({ code: 'INVALID_TOKEN', status: 400 });
    });
  });

  describe('change — the words are the session’s user’s', () => {
    it('refuses a context word for the signed-in account, accepts a clean one', async () => {
      const auth = build();
      const { headers } = await signUp(auth, PASSWORD);
      const cookie = new Headers({ cookie: (headers.get('set-cookie') ?? '').split(';')[0] ?? '' });

      await expect(
        outcome(auth.api.changePassword({ body: { currentPassword: PASSWORD, newPassword: 'maria-y-el-mar-azul' }, headers: cookie }))
      ).resolves.toEqual({ code: 'PASSWORD_HAS_CONTEXT', status: 400 });
      await expect(
        outcome(auth.api.changePassword({ body: { currentPassword: PASSWORD, newPassword: 'otra-frase-de-caballos' }, headers: cookie }))
      ).resolves.toEqual({ status: 200 });
    });

    it('holds the password to the session’s account, not to anybody else’s', async () => {
      const auth = build();
      await signUp(auth, PASSWORD, { email: 'pedro@example.invalid', name: 'Pedro' });
      const { headers } = await signUp(auth, PASSWORD);
      const cookie = new Headers({ cookie: (headers.get('set-cookie') ?? '').split(';')[0] ?? '' });

      // Pedro's name is not María's word.
      await expect(
        outcome(auth.api.changePassword({ body: { currentPassword: PASSWORD, newPassword: 'pedro-y-el-mar-azul' }, headers: cookie }))
      ).resolves.toEqual({ status: 200 });
    });

    it('with no session, leaves the answer to Better Auth: 401, never a context refusal', async () => {
      const auth = build();

      await expect(outcome(auth.api.changePassword({ body: { currentPassword: PASSWORD, newPassword: 'maria-y-el-mar-azul' } }))).resolves.toEqual({
        code: 'UNAUTHORIZED',
        status: 401
      });
    });
  });

  describe('HIBP, as wired', () => {
    it('is never called under NODE_ENV=test, on any door', async () => {
      const auth = build('test');
      const { headers } = await signUp(auth, PASSWORD);
      const cookie = new Headers({ cookie: (headers.get('set-cookie') ?? '').split(';')[0] ?? '' });
      await auth.api.changePassword({ body: { currentPassword: PASSWORD, newPassword: 'otra-frase-de-caballos' }, headers: cookie });
      const token = await resetToken(auth, ACCOUNT.email);
      await auth.api.resetPassword({ body: { newPassword: 'una-tercera-frase-larga', token } });

      expect(isPasswordCompromised).not.toHaveBeenCalled();
    });

    it('refuses a password it knows with PASSWORD_COMPROMISED, on every door', async () => {
      const auth = build('development');
      isPasswordCompromised.mockResolvedValue(true);
      await expect(outcome(signUp(auth, PASSWORD))).resolves.toEqual({ code: 'PASSWORD_COMPROMISED', status: 400 });
      expect(store.user).toHaveLength(0);

      isPasswordCompromised.mockResolvedValue(false);
      const { headers } = await signUp(auth, PASSWORD);
      const cookie = new Headers({ cookie: (headers.get('set-cookie') ?? '').split(';')[0] ?? '' });
      const token = await resetToken(auth, ACCOUNT.email);

      isPasswordCompromised.mockResolvedValue(true);
      await expect(
        outcome(auth.api.changePassword({ body: { currentPassword: PASSWORD, newPassword: 'otra-frase-de-caballos' }, headers: cookie }))
      ).resolves.toEqual({ code: 'PASSWORD_COMPROMISED', status: 400 });
      await expect(outcome(auth.api.resetPassword({ body: { newPassword: 'otra-frase-de-caballos', token } }))).resolves.toEqual({
        code: 'PASSWORD_COMPROMISED',
        status: 400
      });
    });

    it('accepts a password it does not know', async () => {
      await expect(outcome(signUp(build('development'), PASSWORD))).resolves.toEqual({ status: 200 });
      expect(isPasswordCompromised).toHaveBeenCalledWith(PASSWORD);
    });

    it('is asked only after the context check and the lengths have passed', async () => {
      const auth = build('development');

      await outcome(signUp(auth, 'mi-cuenta-de-nutria-larga'));
      await outcome(signUp(auth, 'too-short'));
      await outcome(signUp(auth, 'x'.repeat(129)));

      expect(isPasswordCompromised).not.toHaveBeenCalled();
    });

    it('lets sign-up through when HIBP errors, with one `hibp_unavailable` line', async () => {
      isPasswordCompromised.mockRejectedValue(new Error('Failed to check password. Status: 503'));

      await expect(outcome(signUp(build('development'), PASSWORD))).resolves.toEqual({ status: 200 });
      expect(warn).toHaveBeenCalledWith(`hibp_unavailable ${JSON.stringify({ reason: 'error', route: '/sign-up/email' })}`);
    });

    it(
      'lets sign-up through when HIBP does not answer within the timeout',
      async () => {
        isPasswordCompromised.mockReturnValue(new Promise<boolean>(() => undefined));
        const started = Date.now();

        await expect(outcome(signUp(build('development'), PASSWORD))).resolves.toEqual({ status: 200 });
        expect(Date.now() - started).toBeGreaterThanOrEqual(HIBP_TIMEOUT_MS - 50);
        expect(warn).toHaveBeenCalledWith(`hibp_unavailable ${JSON.stringify({ reason: 'timeout', route: '/sign-up/email' })}`);
      },
      HIBP_TIMEOUT_MS + 5000
    );
  });
});

describe('breachedOrPass', () => {
  let lines: string[];

  beforeEach(() => {
    lines = [];

    const capture = (...parts: unknown[]) => {
      lines.push(parts.map(part => (part instanceof Error ? `${part.message} ${part.stack ?? ''}` : String(part))).join(' '));
    };

    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(capture);
    }

    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      jest.spyOn(console, level).mockImplementation(capture);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('waits about two seconds for HIBP', () => {
    expect(HIBP_TIMEOUT_MS).toBe(2000);
  });

  it('is true on a hit and false on a miss, and logs nothing for either', async () => {
    await expect(breachedOrPass(SECRET_PASSWORD, '/sign-up/email', async () => Promise.resolve(true))).resolves.toBe(true);
    await expect(breachedOrPass(SECRET_PASSWORD, '/sign-up/email', async () => Promise.resolve(false))).resolves.toBe(false);
    expect(lines).toEqual([]);
  });

  it('fails open on a timeout, with one line naming the route and `timeout`', async () => {
    await expect(breachedOrPass(SECRET_PASSWORD, '/reset-password', async () => new Promise<boolean>(() => undefined), 20)).resolves.toBe(false);
    expect(lines).toEqual([`hibp_unavailable ${JSON.stringify({ reason: 'timeout', route: '/reset-password' })}`]);
  });

  it('fails open on a network error, with one line naming the route and `error`', async () => {
    await expect(breachedOrPass(SECRET_PASSWORD, '/change-password', async () => Promise.reject(new TypeError('fetch failed')))).resolves.toBe(false);
    expect(lines).toEqual([`hibp_unavailable ${JSON.stringify({ reason: 'error', route: '/change-password' })}`]);
  });

  it('does not trip on a check that rejects after the timeout has answered', async () => {
    const late = new Promise<boolean>((_resolve, reject) => setTimeout(() => reject(new Error('late')), 40));

    await expect(breachedOrPass(SECRET_PASSWORD, '/sign-up/email', async () => late, 10)).resolves.toBe(false);
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(lines).toHaveLength(1);
  });

  it('never logs the password, its SHA-1 or its HIBP prefix — even when the error carries them', async () => {
    const hash = sha1(SECRET_PASSWORD);
    const prefix = hash.slice(0, 5);
    const leaky = new Error(`request to https://api.pwnedpasswords.com/range/${prefix} failed (${hash}, ${SECRET_PASSWORD})`);

    await breachedOrPass(SECRET_PASSWORD, '/sign-up/email', async () => Promise.reject(leaky));
    await breachedOrPass(SECRET_PASSWORD, '/sign-up/email', async () => new Promise<boolean>(() => undefined), 10);

    expect(lines).toHaveLength(2);

    for (const line of lines) {
      expect(line).not.toContain(SECRET_PASSWORD);
      expect(line.toUpperCase()).not.toContain(hash);
      expect(line.toUpperCase()).not.toContain(prefix);
    }
  });
});
