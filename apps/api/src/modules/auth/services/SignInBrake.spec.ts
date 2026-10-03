import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';
import { SignInBrakeController } from 'core/controllers/SignInBrake';
import { UserController } from 'core/controllers/User';
import { decideAttempt } from 'core/domain/SignInBrake';

import { validateEnv } from '../../../config/Env.validation.js';

import type { SignInAttempts } from 'core/domain/SignInBrake';

/**
 * The per-address sign-in brake (PLAN 011 phase 7), on the real Better Auth
 * built by the real `createAuth` over its in-memory adapter, driven over HTTP.
 *
 * Swapped: the storage, the mails, the `UserController` and
 * `AnalyticsController` writes, and the brake's rows — a map keyed as the
 * table is, decided by the real `decideAttempt` on a clock the case moves
 * (the SQL and its lock are `packages/core`'s to prove). Every line written to
 * a Nest logger or the console is kept, to show no address reaches one.
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

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery-staple-9';
const WRONG = 'not-the-password-at-all-9';
const NEW_PASSWORD = 'otra-frase-de-caballos-azules';
const ACCOUNT = { email: 'ana@example.invalid', name: 'Ana' };
const STRANGER = 'nadie@example.invalid';

/** The brake's table, by key, and the clock its decisions read. */
const brakeRows = new Map<string, SignInAttempts>();
let now = new Date('2026-10-03T10:00:00.000Z');
const lines: string[] = [];

function advance(ms: number): void {
  now = new Date(now.getTime() + ms);
}

