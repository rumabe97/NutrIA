import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';
import { UserController } from 'core/controllers/User';

import { validateEnv } from '../../../config/Env.validation.js';

/**
 * What follows a password change, a closed session and a sign-in (PLAN 011
 * phase 2), on the real Better Auth built by the real `createAuth` over its
 * in-memory adapter, driven over HTTP with real cookies.
 *
 * Swapped: the storage, HIBP (`isPasswordCompromised`), the mail (captured,
 * never sent), the three `UserController` writes (spied — their SQL is
 * `packages/core`'s to prove) and the background runner (collected, so a case
 * can say what ran before the response and what after).
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
const mails: { passkeysRemoved?: number; to: string; userAgent: string | null; userId: string }[] = [];
const isPasswordCompromised = jest.fn<(password: string) => Promise<boolean>>();

jest.unstable_mockModule('better-auth/adapters/drizzle', () => ({ drizzleAdapter: () => memoryAdapter(store) }));
jest.unstable_mockModule('better-auth/plugins/haveibeenpwned', () => ({ isPasswordCompromised }));
jest.unstable_mockModule('database', () => ({ database: () => ({}) }));
const addressesConfirmed: string[] = [];

jest.unstable_mockModule('./SelfService.js', () => ({
  onAccountCreated: async () => Promise.resolve(),
  onAddressConfirmed: async ({ email }: { email: string }) => {
    addressesConfirmed.push(email);

    return Promise.resolve('waiting');
  }
}));
jest.unstable_mockModule('./VerificationMail.js', () => ({ sendVerificationMail: async () => Promise.resolve() }));
jest.unstable_mockModule('./PasswordResetMail.js', () => ({
  sendPasswordResetMail: async (_mailer: unknown, { url }: { url: string }) => {
    resetUrls.push(url);

    return Promise.resolve();
  }
}));
jest.unstable_mockModule('./PasswordChangedMail.js', () => ({
  sendPasswordChangedMail: async (
    _mailer: unknown,
    { passkeysRemoved, to, userAgent, userId }: { passkeysRemoved?: number; to: string; userAgent: string | null; userId: string }
  ) => {
    mails.push({ ...(passkeysRemoved ? { passkeysRemoved } : {}), to, userAgent, userId });

    return Promise.resolve();
  }
}));

const { createAuth } = await import('../auth.config.js');

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery-staple-9';
const NEW_PASSWORD = 'otra-frase-de-caballos-azules';
const ACCOUNT = { email: 'ana@example.invalid', name: 'Ana' };
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const LAPTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

/** Background work, held instead of run detached: `drain()` is "after the response", and runs what was handed over until nothing is left. */
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

function build(nodeEnv: 'development' | 'test' = 'test'): ReturnType<typeof createAuth> {
  const env = validateEnv({
    APP_URL: ORIGIN,
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    NODE_ENV: nodeEnv
  });

  return createAuth(
    env,
    { configured: true, send: async () => Promise.resolve(true) },
    { cancelEverything: async () => Promise.resolve() },
    background
  );
}

type Auth = ReturnType<typeof createAuth>;

