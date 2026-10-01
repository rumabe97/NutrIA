import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';
import { CareController } from 'core/controllers/Care';
import { ReauthenticationRequiredError } from 'core/entities/Error';

import { validateEnv } from '../../../config/Env.validation.js';
import { BackgroundTaskService } from '../../../shared/services/index.js';

/**
 * The real Better Auth, built by the real `createAuth`, deleting through the
 * real `UsersService.remove`. Only the storage is swapped for Better Auth's
 * in-memory adapter, as in `SessionRenewal.spec.ts`, so no database is needed.
 *
 * What it proves (production, 2026-09-30): a session older than `freshAge`
 * (one day) cannot delete the account. It is refused as
 * `ReauthenticationRequiredError` **before `beforeDelete`**, so Stripe is not
 * called, the invitations are not forgotten and no row goes. A fresh session
 * deletes as before, `beforeDelete` included.
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
jest.unstable_mockModule('../../auth/services/SelfService.js', () => ({
  onAccountCreated: async () => Promise.resolve(),
  onAddressConfirmed: async () => Promise.resolve()
}));
jest.unstable_mockModule('../../auth/services/VerificationMail.js', () => ({ sendVerificationMail: async () => Promise.resolve() }));

const { createAuth } = await import('../../auth/auth.config.js');
const { UsersService } = await import('./Users.service.js');

const DAY_MS = 24 * 60 * 60 * 1000;

const env = validateEnv({
  APP_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://user:pass@host/db',
  NODE_ENV: 'test'
});

describe('deleting an account through UsersService.remove, on the real Better Auth', () => {
  const cancelEverything = jest.fn(async (_userId: string) => Promise.resolve());
  let forgetAddress: jest.SpiedFunction<typeof CareController.forgetAddress>;

  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    cancelEverything.mockClear();
    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(AnalyticsController, 'recordUse').mockResolvedValue(undefined);
    forgetAddress = jest.spyOn(CareController, 'forgetAddress').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function signedIn() {
    const auth = createAuth(env, { configured: false, send: async () => Promise.resolve(false) }, { cancelEverything }, new BackgroundTaskService());
    const { headers } = await auth.api.signUpEmail({
      body: { email: 'ana@example.invalid', name: 'Ana', password: 'una-contraseña-larga' },
      returnHeaders: true
    });
    const cookie = (headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    return { cookie, service: new UsersService(auth) };
  }

  it('refuses a session older than a day before beforeDelete runs, touching nothing', async () => {
    const { cookie, service } = await signedIn();

    for (const session of store.session) {
      session.createdAt = new Date(Date.now() - 2 * DAY_MS);
    }

    await expect(service.remove({ cookie })).rejects.toBeInstanceOf(ReauthenticationRequiredError);

    expect(cancelEverything).not.toHaveBeenCalled();
    expect(forgetAddress).not.toHaveBeenCalled();
    expect(store.user).toHaveLength(1);
    expect(store.session).toHaveLength(1);
    expect(store.account).toHaveLength(1);
  });

  it('deletes from a fresh session, Stripe first, then the invitations, then the rows', async () => {
    const { cookie, service } = await signedIn();

    await expect(service.remove({ cookie })).resolves.toBeUndefined();

    expect(cancelEverything).toHaveBeenCalledTimes(1);
    expect(forgetAddress).toHaveBeenCalledWith('ana@example.invalid');
    expect(cancelEverything.mock.invocationCallOrder[0]).toBeLessThan(forgetAddress.mock.invocationCallOrder[0] ?? 0);
    expect(store.user).toHaveLength(0);
    expect(store.session).toHaveLength(0);
  });
});