function build(): ReturnType<typeof createAuth> {
  const env = validateEnv({
    APP_URL: ORIGIN,
    BETTER_AUTH_SECRET: 'a'.repeat(32),
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
type Answer = { body: Record<string, unknown> | null; retryAfter: string | null; session: boolean; status: number; xRetryAfter: string | null };

async function call(auth: Auth, path: string, body: unknown): Promise<Answer> {
  const response = await auth.handler(
    new Request(`http://localhost:3001${auth.options.basePath}${path}`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      method: 'POST'
    })
  );
  const text = await response.text();

  return {
    body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
    retryAfter: response.headers.get('retry-after'),
    session: response.headers.getSetCookie().some(line => /session_token=[^;]/.test(line)),
    status: response.status,
    xRetryAfter: response.headers.get('x-retry-after')
  };
}

async function signIn(auth: Auth, email: string, password: string): Promise<Answer> {
  return call(auth, '/sign-in/email', { email, password });
}

/** `n` wrong passwords for `email`, each answered 401. */
async function fail(auth: Auth, email: string, n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    expect((await signIn(auth, email, WRONG)).status).toBe(401);
  }
}

describe('the per-address sign-in brake', () => {
  let attempt: jest.SpiedFunction<typeof SignInBrakeController.attempt>;

  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    brakeRows.clear();
    resetUrls.length = 0;
    lines.length = 0;
    now = new Date('2026-10-03T10:00:00.000Z');

    attempt = jest.spyOn(SignInBrakeController, 'attempt').mockImplementation(async key => {
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
    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(UserController, 'passwordChanged').mockResolvedValue(0);

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

  it('answers 429 with Retry-After after ten failures, before the password is even checked', async () => {
    const auth = build();
    await call(auth, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });

    await fail(auth, ACCOUNT.email, 10);
    const braked = await signIn(auth, ACCOUNT.email, PASSWORD);

    expect(braked).toEqual({
      body: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Try again later.' },
      retryAfter: '30',
      session: false,
      status: 429,
      xRetryAfter: '30'
    });
  });

  it('lets the right password in once the wait is over, and starts the address from nothing', async () => {
    const auth = build();
    await call(auth, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });
    await fail(auth, ACCOUNT.email, 10);

    advance(29_000);
    expect((await signIn(auth, ACCOUNT.email, PASSWORD)).retryAfter).toBe('1');

    advance(1_000);
    const signedIn = await signIn(auth, ACCOUNT.email, PASSWORD);

    expect(signedIn.status).toBe(200);
    expect(signedIn.session).toBe(true);
    expect(brakeRows.size).toBe(0);
    await fail(auth, ACCOUNT.email, 9);
    expect((await signIn(auth, ACCOUNT.email, PASSWORD)).status).toBe(200);
  });

  it('doubles the wait after each failure past the tenth, and never more than fifteen minutes', async () => {
    const auth = build();
    await call(auth, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });
    await fail(auth, ACCOUNT.email, 10);

    const waits: (string | null)[] = [];

    for (let i = 0; i < 7; i += 1) {
      const braked = await signIn(auth, ACCOUNT.email, WRONG);

      waits.push(braked.retryAfter);
      advance(Number(braked.retryAfter) * 1000);
      expect((await signIn(auth, ACCOUNT.email, WRONG)).status).toBe(401);
    }

    expect(waits).toEqual(['30', '60', '120', '240', '480', '900', '900']);
  });

  it('brakes an address with no account exactly as one with an account: same status, same body, same wait', async () => {
    const auth = build();
    await call(auth, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });

    await fail(auth, ACCOUNT.email, 10);
    await fail(auth, STRANGER, 10);

    const known = await signIn(auth, ACCOUNT.email, WRONG);
    const unknown = await signIn(auth, STRANGER, WRONG);

    expect(unknown).toEqual(known);
    expect(unknown.status).toBe(429);
  });

  it('counts an address however it is cased, as Better Auth finds the account', async () => {
    const auth = build();
    await call(auth, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });

    await fail(auth, ACCOUNT.email, 5);
    await fail(auth, ACCOUNT.email.toUpperCase(), 5);

    expect((await signIn(auth, 'Ana@Example.invalid', PASSWORD)).status).toBe(429);
  });

  it('counts each address on its own: another address is not braked by this one', async () => {
    const auth = build();
    await call(auth, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });

    await fail(auth, STRANGER, 10);

    expect((await signIn(auth, ACCOUNT.email, PASSWORD)).status).toBe(200);
  });

  it('keeps no address: every key is a 64-hex HMAC, and no logged line names the address', async () => {
    const auth = build();
    await call(auth, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });
    await fail(auth, ACCOUNT.email, 10);
    await fail(auth, STRANGER, 10);
    await signIn(auth, ACCOUNT.email, PASSWORD);

    expect(brakeRows.size).toBe(2);

    for (const key of brakeRows.keys()) {
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    }

    expect(lines.join('\n')).not.toMatch(/ana@|nadie@/i);
  });

  it('counts only password sign-ins: sign-up and the passkey sign-in never pass through it', async () => {
    const auth = build();
    await call(auth, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });
    await call(auth, '/passkey/verify-authentication', { response: {} });

    expect(attempt).not.toHaveBeenCalled();
  });

  it('is cleared by a reset: whoever holds the mailbox does not wait out somebody else’s guesses', async () => {
    const auth = build();
    await call(auth, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });
    await fail(auth, ACCOUNT.email, 10);

    await auth.api.requestPasswordReset({ body: { email: ACCOUNT.email } });
    await new Promise(resolve => setImmediate(resolve));
    const token = new URL(resetUrls.at(-1) ?? '').pathname.split('/').at(-1) ?? '';

    expect((await call(auth, '/reset-password', { newPassword: NEW_PASSWORD, token })).status).toBe(200);
    expect((await signIn(auth, ACCOUNT.email, NEW_PASSWORD)).status).toBe(200);
  });

  it('fails open: if its row cannot be read, the sign-in goes on and one line says so, without the address', async () => {
    const auth = build();
    await call(auth, '/sign-up/email', { ...ACCOUNT, password: PASSWORD });
    attempt.mockRejectedValue(new Error('database down'));

    expect((await signIn(auth, ACCOUNT.email, PASSWORD)).status).toBe(200);
    expect(lines.filter(line => line.includes('sign_in_brake_unavailable'))).toHaveLength(1);
    expect(lines.join('\n')).not.toContain(ACCOUNT.email);
  });
});
