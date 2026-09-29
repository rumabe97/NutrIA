import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';

import { validateEnv } from '../../config/Env.validation.js';

import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

/**
 * The real Better Auth, built by the real `createAuth`, read through the real
 * `SessionGuard` — only the storage is swapped for Better Auth's own in-memory
 * adapter, so no database is needed (`0071`, PLAN 008 phase 1, step 2).
 *
 * What it proves: a request that finds its session due for renewal — a day
 * after it was last renewed, `updateAge` — renews it inside the guard's
 * `getSession`, and that renewal runs `databaseHooks.session.update.after`,
 * which records the use. A request on a fresh session does not.
 *
 * Also swapped, because they write to the database or send mail and are not
 * what is under test: the account-opening hook and the verification mail.
 */
type Row = Record<string, unknown>;

const store: { account: Row[]; rateLimit: Row[]; session: Row[]; user: Row[]; verification: Row[] } = {
  account: [],
  rateLimit: [],
  session: [],
  user: [],
  verification: []
};

jest.unstable_mockModule('better-auth/adapters/drizzle', () => ({ drizzleAdapter: () => memoryAdapter(store) }));
jest.unstable_mockModule('database', () => ({ database: () => ({}) }));
jest.unstable_mockModule('./services/SelfService.js', () => ({
  onAccountCreated: async () => Promise.resolve(),
  onAddressConfirmed: async () => Promise.resolve()
}));
jest.unstable_mockModule('./services/VerificationMail.js', () => ({ sendVerificationMail: async () => Promise.resolve() }));

const { createAuth } = await import('./auth.config.js');
const { SessionGuard } = await import('../../shared/guards/Session.guard.js');

const DAY_MS = 24 * 60 * 60 * 1000;

const env = validateEnv({
  APP_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://user:pass@host/db',
  NODE_ENV: 'test'
});

function requestWith(cookie: string): ExecutionContext {
  const request = { headers: { cookie } };

  return {
    getClass: () => class {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
}

/** Signs somebody up — which signs them in — and hands back their cookie and their id. */
async function signedIn(auth: ReturnType<typeof createAuth>): Promise<{ cookie: string; userId: string }> {
  const { headers, response } = await auth.api.signUpEmail({
    body: { email: 'ana@example.invalid', name: 'Ana', password: 'una-contraseña-larga' },
    returnHeaders: true
  });
  const cookie = (headers.get('set-cookie') ?? '').split(';')[0] ?? '';

  return { cookie, userId: response.user.id };
}

/** Moves a session's last renewal `days` back, as the passing of time would. */
function age(days: number): void {
  for (const session of store.session) {
    session.expiresAt = new Date((session.expiresAt as Date).getTime() - days * DAY_MS);
  }
}

describe('a session renewed through SessionGuard', () => {
  const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
  let recordUse: jest.SpiedFunction<typeof AnalyticsController.recordUse>;

  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    recordUse = jest.spyOn(AnalyticsController, 'recordUse').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records a use when the guard renews it, and only then', async () => {
    const auth = createAuth(
      env,
      { configured: false, send: async () => Promise.resolve(false) },
      { cancelEverything: async () => Promise.resolve() }
    );
    const guard = new SessionGuard(auth, reflector);
    const { cookie, userId } = await signedIn(auth);

    // Signing in is `session_started`, never a use.
    expect(AnalyticsController.record).toHaveBeenCalledWith('session_started', userId);

    // A fresh session: read, not renewed.
    await expect(guard.canActivate(requestWith(cookie))).resolves.toBe(true);
    expect(recordUse).not.toHaveBeenCalled();

    // Two days on: the next request renews it, and the renewal is the use.
    age(2);
    const before = store.session[0]?.expiresAt as Date;

    await expect(guard.canActivate(requestWith(cookie))).resolves.toBe(true);

    expect((store.session[0]?.expiresAt as Date).getTime()).toBeGreaterThan(before.getTime());
    expect(recordUse).toHaveBeenCalledTimes(1);
    expect(recordUse).toHaveBeenCalledWith(userId);

    // Renewed now, so the next request only reads it again.
    await guard.canActivate(requestWith(cookie));
    expect(recordUse).toHaveBeenCalledTimes(1);
  });

  it('still lets the request through when recording the use fails', async () => {
    recordUse.mockRejectedValue(new Error('counter down'));
    const auth = createAuth(
      env,
      { configured: false, send: async () => Promise.resolve(false) },
      { cancelEverything: async () => Promise.resolve() }
    );
    const guard = new SessionGuard(auth, reflector);
    const { cookie } = await signedIn(auth);

    age(2);

    await expect(guard.canActivate(requestWith(cookie))).resolves.toBe(true);
    expect(recordUse).toHaveBeenCalledTimes(1);
  });

  it('does not renew — nor record a use — within a day of the last renewal', async () => {
    const auth = createAuth(
      env,
      { configured: false, send: async () => Promise.resolve(false) },
      { cancelEverything: async () => Promise.resolve() }
    );
    const guard = new SessionGuard(auth, reflector);
    const { cookie } = await signedIn(auth);

    age(0.5);
    await guard.canActivate(requestWith(cookie));

    expect(recordUse).not.toHaveBeenCalled();
  });

  /*
   * A page's server render sends several requests with one cookie at once.
   * Against a real database each can read the session before any has renewed
   * it, renew it, and run the hook — which is why the write behind `recordUse`
   * takes a lock (`AnalyticsRepository.recordOnceSince`): only the repository
   * can make that one row. The in-memory store here happens to serialize them;
   * what holds either way is that every use recorded is the session's owner's.
   */
  it('records the use of parallel requests against the session’s owner only', async () => {
    const auth = createAuth(
      env,
      { configured: false, send: async () => Promise.resolve(false) },
      { cancelEverything: async () => Promise.resolve() }
    );
    const guard = new SessionGuard(auth, reflector);
    const { cookie, userId } = await signedIn(auth);

    age(2);
    await Promise.all([guard.canActivate(requestWith(cookie)), guard.canActivate(requestWith(cookie)), guard.canActivate(requestWith(cookie))]);

    expect(recordUse.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(recordUse.mock.calls.every(call => call[0] === userId)).toBe(true);
  });
});
