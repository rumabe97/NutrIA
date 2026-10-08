import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';
import { MailBudgetController } from 'core/controllers/MailBudget';
import { ProfileController } from 'core/controllers/Profile';

import { validateEnv } from '../../../config/Env.validation.js';

/**
 * The anonymous `/send-verification-email` (PLAN 011 phase 8, invariant review
 * P1), on the real Better Auth built by the real `createAuth`, with the real
 * verification mail and a mailer whose `send` never answers. Better Auth awaits
 * the callback on that route and only pads it to 500 ms, so an unconfirmed
 * address — the one whose mail is sent — must not wait for the budget or for
 * SMTP: it answers at the floor, like an unknown address.
 *
 * Swapped: the storage, the analytics write, the profile's locale and the
 * budget (both answer at once); the background runner starts the work and
 * never awaits it.
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
jest.unstable_mockModule('./SelfService.js', () => ({
  onAccountCreated: async () => Promise.resolve(),
  onAddressConfirmed: async () => Promise.resolve()
}));

const { createAuth } = await import('../auth.config.js');

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery-staple-9';
const UNCONFIRMED = 'ana@example.invalid';
const UNKNOWN = 'nadie@example.invalid';
/** Better Auth's own floor on the anonymous route. */
const FLOOR_MS = 500;

const sends: string[] = [];

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
    {
      configured: true,
      // SMTP that never answers.
      send: async ({ to }: { to: string }) => {
        sends.push(to);

        return new Promise<boolean>(() => undefined);
      }
    },
    { cancelEverything: async () => Promise.resolve() },
    { run: (_label: string, work: (() => Promise<unknown>) | Promise<unknown>) => void (typeof work === 'function' ? work() : work) }
  );
}

async function post(auth: ReturnType<typeof createAuth>, path: string, body: unknown): Promise<{ ms: number; status: number }> {
  const start = performance.now();
  const response = await auth.handler(
    new Request(`http://localhost:3001${auth.options.basePath}${path}`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      method: 'POST'
    })
  );

  await response.text();

  return { ms: performance.now() - start, status: response.status };
}

describe('the anonymous resend of a confirmation link', () => {
  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    sends.length = 0;
    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(MailBudgetController, 'spend').mockResolvedValue(true);
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue(null);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers an unconfirmed address at the floor, as an unknown one, though its mail never leaves', async () => {
    const auth = build();
    await post(auth, '/sign-up/email', { email: UNCONFIRMED, name: 'Ana', password: PASSWORD });
    sends.length = 0;

    const unconfirmed = await post(auth, '/send-verification-email', { email: UNCONFIRMED });
    const unknown = await post(auth, '/send-verification-email', { email: UNKNOWN });

    expect(unconfirmed.status).toBe(200);
    expect(unknown.status).toBe(200);
    // At the floor, give or take a timer: never held by the SMTP that does not answer.
    expect(unconfirmed.ms).toBeGreaterThanOrEqual(FLOOR_MS - 2);
    expect(unconfirmed.ms).toBeLessThan(FLOOR_MS + 300);
    expect(unknown.ms).toBeGreaterThanOrEqual(FLOOR_MS - 2);

    // The mail was started, after the answer, to the unconfirmed address only.
    await new Promise(resolve => setImmediate(resolve));
    expect(sends).toEqual([UNCONFIRMED]);
  });
});
