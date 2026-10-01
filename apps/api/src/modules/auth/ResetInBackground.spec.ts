import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';

import { validateEnv } from '../../config/Env.validation.js';
import { BackgroundTaskService } from '../../shared/services/index.js';

/**
 * The reset no longer tells by its timing that an address has an account
 * (PLAN 011 phase 1, step 3; PRD 011, criterion 5).
 *
 * Better Auth only sends the reset mail when the account exists, and it used to
 * wait for the send: with SMTP configured, a registered address answered a
 * round trip to the mail server later than an unregistered one. Now the send
 * goes to `advanced.backgroundTasks` — `BackgroundTaskService` — and the route
 * answers first.
 *
 * The real `createAuth`, the real `sendPasswordResetMail`, a mailer that says
 * it is configured and takes half a second to accept. Swapped: the storage
 * (Better Auth's in-memory adapter), the locale lookup (a database read), and
 * the hooks that write or mail on sign-up.
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
jest.unstable_mockModule('../email/services/RecipientLocale.js', () => ({ recipientLocale: async () => Promise.resolve('es-ES') }));
jest.unstable_mockModule('./services/SelfService.js', () => ({
  onAccountCreated: async () => Promise.resolve(),
  onAddressConfirmed: async () => Promise.resolve()
}));
jest.unstable_mockModule('./services/VerificationMail.js', () => ({ sendVerificationMail: async () => Promise.resolve() }));

const { createAuth } = await import('./auth.config.js');

const SMTP_MS = 500;
const EMAIL = 'ana@example.invalid';

const env = validateEnv({
  APP_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://user:pass@host/db',
  NODE_ENV: 'test'
});

describe('the password reset request', () => {
  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers before the mail server has accepted the reset mail', async () => {
    const events: string[] = [];
    let accepted: () => void = () => undefined;
    const delivered = new Promise<void>(resolve => {
      accepted = resolve;
    });
    const send = jest.fn(async (_mail: { to: string }) => {
      await new Promise(resolve => setTimeout(resolve, SMTP_MS));
      events.push('send resolved');
      accepted();

      return true;
    });
    const background = new BackgroundTaskService();
    const run = jest.spyOn(background, 'run');
    const auth = createAuth(env, { configured: true, send }, { cancelEverything: async () => Promise.resolve() }, background);

    await auth.api.signUpEmail({ body: { email: EMAIL, name: 'Ana', password: 'correct-horse-battery-staple-9' } });

    const started = Date.now();
    await auth.api.requestPasswordReset({ body: { email: EMAIL, redirectTo: '/restablecer' } });
    events.push('answered');

    expect(Date.now() - started).toBeLessThan(SMTP_MS);
    expect(run).toHaveBeenCalledWith('auth', expect.any(Promise));

    // The mail still goes — after the answer.
    await delivered;
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: EMAIL }));
    expect(events.indexOf('answered')).toBeLessThan(events.indexOf('send resolved'));
  });

  it('answers a missing address the same way, sending nothing', async () => {
    const send = jest.fn(async () => Promise.resolve(true));
    const auth = createAuth(env, { configured: true, send }, { cancelEverything: async () => Promise.resolve() }, new BackgroundTaskService());

    await expect(auth.api.requestPasswordReset({ body: { email: 'nobody@example.invalid', redirectTo: '/restablecer' } })).resolves.toMatchObject({
      status: true
    });
    expect(send).not.toHaveBeenCalled();
  });
});
