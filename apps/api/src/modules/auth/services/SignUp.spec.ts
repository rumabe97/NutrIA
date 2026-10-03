import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';
import { MailBudgetController } from 'core/controllers/MailBudget';
import { decideMail } from 'core/domain/MailBudget';

import type { MailsSent } from 'core/domain/MailBudget';

import { validateEnv } from '../../../config/Env.validation.js';

/**
 * Sign-up reveals nothing (PLAN 011 phase 8), on the real Better Auth built by
 * the real `createAuth` over its in-memory adapter, driven over HTTP: a new
 * address and one that already has an account get the same status, the same
 * headers and the same body but for the values that are new every time (the
 * id and the instants), no session for either, and one mail each — the
 * confirmation to the new address, "somebody tried" to the existing one.
 *
 * Swapped: the storage, the mails (captured, never sent), the analytics write,
 * the mail budget's rows (a map decided by the real `decideMail`) and the
 * background runner (collected; `drain()` is "after the response").
 */
type Row = Record<string, unknown>;

const store: { account: Row[]; rateLimit: Row[]; session: Row[]; user: Row[]; verification: Row[] } = {
  account: [],
  rateLimit: [],
  session: [],
  user: [],
  verification: []
};
const mails: { kind: 'existing' | 'verify'; to: string }[] = [];

jest.unstable_mockModule('better-auth/adapters/drizzle', () => ({ drizzleAdapter: () => memoryAdapter(store) }));
jest.unstable_mockModule('database', () => ({ database: () => ({}) }));
jest.unstable_mockModule('./SelfService.js', () => ({
  onAccountCreated: async () => Promise.resolve(),
  onAddressConfirmed: async () => Promise.resolve()
}));
jest.unstable_mockModule('./VerificationMail.js', () => ({
  sendVerificationMail: async (_mailer: unknown, { to }: { to: string }) => {
    mails.push({ kind: 'verify', to });

    return Promise.resolve();
  }
}));
jest.unstable_mockModule('./ExistingAccountMail.js', () => ({
  sendExistingAccountMail: async (_mailer: unknown, { to }: { to: string }) => {
    mails.push({ kind: 'existing', to });

    return Promise.resolve();
  }
}));

const { createAuth } = await import('../auth.config.js');

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery-staple-9';
const OTHER_PASSWORD = 'otra-frase-de-caballos-azules';
const EXISTING = 'ana@example.invalid';
const NEW = 'nuevo@example.invalid';

const tasks: ((() => Promise<unknown>) | Promise<unknown>)[] = [];
const budgetRows = new Map<string, MailsSent>();

async function drain(): Promise<void> {
  while (tasks.length > 0) {
    await Promise.all(tasks.splice(0).map(async work => (typeof work === 'function' ? work() : work)));
  }
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
    {
      run: (_label: string, work: (() => Promise<unknown>) | Promise<unknown>) => {
        tasks.push(work);
      }
    }
  );
}

type Auth = ReturnType<typeof createAuth>;
type Answer = { body: string; headers: [string, string][]; status: number };

async function signUp(auth: Auth, email: string, name: string, password = PASSWORD): Promise<Answer> {
  const response = await auth.handler(
    new Request(`http://localhost:3001${auth.options.basePath}/sign-up/email`, {
      body: JSON.stringify({ email, name, password }),
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      method: 'POST'
    })
  );

  return { body: await response.text(), headers: [...response.headers.entries()], status: response.status };
}

/**
 * The answer with the values new on every answer (the id, the instants) and
 * the address set aside. The in-memory adapter keeps only the fields Better
 * Auth wrote, so a null column is absent here where Postgres returns it null,
 * and its keys come in the order they were written: this compares the fields
 * and their values. The byte-for-byte answer, key order included, is
 * `access.e2e-spec.ts`'s, on Postgres.
 */
function shape(body: string): Record<string, unknown> {
  const { token, user } = JSON.parse(body) as { token: unknown; user: Record<string, unknown> };
  const fields = Object.entries(user)
    .filter(([key, value]) => value !== null && !['createdAt', 'email', 'id', 'termsAcceptedAt', 'updatedAt'].includes(key))
    .sort(([a], [b]) => a.localeCompare(b));

  return {
    keys: Object.keys(user)
      .filter(key => user[key] !== null)
      .sort(),
    token,
    user: Object.fromEntries(fields)
  };
}

describe('sign-up reveals nothing', () => {
  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    mails.length = 0;
    tasks.length = 0;
    budgetRows.clear();
    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(MailBudgetController, 'spend').mockImplementation(async key => {
      const decision = decideMail(budgetRows.get(key), new Date());

      if (decision.kind === 'send') {
        budgetRows.set(key, decision.next);
      }

      return Promise.resolve(decision.kind === 'send');
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers an existing address as a new one: status, headers, and every field but its id and instants', async () => {
    const auth = build();
    await signUp(auth, EXISTING, 'Ana');
    await drain();
    mails.length = 0;

    const existing = await signUp(auth, EXISTING, 'Bea', OTHER_PASSWORD);
    const fresh = await signUp(auth, NEW, 'Bea', OTHER_PASSWORD);

    expect(existing.status).toBe(200);
    expect(fresh.status).toBe(200);
    expect(existing.headers).toEqual(fresh.headers);
    expect(shape(existing.body)).toEqual(shape(fresh.body));
    expect(JSON.parse(existing.body)).toMatchObject({ token: null, user: { email: EXISTING, emailVerified: false, name: 'Bea' } });
  });

  it('opens no session for either: no cookie, no session row', async () => {
    const auth = build();
    await signUp(auth, EXISTING, 'Ana');

    const existing = await signUp(auth, EXISTING, 'Ana');
    const fresh = await signUp(auth, NEW, 'Nuevo');

    for (const answer of [existing, fresh]) {
      expect(answer.headers.some(([name]) => name === 'set-cookie')).toBe(false);
    }

    expect(store.session).toHaveLength(0);
  });

  it('mails each address once: the confirmation to the new one, "somebody tried" to the existing one', async () => {
    const auth = build();
    await signUp(auth, EXISTING, 'Ana');
    await drain();
    mails.length = 0;

    await signUp(auth, EXISTING, 'Bea');
    await signUp(auth, NEW, 'Nuevo');
    await drain();
    expect(mails).toEqual([
      { kind: 'existing', to: EXISTING },
      { kind: 'verify', to: NEW }
    ]);
  });

  it('changes nothing of the existing account: no second user, its password and name kept', async () => {
    const auth = build();
    await signUp(auth, EXISTING, 'Ana');
    const before = JSON.stringify({ account: store.account, user: store.user });

    await signUp(auth, EXISTING, 'Bea', OTHER_PASSWORD);

    expect(JSON.stringify({ account: store.account, user: store.user })).toBe(before);
  });
  it('mails an existing address three times an hour at most, however often it is signed up, and answers every time the same', async () => {
    const auth = build();
    await signUp(auth, EXISTING, 'Ana');
    await drain();
    mails.length = 0;

    const answers = [];

    for (let i = 0; i < 5; i += 1) {
      answers.push((await signUp(auth, EXISTING, 'Bea', OTHER_PASSWORD)).status);
    }

    await drain();
    expect(answers).toEqual([200, 200, 200, 200, 200]);
    expect(mails).toEqual([
      { kind: 'existing', to: EXISTING },
      { kind: 'existing', to: EXISTING },
      { kind: 'existing', to: EXISTING }
    ]);
  });
});
