import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';
import { UserController } from 'core/controllers/User';

import { validateEnv } from '../../config/Env.validation.js';
import { BackgroundTaskService } from '../../shared/services/index.js';

/**
 * Opening the confirmation link signs nobody in (hotfix, PLAN 011 phase 8
 * invariant review).
 *
 * The attack it shuts: a stranger signs the victim's address up with a
 * password of their own; the victim opens the mailed link, is signed into the
 * stranger's account and fills it with health data; the stranger, holding the
 * password, reads it. Now the link only confirms the address and lands on the
 * web's "confirmed, now sign in" page. The victim, not knowing the password,
 * resets it, and the reset ends every session the stranger had.
 *
 * The real `createAuth` over Better Auth's in-memory adapter, driven over HTTP
 * with real cookies. Swapped: the storage, the mails (their links captured,
 * never sent) and the hooks that write or mail on sign-up and confirmation.
 */
type Row = Record<string, unknown>;

const store: { account: Row[]; rateLimit: Row[]; session: Row[]; user: Row[]; verification: Row[] } = {
  account: [],
  rateLimit: [],
  session: [],
  user: [],
  verification: []
};
const links: { reset: string[]; verification: string[] } = { reset: [], verification: [] };

jest.unstable_mockModule('better-auth/adapters/drizzle', () => ({ drizzleAdapter: () => memoryAdapter(store) }));
jest.unstable_mockModule('database', () => ({ database: () => ({}) }));
jest.unstable_mockModule('./services/SelfService.js', () => ({
  onAccountCreated: async () => Promise.resolve(),
  onAddressConfirmed: async () => Promise.resolve()
}));
jest.unstable_mockModule('./services/VerificationMail.js', () => ({
  sendVerificationMail: async (_mailer: unknown, { url }: { url: string }) => {
    links.verification.push(url);

    return Promise.resolve();
  }
}));
jest.unstable_mockModule('./services/PasswordResetMail.js', () => ({
  sendPasswordResetMail: async (_mailer: unknown, { url }: { url: string }) => {
    links.reset.push(url);

    return Promise.resolve();
  }
}));
jest.unstable_mockModule('./services/PasswordChangedMail.js', () => ({ sendPasswordChangedMail: async () => Promise.resolve() }));

const { createAuth } = await import('./auth.config.js');

const ORIGIN = 'http://localhost:3000';
const EMAIL = 'victima@example.invalid';
const STRANGERS_PASSWORD = 'correct-horse-battery-staple-9';
const VICTIMS_PASSWORD = 'otra-frase-de-caballos-azules';

type Auth = ReturnType<typeof createAuth>;

function build(extra: Record<string, string> = {}): Auth {
  const env = validateEnv({
    APP_URL: ORIGIN,
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    NODE_ENV: 'test',
    ...extra
  });

  return createAuth(
    env,
    { configured: true, send: async () => Promise.resolve(true) },
    { cancelEverything: async () => Promise.resolve() },
    new BackgroundTaskService()
  );
}

/** One browser: the cookies Better Auth set on it, sent back on every call. */
class Browser {
  private readonly cookies = new Map<string, string>();

  hasSession(): boolean {
    return [...this.cookies.keys()].some(name => name.includes('session_token'));
  }

  header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  keep(response: Response): void {
    for (const line of response.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const at = pair.indexOf('=');
      const value = pair.slice(at + 1);

      if (value === '' || /max-age=0\b/i.test(line)) {
        this.cookies.delete(pair.slice(0, at));
      } else {
        this.cookies.set(pair.slice(0, at), value);
      }
    }
  }
}

async function call(auth: Auth, browser: Browser, path: string, body?: unknown): Promise<Response> {
  const url = path.startsWith('http') ? path : `http://localhost:3001${auth.options.basePath}${path}`;
  const response = await auth.handler(
    new Request(url, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...(browser.header() ? { cookie: browser.header() } : {}) },
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'manual'
    })
  );

  browser.keep(response);

  return response;
}

async function signedIn(auth: Auth, browser: Browser): Promise<boolean> {
  return (await auth.api.getSession({ headers: new Headers({ cookie: browser.header() }) })) !== null;
}

/** Waits for the background task that hands Better Auth's link to the mail hook. */
async function linkIn(list: string[]): Promise<string> {
  for (let tries = 0; tries < 50 && list.length === 0; tries += 1) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  const link = list.at(-1);

  if (!link) {
    throw new Error('No link reached the mail hook');
  }

  return link;
}

describe('confirming an address', () => {
  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    links.reset.length = 0;
    links.verification.length = 0;
    jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(AnalyticsController, 'recordUse').mockResolvedValue(undefined);
    jest.spyOn(UserController, 'passwordChanged').mockResolvedValue(0);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);

    // The per-address brake has no database here and says so; it fails open, which is all this needs.
    for (const level of ['error', 'warn'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('never signs anybody in, whatever a later change to the options tries', () => {
    const { options } = build();

    expect(options.emailVerification?.autoSignInAfterVerification).toBe(false);
    expect(options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
  });

  it('never joins a provider to an account it was not linked to, even one whose address the link confirmed', () => {
    // With a provider configured, which is when linking is on at all (`0058`, amended).
    const { options } = build({ GOOGLE_OAUTH_CLIENT_ID: 'nutria.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'not-a-secret' });

    expect(options.account?.accountLinking?.disableImplicitLinking).toBe(true);
    expect(options.account?.accountLinking?.trustedProviders ?? []).toEqual([]);
  });

  it('has no change of address, whose confirmation opens a session whatever `autoSignInAfterVerification` says', () => {
    expect(build().options.user?.changeEmail?.enabled).toBeFalsy();
  });

  it('confirms the address for whoever opens the link, gives them no session, and a reset ends the stranger’s', async () => {
    const auth = build();
    const stranger = new Browser();

    expect((await call(auth, stranger, '/sign-up/email', { email: EMAIL, name: 'Nadie', password: STRANGERS_PASSWORD })).status).toBe(200);
    expect(await signedIn(auth, stranger)).toBe(true);

    // The owner of the mailbox opens the link, from another device.
    const victim = new Browser();
    const opened = await call(auth, victim, await linkIn(links.verification));

    expect(opened.status).toBe(302);
    expect(victim.hasSession()).toBe(false);
    expect(await signedIn(auth, victim)).toBe(false);
    expect(store.user[0]?.emailVerified).toBe(true);
    // Confirming ends nothing: the reset does.
    expect(await signedIn(auth, stranger)).toBe(true);

    // The password is not theirs, so the owner resets it.
    expect((await call(auth, victim, '/request-password-reset', { email: EMAIL, redirectTo: '/restablecer' })).status).toBe(200);

    const token = new URL(await linkIn(links.reset)).pathname.split('/').at(-1) ?? '';

    expect((await call(auth, victim, '/reset-password', { newPassword: VICTIMS_PASSWORD, token })).status).toBe(200);

    expect(await signedIn(auth, stranger)).toBe(false);
    expect(store.session).toHaveLength(0);
    expect((await call(auth, new Browser(), '/sign-in/email', { email: EMAIL, password: STRANGERS_PASSWORD })).status).toBe(401);

    const back = new Browser();

    expect((await call(auth, back, '/sign-in/email', { email: EMAIL, password: VICTIMS_PASSWORD })).status).toBe(200);
    expect(await signedIn(auth, back)).toBe(true);
  });
});
