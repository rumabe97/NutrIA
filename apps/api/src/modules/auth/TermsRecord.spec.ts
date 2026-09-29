import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { TERMS_VERSION } from 'core/entities/User';

import { validateEnv } from '../../config/Env.validation.js';

/**
 * The real Better Auth, built by the real `createAuth`, over Better Auth's own
 * in-memory adapter: which `/condiciones` an account was created under is
 * written by `databaseHooks.user.create.before` (`0071`, PLAN 008 phase 7), for
 * every way to an account, and no client can send it.
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

const { AnalyticsController } = await import('core/controllers/Analytics');
const { createAuth } = await import('./auth.config.js');

const env = validateEnv({
  APP_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://user:pass@host/db',
  NODE_ENV: 'test'
});

function build(): ReturnType<typeof createAuth> {
  return createAuth(env, { configured: false, send: async () => Promise.resolve(false) }, { cancelEverything: async () => Promise.resolve() });
}

describe('the terms an account was created under', () => {
  let started: number;

  beforeEach(() => {
    started = Date.now();

    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is recorded for an account created by email, in the row that creates it', async () => {
    await build().api.signUpEmail({ body: { email: 'ana@example.invalid', name: 'Ana', password: 'una-contraseña-larga' } });

    expect(store.user).toHaveLength(1);
    expect(store.user[0]?.termsVersion).toBe(TERMS_VERSION);
    expect((store.user[0]?.termsAcceptedAt as Date).getTime()).toBeGreaterThanOrEqual(started);
  });

  it('is recorded for an account created through a provider, which takes the same hook', async () => {
    const context = await build().$context;

    const created = await context.internalAdapter.createOAuthUser(
      { email: 'social@example.invalid', emailVerified: true, name: 'Social' },
      { accountId: 'google-1', providerId: 'google' }
    );

    expect(created.user.id).toBeTruthy();
    expect(store.user).toHaveLength(1);
    expect(store.user[0]?.termsVersion).toBe(TERMS_VERSION);
    expect((store.user[0]?.termsAcceptedAt as Date).getTime()).toBeGreaterThanOrEqual(started);
  });

  it('cannot be written by the browser: a sign-up body carrying it is refused and no account is created', async () => {
    const attempt = build().api.signUpEmail({
      body: {
        email: 'mallory@example.invalid',
        name: 'Mallory',
        password: 'una-contraseña-larga',
        termsAcceptedAt: '2001-01-01T00:00:00.000Z',
        termsVersion: '9.9.9'
      } as never
    });

    await expect(attempt).rejects.toMatchObject({ statusCode: 400 });
    expect(store.user).toHaveLength(0);
  });

  it('declares both fields as input: false, like activatedAt', () => {
    const fields = build().options.user?.additionalFields as Record<string, { input?: boolean }>;

    expect(fields.termsVersion?.input).toBe(false);
    expect(fields.termsAcceptedAt?.input).toBe(false);
    expect(fields.activatedAt?.input).toBe(false);
  });
});