async function call(
  auth: Auth,
  path: string,
  { body, cookie, method = 'POST', userAgent = LAPTOP }: { body?: unknown; cookie?: string; method?: string; userAgent?: string } = {}
): Promise<{ body: Record<string, unknown> | null; cookie: string | null; status: number }> {
  const response = await auth.handler(
    new Request(`http://localhost:3001${auth.options.basePath}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'content-type': 'application/json', origin: ORIGIN, 'user-agent': userAgent, ...(cookie ? { cookie } : {}) },
      method
    })
  );
  const session = response.headers
    .getSetCookie()
    .map(line => line.split(';')[0] ?? '')
    .find(pair => pair.includes('session_token=') && !pair.endsWith('='));
  const text = await response.text();

  return { body: text ? (JSON.parse(text) as Record<string, unknown>) : null, cookie: session ?? null, status: response.status };
}

/** Confirms the address in the store, as its link would: an unconfirmed account cannot sign in with its password (PLAN 011 phase 8). */
function confirm(email: string): void {
  const row = store.user.find(candidate => candidate.email === email);

  if (row) {
    row.emailVerified = true;
  }
}

/** Signed up and confirmed, then signed in — sign-up opens no session (PLAN 011 phase 8) — with the sign-in's cookie. */
async function signUp(auth: Auth): Promise<string> {
  await call(auth, '/sign-up/email', { body: { ...ACCOUNT, password: PASSWORD } });
  confirm(ACCOUNT.email);

  const { cookie } = await call(auth, '/sign-in/email', { body: { email: ACCOUNT.email, password: PASSWORD } });

  return cookie ?? '';
}

async function signIn(auth: Auth, userAgent = LAPTOP, password = PASSWORD) {
  return call(auth, '/sign-in/email', { body: { email: ACCOUNT.email, password }, userAgent });
}

async function sessionOf(auth: Auth, cookie: string): Promise<{ user: Row } | null> {
  return auth.api.getSession({ headers: new Headers({ cookie }) }) as Promise<{ user: Row } | null>;
}

/** The `UserController` writes, spied; their SQL is `packages/core`'s to prove. */
function spyWrites() {
  return {
    // The address confirmed in the store as the repository would: only while it was not.
    confirmAddressByReset: jest.spyOn(UserController, 'confirmAddressByReset').mockImplementation(async id => {
      const row = store.user.find(candidate => candidate.id === id);
      const was = row?.emailVerified === true;

      if (row) {
        row.emailVerified = true;
      }

      return Promise.resolve(Boolean(row) && !was);
    }),
    forgetPasskeys: jest.spyOn(UserController, 'forgetPasskeys').mockResolvedValue(0),
    markPasswordCompromised: jest.spyOn(UserController, 'markPasswordCompromised').mockResolvedValue(true),
    passwordChanged: jest.spyOn(UserController, 'passwordChanged').mockResolvedValue(0),
    sessionsRevoked: jest.spyOn(UserController, 'sessionsRevoked').mockResolvedValue(undefined)
  };
}

describe('what follows a password change, a closed session and a sign-in', () => {
  let writes: ReturnType<typeof spyWrites>;

  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    resetUrls.length = 0;
    mails.length = 0;
    addressesConfirmed.length = 0;
    tasks.length = 0;
    isPasswordCompromised.mockReset();
    isPasswordCompromised.mockResolvedValue(false);
    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(AnalyticsController, 'recordUse').mockResolvedValue(undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    writes = spyWrites();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('/change-password', () => {
    it('closes every other session even when the body says revokeOtherSessions: false', async () => {
      const auth = build();
      await signUp(auth);
      const phone = (await signIn(auth, IPHONE)).cookie ?? '';
      const laptop = (await signIn(auth, LAPTOP)).cookie ?? '';

      const changed = await call(auth, '/change-password', {
        body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, revokeOtherSessions: false },
        cookie: laptop
      });

      expect(changed.status).toBe(200);
      expect(changed.body?.token).toEqual(expect.any(String));
      expect(changed.cookie).not.toBeNull();
      await expect(sessionOf(auth, phone)).resolves.toBeNull();
      await expect(sessionOf(auth, laptop)).resolves.toBeNull();
      await expect(sessionOf(auth, changed.cookie ?? '')).resolves.toMatchObject({ user: { email: ACCOUNT.email } });
      expect(store.session).toHaveLength(1);
    });

    it('closes them with no revokeOtherSessions in the body at all', async () => {
      const auth = build();
      const first = await signUp(auth);
      const laptop = (await signIn(auth)).cookie ?? '';

      await call(auth, '/change-password', { body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, cookie: laptop });

      await expect(sessionOf(auth, first)).resolves.toBeNull();
    });

    it('records the change and mails the account, the mail in the background with the device that asked', async () => {
      const auth = build();
      await signUp(auth);
      const phone = (await signIn(auth, IPHONE)).cookie ?? '';

      await call(auth, '/change-password', { body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, cookie: phone, userAgent: IPHONE });

      const userId = store.user[0]?.id as string;

      expect(writes.passwordChanged).toHaveBeenCalledTimes(1);
      expect(writes.passwordChanged).toHaveBeenCalledWith(userId, 'change');
      expect(mails).toEqual([]);
      await drain();
      expect(mails).toEqual([{ to: ACCOUNT.email, userAgent: IPHONE, userId }]);
    });

    it('refuses a wrong current password with INVALID_PASSWORD, and records, mails and closes nothing', async () => {
      const auth = build();
      const first = await signUp(auth);
      const laptop = (await signIn(auth)).cookie ?? '';

      const refused = await call(auth, '/change-password', {
        body: { currentPassword: 'not-the-password-at-all', newPassword: NEW_PASSWORD },
        cookie: laptop
      });
      await drain();

      expect(refused).toMatchObject({ body: { code: 'INVALID_PASSWORD' }, status: 400 });
      expect(writes.passwordChanged).not.toHaveBeenCalled();
      expect(mails).toEqual([]);
      await expect(sessionOf(auth, first)).resolves.not.toBeNull();
    });

    it('still answers 200 when the record cannot be written — the password did change', async () => {
      writes.passwordChanged.mockRejectedValue(new Error('database unavailable'));
      const auth = build();
      const laptop = await signUp(auth);

      const changed = await call(auth, '/change-password', { body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, cookie: laptop });

      expect(changed.status).toBe(200);
    });

    it('tells the mail how many passkeys the change removed (0083)', async () => {
      writes.passwordChanged.mockResolvedValue(3);
      const auth = build();
      const laptop = await signUp(auth);

      await call(auth, '/change-password', { body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, cookie: laptop, userAgent: IPHONE });
      await drain();

      expect(writes.forgetPasskeys).not.toHaveBeenCalled();
      expect(mails).toEqual([{ passkeysRemoved: 3, to: ACCOUNT.email, userAgent: IPHONE, userId: store.user[0]?.id as string }]);
    });
  });

  describe('a reset', () => {
    it('records the change by the other door and mails the account', async () => {
      const auth = build();
      await signUp(auth);
      await auth.api.requestPasswordReset({ body: { email: ACCOUNT.email } });
      await drain();
      const token = new URL(resetUrls.at(-1) ?? '').pathname.split('/').at(-1) ?? '';

      const reset = await call(auth, '/reset-password', { body: { newPassword: NEW_PASSWORD, token }, userAgent: IPHONE });
      await drain();

      expect(reset.status).toBe(200);
      expect(writes.passwordChanged).toHaveBeenCalledWith(store.user[0]?.id as string, 'reset');
      expect(mails).toEqual([{ to: ACCOUNT.email, userAgent: IPHONE, userId: store.user[0]?.id as string }]);
    });

    it('confirms an unconfirmed address, with what confirming runs, and the new password then signs in (PLAN 011 phase 8)', async () => {
      const auth = build();
      // Signed up by somebody else, never confirmed: their password, not the owner's.
      await call(auth, '/sign-up/email', { body: { ...ACCOUNT, password: PASSWORD } });
      await auth.api.requestPasswordReset({ body: { email: ACCOUNT.email } });
      await drain();
      const token = new URL(resetUrls.at(-1) ?? '').pathname.split('/').at(-1) ?? '';

      expect((await signIn(auth, IPHONE, PASSWORD)).status).toBe(401);
      expect((await call(auth, '/reset-password', { body: { newPassword: NEW_PASSWORD, token }, userAgent: IPHONE })).status).toBe(200);

      expect(store.user[0]?.emailVerified).toBe(true);
      expect(addressesConfirmed).toEqual([ACCOUNT.email]);
      expect((await signIn(auth, IPHONE, NEW_PASSWORD)).status).toBe(200);
    });

    it('runs nothing of confirming for an address already confirmed', async () => {
      const auth = build();
      await signUp(auth);
      await auth.api.requestPasswordReset({ body: { email: ACCOUNT.email } });
      await drain();
      const token = new URL(resetUrls.at(-1) ?? '').pathname.split('/').at(-1) ?? '';

      await call(auth, '/reset-password', { body: { newPassword: NEW_PASSWORD, token }, userAgent: IPHONE });

      expect(writes.confirmAddressByReset).toHaveBeenCalledTimes(1);
      expect(addressesConfirmed).toEqual([]);
    });

    it('still resets when the address cannot be confirmed, with one line that names the account only', async () => {
      const auth = build();
      await signUp(auth);
      writes.confirmAddressByReset.mockRejectedValue(new Error('database down'));
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      await auth.api.requestPasswordReset({ body: { email: ACCOUNT.email } });
      await drain();
      const token = new URL(resetUrls.at(-1) ?? '').pathname.split('/').at(-1) ?? '';

      expect((await call(auth, '/reset-password', { body: { newPassword: NEW_PASSWORD, token }, userAgent: IPHONE })).status).toBe(200);
      expect(error).toHaveBeenCalledWith(`address_not_confirmed_on_reset ${JSON.stringify({ userId: store.user[0]?.id })}`);
      expect(writes.passwordChanged).toHaveBeenCalledWith(store.user[0]?.id as string, 'reset');
    });

    it('tells the mail how many passkeys the reset removed (PLAN 011 phase 5)', async () => {
      const auth = build();
      await signUp(auth);
      writes.passwordChanged.mockResolvedValue(2);
      await auth.api.requestPasswordReset({ body: { email: ACCOUNT.email } });
      await drain();
      const token = new URL(resetUrls.at(-1) ?? '').pathname.split('/').at(-1) ?? '';

      await call(auth, '/reset-password', { body: { newPassword: NEW_PASSWORD, token }, userAgent: IPHONE });
      await drain();

      expect(mails).toEqual([{ passkeysRemoved: 2, to: ACCOUNT.email, userAgent: IPHONE, userId: store.user[0]?.id as string }]);
    });

    it('removes the passkeys on their own when the reset’s transaction fails, and the mail says how many went', async () => {
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      writes.passwordChanged.mockRejectedValue(new Error('database unavailable'));
      writes.forgetPasskeys.mockResolvedValue(2);
      const auth = build();
      await signUp(auth);
      await auth.api.requestPasswordReset({ body: { email: ACCOUNT.email } });
      await drain();
      const token = new URL(resetUrls.at(-1) ?? '').pathname.split('/').at(-1) ?? '';
      const userId = store.user[0]?.id as string;

      const reset = await call(auth, '/reset-password', { body: { newPassword: NEW_PASSWORD, token }, userAgent: IPHONE });
      await drain();

      expect(reset.status).toBe(200);
      expect(writes.forgetPasskeys).toHaveBeenCalledWith(userId);
      expect(errors).toHaveBeenCalledWith(`password_change_unrecorded {"userId":"${userId}","via":"reset"}`);
      expect(errors).not.toHaveBeenCalledWith(expect.stringContaining('passkeys_not_removed'));
      expect(mails).toEqual([{ passkeysRemoved: 2, to: ACCOUNT.email, userAgent: IPHONE, userId }]);
    });

    it('says passkeys_not_removed, at error level, when the passkeys cannot be removed either — and still mails', async () => {
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      writes.passwordChanged.mockRejectedValue(new Error('database unavailable'));
      writes.forgetPasskeys.mockRejectedValue(new Error('database unavailable'));
      const auth = build();
      await signUp(auth);
      await auth.api.requestPasswordReset({ body: { email: ACCOUNT.email } });
      await drain();
      const token = new URL(resetUrls.at(-1) ?? '').pathname.split('/').at(-1) ?? '';
      const userId = store.user[0]?.id as string;

      const reset = await call(auth, '/reset-password', { body: { newPassword: NEW_PASSWORD, token }, userAgent: IPHONE });
      await drain();

      expect(reset.status).toBe(200);
      expect(errors).toHaveBeenCalledWith(`passkeys_not_removed {"userId":"${userId}"}`);
      expect(mails).toEqual([{ to: ACCOUNT.email, userAgent: IPHONE, userId }]);
    });

    it('records nothing for a dead token', async () => {
      const auth = build();
      await signUp(auth);

      await call(auth, '/reset-password', { body: { newPassword: NEW_PASSWORD, token: 'not-a-token' } });
      await drain();

      expect(writes.passwordChanged).not.toHaveBeenCalled();
      expect(mails).toEqual([]);
    });
  });

  describe('closing sessions', () => {
    it('records one, others and all, for the session’s own user, with the scope and nothing else', async () => {
      const auth = build();
      await signUp(auth);
      const phone = (await signIn(auth, IPHONE)).cookie ?? '';
      const laptop = (await signIn(auth, LAPTOP)).cookie ?? '';
      const userId = store.user[0]?.id as string;
      const phoneToken = store.session.find(row => row.userAgent === IPHONE)?.token;

      expect((await call(auth, '/revoke-session', { body: { token: phoneToken }, cookie: laptop })).status).toBe(200);
      await expect(sessionOf(auth, phone)).resolves.toBeNull();
      expect((await call(auth, '/revoke-other-sessions', { body: {}, cookie: laptop })).status).toBe(200);
      expect((await call(auth, '/revoke-sessions', { body: {}, cookie: laptop })).status).toBe(200);

      expect(writes.sessionsRevoked.mock.calls).toEqual([
        [userId, 'one'],
        [userId, 'others'],
        [userId, 'all']
      ]);
    });

    it('answers 200 for another person’s token, closes nothing and records nothing', async () => {
      const auth = build();
      const ana = await signUp(auth);
      await call(auth, '/sign-up/email', { body: { email: 'bea@example.invalid', name: 'Bea', password: PASSWORD } });
      confirm('bea@example.invalid');
      const bea = (await call(auth, '/sign-in/email', { body: { email: 'bea@example.invalid', password: PASSWORD } })).cookie ?? '';
      const beaToken = store.session.find(row => row.userId === store.user.find(user => user.email === 'bea@example.invalid')?.id)?.token;

      const answered = await call(auth, '/revoke-session', { body: { token: beaToken }, cookie: ana });

      expect(answered).toMatchObject({ body: { status: true }, status: 200 });
      await expect(sessionOf(auth, bea)).resolves.not.toBeNull();
      expect(writes.sessionsRevoked).not.toHaveBeenCalled();
    });

    it('answers a made-up token the same way, and records nothing', async () => {
      const auth = build();
      const ana = await signUp(auth);

      await expect(call(auth, '/revoke-session', { body: { token: 'not-a-token' }, cookie: ana })).resolves.toMatchObject({
        body: { status: true },
        status: 200
      });
      expect(writes.sessionsRevoked).not.toHaveBeenCalled();
    });

    it('records nothing for a request with no session', async () => {
      const auth = build();
      await signUp(auth);

      const refused = await call(auth, '/revoke-sessions', { body: {} });

      expect(refused.status).toBe(401);
      expect(writes.sessionsRevoked).not.toHaveBeenCalled();
    });

    it('lists only the caller’s own sessions — Better Auth scopes them, and nothing here widens it', async () => {
      const auth = build();
      const ana = await signUp(auth);
      await call(auth, '/sign-up/email', { body: { email: 'bea@example.invalid', name: 'Bea', password: PASSWORD } });

      const listed = await auth.api.listSessions({ headers: new Headers({ cookie: ana }) });

      expect(listed).toHaveLength(1);
      expect(listed[0]?.userId).toBe(store.user.find(row => row.email === ACCOUNT.email)?.id);
    });
  });

  describe('a marked account may not keep its breached password while HIBP is down', () => {
    const at = new Date('2026-10-01T08:00:00.000Z');

    async function resetToken(auth: Auth): Promise<string> {
      await auth.api.requestPasswordReset({ body: { email: ACCOUNT.email } });
      await drain();

      return new URL(resetUrls.at(-1) ?? '').pathname.split('/').at(-1) ?? '';
    }

    it('refuses a change to the same password with PASSWORD_COMPROMISED, and keeps the mark', async () => {
      const auth = build('development');
      const cookie = await signUp(auth);
      (store.user[0] as Row).passwordCompromisedAt = at;
      isPasswordCompromised.mockRejectedValue(new Error('HIBP unavailable'));

      const refused = await call(auth, '/change-password', { body: { currentPassword: PASSWORD, newPassword: PASSWORD }, cookie });
      await drain();

      expect(refused).toMatchObject({ body: { code: 'PASSWORD_COMPROMISED' }, status: 400 });
      expect(writes.passwordChanged).not.toHaveBeenCalled();
      expect(mails).toEqual([]);
      expect((store.user[0] as Row).passwordCompromisedAt).toEqual(at);
    });

    it('refuses a reset to the same password with PASSWORD_COMPROMISED, the token unspent and the mark kept', async () => {
      const auth = build('development');
      await signUp(auth);
      (store.user[0] as Row).passwordCompromisedAt = at;
      isPasswordCompromised.mockRejectedValue(new Error('HIBP unavailable'));
      const token = await resetToken(auth);

      const refused = await call(auth, '/reset-password', { body: { newPassword: PASSWORD, token } });
      await drain();

      expect(refused).toMatchObject({ body: { code: 'PASSWORD_COMPROMISED' }, status: 400 });
      expect(writes.passwordChanged).not.toHaveBeenCalled();
      expect((store.user[0] as Row).passwordCompromisedAt).toEqual(at);
      await expect(call(auth, '/reset-password', { body: { newPassword: NEW_PASSWORD, token } })).resolves.toMatchObject({ status: 200 });
    });

    it('still lets it change to a new password, and the change clears the mark', async () => {
      const auth = build('development');
      const cookie = await signUp(auth);
      (store.user[0] as Row).passwordCompromisedAt = at;
      isPasswordCompromised.mockRejectedValue(new Error('HIBP unavailable'));

      const changed = await call(auth, '/change-password', { body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, cookie });

      expect(changed.status).toBe(200);
      expect(writes.passwordChanged).toHaveBeenCalledWith(store.user[0]?.id as string, 'change');
    });

    it('leaves an account that is not marked as it was: its same password goes through', async () => {
      const auth = build('test');
      const cookie = await signUp(auth);

      const changed = await call(auth, '/change-password', { body: { currentPassword: PASSWORD, newPassword: PASSWORD }, cookie });

      expect(changed.status).toBe(200);
    });
  });

  describe('a sign-in checks the password it proved against HIBP, after answering', () => {
    it('answers before HIBP does, then marks the account on a hit', async () => {
      const auth = build('development');
      await signUp(auth);
      isPasswordCompromised.mockClear();
      let answer: (breached: boolean) => void = () => undefined;
      isPasswordCompromised.mockReturnValue(
        new Promise<boolean>(resolve => {
          answer = resolve;
        })
      );

      const signedIn = await signIn(auth);

      expect(signedIn.status).toBe(200);
      expect(writes.markPasswordCompromised).not.toHaveBeenCalled();
      answer(true);
      await drain();
      expect(isPasswordCompromised).toHaveBeenCalledWith(PASSWORD);
      expect(writes.markPasswordCompromised).toHaveBeenCalledWith(store.user[0]?.id as string);
    });

    it('marks nothing when HIBP does not know the password', async () => {
      const auth = build('development');
      await signUp(auth);

      await signIn(auth);
      await drain();

      expect(writes.markPasswordCompromised).not.toHaveBeenCalled();
    });

    it('marks nothing and still signs in when HIBP is down', async () => {
      const auth = build('development');
      await signUp(auth);
      isPasswordCompromised.mockRejectedValue(new Error('HIBP unavailable'));

      const signedIn = await signIn(auth);
      await drain();

      expect(signedIn.status).toBe(200);
      expect(writes.markPasswordCompromised).not.toHaveBeenCalled();
    });

    it('asks HIBP nothing for a refused sign-in, nor for an account already marked', async () => {
      const auth = build('development');
      await signUp(auth);
      // The sign-in after sign-up checks its own password in the background: done before the count starts.
      await drain();
      isPasswordCompromised.mockClear();

      await signIn(auth, LAPTOP, 'not-the-password-at-all');
      (store.user[0] as Row).passwordCompromisedAt = new Date();
      await signIn(auth);
      await drain();

      expect(isPasswordCompromised).not.toHaveBeenCalled();
      expect(writes.markPasswordCompromised).not.toHaveBeenCalled();
    });

    it('never calls HIBP under NODE_ENV=test', async () => {
      const auth = build('test');
      await signUp(auth);

      await signIn(auth);
      await drain();

      expect(isPasswordCompromised).not.toHaveBeenCalled();
    });
  });

  describe('the mark rides the session and no body can write it', () => {
    it('is on the session user, so the guard reads it on every request', async () => {
      const auth = build();
      const cookie = await signUp(auth);
      (store.user[0] as Row).passwordCompromisedAt = new Date('2026-10-01T08:00:00.000Z');

      const session = await sessionOf(auth, cookie);

      expect(new Date(session?.user.passwordCompromisedAt as string).toISOString()).toBe('2026-10-01T08:00:00.000Z');
    });

    it('cannot be cleared through /update-user', async () => {
      const auth = build();
      const cookie = await signUp(auth);
      const at = new Date('2026-10-01T08:00:00.000Z');
      (store.user[0] as Row).passwordCompromisedAt = at;

      const refused = await call(auth, '/update-user', { body: { passwordCompromisedAt: null }, cookie });

      expect(refused.status).toBe(400);
      expect((store.user[0] as Row).passwordCompromisedAt).toEqual(at);
    });
  });
});
