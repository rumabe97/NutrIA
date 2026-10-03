import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { inspect } from 'node:util';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';
import { TwoFactorController } from 'core/controllers/TwoFactor';
import { UserController } from 'core/controllers/User';

import { validateEnv } from '../../../config/Env.validation.js';

/**
 * Passkeys (PLAN 011 phase 5), on the real Better Auth built by the real
 * `createAuth` — the real passkey plugin — over its in-memory adapter, driven
 * over HTTP with real cookies, the way `TwoFactor.spec.ts` drives phase 3.
 *
 * The device is `Authenticator` below: a P-256 key made in the test, packed
 * into the WebAuthn shapes a browser hands over (attestation `none`, as the
 * plugin asks), so registration and sign-in run through the plugin's real
 * verification.
 *
 * Swapped: the storage, the mails (captured, never sent), the
 * `UserController`, `TwoFactorController` and `AnalyticsController` writes
 * (spied — their SQL is `packages/core`'s to prove; `spendGrant` acts on the
 * in-memory rows as its `DELETE … RETURNING` does) and the background runner (collected;
 * `drain()` is "after the response").
 */
type Row = Record<string, unknown>;

const store: { account: Row[]; passkey: Row[]; rateLimit: Row[]; session: Row[]; twoFactor: Row[]; user: Row[]; verification: Row[] } = {
  account: [],
  passkey: [],
  rateLimit: [],
  session: [],
  twoFactor: [],
  user: [],
  verification: []
};
const mails: { to: string; userId: string }[] = [];
const removalMails: { event: unknown; to: string; userId: string }[] = [];

jest.unstable_mockModule('better-auth/adapters/drizzle', () => ({ drizzleAdapter: () => memoryAdapter(store) }));
jest.unstable_mockModule('database', () => ({ database: () => ({}) }));
jest.unstable_mockModule('./SelfService.js', () => ({
  onAccountCreated: async () => Promise.resolve(),
  onAddressConfirmed: async () => Promise.resolve()
}));
jest.unstable_mockModule('./VerificationMail.js', () => ({ sendVerificationMail: async () => Promise.resolve() }));
jest.unstable_mockModule('./TwoFactorRemovalMail.js', () => ({
  sendTwoFactorRemovalMail: async (_mailer: unknown, { event, to, userId }: { event: unknown; to: string; userId: string }) => {
    removalMails.push({ event, to, userId });

    return Promise.resolve();
  }
}));
jest.unstable_mockModule('./PasskeyMail.js', () => ({
  sendPasskeyAddedMail: async (_mailer: unknown, { to, userId }: { to: string; userId: string }) => {
    mails.push({ to, userId });

    return Promise.resolve();
  }
}));

const { createAuth } = await import('../auth.config.js');
const { passkeyOptions } = await import('./Passkey.js');

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-horse-battery-staple-9';
const ANA = { email: 'ana@example.invalid', name: 'Ana' };
const BEA = { email: 'bea@example.invalid', name: 'Bea' };
const NOT_FOUND = '{"code":"NOT_FOUND","message":"Not Found","statusCode":404}';

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

type Auth = ReturnType<typeof createAuth>;

function build(): Auth {
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
    background
  );
}

/** One browser: the cookies Better Auth set on it, sent back on every call. */
class Browser {
  private readonly cookies = new Map<string, string>();

  header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  has(fragment: string): boolean {
    return [...this.cookies.keys()].some(name => name.includes(fragment));
  }

  keep(response: Response): void {
    for (const line of response.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const at = pair.indexOf('=');
      const name = pair.slice(0, at);
      const value = pair.slice(at + 1);
      const expired = value === '' || /max-age=0\b/i.test(line);

      if (expired) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }
}

async function call(
  auth: Auth,
  browser: Browser,
  path: string,
  body?: unknown
): Promise<{ body: Record<string, unknown> | null; raw: string; status: number }> {
  const response = await auth.handler(
    new Request(`http://localhost:3001${auth.options.basePath}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...(browser.header() ? { cookie: browser.header() } : {}) },
      method: body === undefined ? 'GET' : 'POST'
    })
  );
  browser.keep(response);
  const raw = await response.text();

  return { body: raw ? (JSON.parse(raw) as Record<string, unknown>) : null, raw, status: response.status };
}

function sha256(data: string | Uint8Array): Buffer {
  return createHash('sha256').update(data).digest();
}

function uint32(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);

  return bytes;
}

/**
 * A device that keeps one passkey: what a browser's `navigator.credentials`
 * hands back, built by hand. Flags UP and UV (and AT when registering) — UV
 * left out once `verifies` is false, a key used on possession alone — a
 * zero AAGUID as an iPhone sends under attestation `none`, the signature an
 * ECDSA P-256 over the authenticator data and the client data's hash.
 */
class Authenticator {
  readonly credentialId = randomBytes(16);
  private readonly keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  private counter = 0;

  /** Whether the device verifies the person (Face ID, a fingerprint, its code): WebAuthn's UV flag. */
  verifies = true;

  get id(): string {
    return this.credentialId.toString('base64url');
  }

  create(challenge: string): Record<string, unknown> {
    const jwk = this.keys.publicKey.export({ format: 'jwk' });
    const cose = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, new Uint8Array(Buffer.from(jwk.x ?? '', 'base64url'))],
        [-3, new Uint8Array(Buffer.from(jwk.y ?? '', 'base64url'))]
      ])
    );
    const length = Buffer.alloc(2);
    length.writeUInt16BE(this.credentialId.length);
    const authData = Buffer.concat([
      sha256('localhost'),
      Buffer.from([this.verifies ? 0x45 : 0x41]),
      uint32(this.counter),
      Buffer.alloc(16),
      length,
      this.credentialId,
      cose
    ]);
    const attestation = isoCBOR.encode(
      new Map<string, Map<string, string> | string | Uint8Array>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', new Uint8Array(authData)]
      ])
    );

    return {
      id: this.id,
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      rawId: this.id,
      response: {
        attestationObject: Buffer.from(attestation).toString('base64url'),
        clientDataJSON: Buffer.from(JSON.stringify({ challenge, crossOrigin: false, origin: ORIGIN, type: 'webauthn.create' })).toString('base64url'),
        transports: ['internal', 'hybrid']
      },
      type: 'public-key'
    };
  }

  get(challenge: string): Record<string, unknown> {
    this.counter += 1;
    const clientData = Buffer.from(JSON.stringify({ challenge, crossOrigin: false, origin: ORIGIN, type: 'webauthn.get' }));
    const authData = Buffer.concat([sha256('localhost'), Buffer.from([this.verifies ? 0x05 : 0x01]), uint32(this.counter)]);

    return {
      id: this.id,
      clientExtensionResults: {},
      rawId: this.id,
      response: {
        authenticatorData: authData.toString('base64url'),
        clientDataJSON: clientData.toString('base64url'),
        signature: sign('sha256', Buffer.concat([authData, sha256(clientData)]), this.keys.privateKey).toString('base64url')
      },
      type: 'public-key'
    };
  }
}

/** Signed up, with the address confirmed — as every account that may add a passkey has — unless `confirmed` is false. */
async function signUp(auth: Auth, account: { email: string; name: string }, confirmed = true): Promise<Browser> {
  const browser = new Browser();
  await call(auth, browser, '/sign-up/email', { ...account, password: PASSWORD });

  const row = store.user.find(candidate => candidate.email === account.email);

  if (row) {
    row.emailVerified = confirmed;
  }

  return browser;
}

/** The password confirmed for this browser's session, as the web asks before adding a passkey. */
async function confirm(auth: Auth, browser: Browser, password = PASSWORD) {
  return call(auth, browser, '/passkey/confirm-password', { password });
}

/** The password confirmed, the browser asks for options, the device makes a key, the browser hands it back: the answer of the last step. */
async function addPasskey(auth: Auth, browser: Browser, device: Authenticator, extra: Record<string, unknown> = {}) {
  await confirm(auth, browser);

  const options = await call(auth, browser, '/passkey/generate-register-options');

  return call(auth, browser, '/passkey/verify-registration', {
    name: 'iPhone',
    response: device.create(options.body?.challenge as string),
    ...extra
  });
}

function userId(email: string): string {
  return store.user.find(row => row.email === email)?.id as string;
}

describe('passkeys', () => {
  let passkeyChanged: jest.SpiedFunction<typeof UserController.passkeyChanged>;
  let analytics: jest.SpiedFunction<typeof AnalyticsController.record>;
  let cancelRemoval: jest.SpiedFunction<typeof TwoFactorController.cancelRemovalByAccount>;
  const logged: string[] = [];

  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    mails.length = 0;
    removalMails.length = 0;
    tasks.length = 0;
    logged.length = 0;
    passkeyChanged = jest.spyOn(UserController, 'passkeyChanged').mockResolvedValue(undefined);
    analytics = jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(AnalyticsController, 'recordUse').mockResolvedValue(undefined);
    cancelRemoval = jest.spyOn(TwoFactorController, 'cancelRemovalByAccount').mockResolvedValue(null);
    jest.spyOn(UserController, 'spendGrant').mockImplementation(async (identifier, id) => {
      const at = store.verification.findIndex(
        row => row.identifier === identifier && row.value === id && new Date(row.expiresAt as Date).getTime() > Date.now()
      );

      if (at >= 0) {
        store.verification.splice(at, 1);
      }

      return Promise.resolve(at >= 0);
    });

    const keep = (...parts: unknown[]) => {
      // `inspect`, not `JSON.stringify`: an `Error` stringifies to `{}`, and its message is what must be looked at.
      logged.push(parts.map(part => (typeof part === 'string' ? part : inspect(part))).join(' '));
    };

    for (const level of ['debug', 'error', 'info', 'log', 'warn'] as const) {
      jest.spyOn(console, level).mockImplementation(keep);
    }

    for (const level of ['debug', 'error', 'log', 'verbose', 'warn'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(keep);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const sessionsStarted = () => analytics.mock.calls.filter(([name]) => name === 'session_started');

  describe('the relying party', () => {
    it('is the web’s own host and origin, named NutrIA, from APP_URL alone', () => {
      expect(passkeyOptions('https://nutr-ia-web-phi.vercel.app')).toEqual({
        origin: 'https://nutr-ia-web-phi.vercel.app',
        rpID: 'nutr-ia-web-phi.vercel.app',
        rpName: 'NutrIA'
      });
      expect(passkeyOptions('http://localhost:3000/')).toEqual({ origin: 'http://localhost:3000', rpID: 'localhost', rpName: 'NutrIA' });
    });

    it('is what the registration options carry', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      await confirm(auth, browser);

      const options = await call(auth, browser, '/passkey/generate-register-options');

      expect(options.status).toBe(200);
      expect(options.body?.rp).toEqual({ id: 'localhost', name: 'NutrIA' });
      expect(options.body?.attestation).toBe('none');
    });
  });

  describe('the person, not only the device', () => {
    it('asks for the person to be verified when adding one', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      await confirm(auth, browser);

      const options = await call(auth, browser, '/passkey/generate-register-options');

      expect(options.body?.authenticatorSelection).toMatchObject({ userVerification: 'required' });
    });

    it('asks for the person to be verified when signing in, and still hands out the challenge it keeps', async () => {
      const auth = build();
      const browser = new Browser();

      const options = await call(auth, browser, '/passkey/generate-authenticate-options');

      expect(options.status).toBe(200);
      expect(options.body?.userVerification).toBe('required');
      expect(typeof options.body?.challenge).toBe('string');
      expect(browser.has('passkey')).toBe(true);
    });

    it('refuses a key added without the person verified: nothing stored, the grant spent, nothing written or mailed', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      const device = new Authenticator();
      device.verifies = false;

      const refused = await addPasskey(auth, browser, device);
      await drain();

      expect(refused).toMatchObject({ body: { code: 'FAILED_TO_VERIFY_REGISTRATION' }, status: 400 });
      expect(store.passkey).toEqual([]);
      expect(passkeyChanged).not.toHaveBeenCalled();
      expect(mails).toEqual([]);

      await expect(call(auth, browser, '/passkey/generate-register-options')).resolves.toMatchObject({
        body: { code: 'PASSWORD_CONFIRMATION_REQUIRED' },
        status: 403
      });

      device.verifies = true;

      expect((await addPasskey(auth, browser, device)).status).toBe(200);
    });

    it('refuses a sign-in on possession alone: 401 AUTHENTICATION_FAILED, no session, no visit, the counter untouched', async () => {
      const auth = build();
      const device = new Authenticator();
      await addPasskey(auth, await signUp(auth, ANA), device);
      const sessions = store.session.length;
      const counted = sessionsStarted().length;
      const browser = new Browser();
      device.verifies = false;

      const options = await call(auth, browser, '/passkey/generate-authenticate-options');
      const refused = await call(auth, browser, '/passkey/verify-authentication', { response: device.get(options.body?.challenge as string) });

      expect(refused).toMatchObject({ body: { code: 'AUTHENTICATION_FAILED' }, status: 401 });
      expect(browser.has('session_token')).toBe(false);
      expect(store.session).toHaveLength(sessions);
      expect(sessionsStarted()).toHaveLength(counted);
      expect(store.passkey).toMatchObject([{ counter: 0 }]);
    });
  });

  describe('who may add one', () => {
    it('answers no session with the route’s own 401, and writes no challenge', async () => {
      const auth = build();

      await expect(call(auth, new Browser(), '/passkey/generate-register-options')).resolves.toMatchObject({ status: 401 });
      expect(store.verification).toEqual([]);
    });

    it('answers a session older than a day 403 SESSION_NOT_FRESH, even with the password confirmed: the web asks for a fresh sign-in', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      await confirm(auth, browser);

      for (const row of store.session) {
        row.createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      }

      await expect(call(auth, browser, '/passkey/generate-register-options')).resolves.toMatchObject({
        body: { code: 'SESSION_NOT_FRESH' },
        status: 403
      });
    });
  });

  describe('an address not yet confirmed', () => {
    it('refuses both steps 403 EMAIL_CONFIRMATION_REQUIRED, even with the password confirmed, and writes no challenge', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA, false);

      expect((await confirm(auth, browser)).status).toBe(200);

      const before = store.verification.length;
      const options = await call(auth, browser, '/passkey/generate-register-options');
      const verify = await call(auth, browser, '/passkey/verify-registration', { response: new Authenticator().create('any') });

      expect(options).toMatchObject({ body: { code: 'EMAIL_CONFIRMATION_REQUIRED', message: 'Confirm your email address to add a passkey' }, status: 403 });
      expect(verify).toMatchObject({ body: { code: 'EMAIL_CONFIRMATION_REQUIRED' }, status: 403 });
      expect(store.verification).toHaveLength(before);
      expect(store.passkey).toEqual([]);
    });

    it('refuses an account with no password the same way, however young its session', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA, false);
      store.account.length = 0;

      await expect(call(auth, browser, '/passkey/generate-register-options')).resolves.toMatchObject({
        body: { code: 'EMAIL_CONFIRMATION_REQUIRED' },
        status: 403
      });
    });
  });

  describe('the password first, for an account that has one', () => {
    it('refuses both steps 403 PASSWORD_CONFIRMATION_REQUIRED until the password is confirmed, and writes no challenge', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);

      const options = await call(auth, browser, '/passkey/generate-register-options');
      const verify = await call(auth, browser, '/passkey/verify-registration', { response: new Authenticator().create('any') });

      expect(options).toMatchObject({ body: { code: 'PASSWORD_CONFIRMATION_REQUIRED' }, status: 403 });
      expect(verify).toMatchObject({ body: { code: 'PASSWORD_CONFIRMATION_REQUIRED' }, status: 403 });
      expect(store.verification).toEqual([]);
      expect(store.passkey).toEqual([]);
    });

    it('refuses a wrong password with INVALID_PASSWORD and grants nothing', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);

      const refused = await confirm(auth, browser, 'not-the-password-at-all');

      expect(refused).toMatchObject({ body: { code: 'INVALID_PASSWORD' }, status: 400 });
      await expect(call(auth, browser, '/passkey/generate-register-options')).resolves.toMatchObject({ status: 403 });
    });

    it('grants one passkey per confirmation: the next one asks for the password again', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);

      expect((await addPasskey(auth, browser, new Authenticator())).status).toBe(200);
      await expect(call(auth, browser, '/passkey/generate-register-options')).resolves.toMatchObject({
        body: { code: 'PASSWORD_CONFIRMATION_REQUIRED' },
        status: 403
      });
    });

    it('is spent by the verify itself, before the plugin runs: a verify the plugin refuses spends it all the same', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      await confirm(auth, browser);
      await call(auth, browser, '/passkey/generate-register-options');

      const refused = await call(auth, browser, '/passkey/verify-registration', { response: new Authenticator().create('not-the-challenge') });

      expect(refused.status).toBeGreaterThanOrEqual(400);
      expect(UserController.spendGrant).toHaveBeenCalledTimes(1);
      expect(store.verification.filter(row => String(row.identifier).startsWith('passkey-grant-'))).toEqual([]);
      await expect(call(auth, browser, '/passkey/verify-registration', { response: new Authenticator().create('any') })).resolves.toMatchObject({
        body: { code: 'PASSWORD_CONFIRMATION_REQUIRED' },
        status: 403
      });
    });

    it('grants only the session that confirmed it, and only for ten minutes', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      const other = new Browser();
      await call(auth, other, '/sign-in/email', { email: ANA.email, password: PASSWORD });
      await confirm(auth, browser);

      await expect(call(auth, other, '/passkey/generate-register-options')).resolves.toMatchObject({ status: 403 });

      for (const row of store.verification.filter(candidate => String(candidate.identifier).startsWith('passkey-grant-'))) {
        row.expiresAt = new Date(Date.now() - 1000);
      }

      await expect(call(auth, browser, '/passkey/generate-register-options')).resolves.toMatchObject({
        body: { code: 'PASSWORD_CONFIRMATION_REQUIRED' },
        status: 403
      });
    });

    it('keeps the password out of every row and every line', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      await confirm(auth, browser);
      await confirm(auth, browser, 'a-wrong-guess-of-a-password');

      expect(JSON.stringify(store.verification)).not.toContain(PASSWORD);
      expect(logged.join('\n')).not.toContain(PASSWORD);
      expect(logged.join('\n')).not.toContain('a-wrong-guess-of-a-password');
    });

    it('answers no session with the route’s own 401', async () => {
      const auth = build();

      await expect(confirm(auth, new Browser())).resolves.toMatchObject({ status: 401 });
    });
  });

  describe('an account with no password (Google or Apple only)', () => {
    it('has nothing to confirm: the guard’s 404, byte for byte', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      store.account.length = 0;

      await expect(confirm(auth, browser)).resolves.toMatchObject({ raw: NOT_FOUND, status: 404 });
    });

    it('adds one from a session ten minutes young, and refuses an older one 403 SESSION_NOT_FRESH', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      store.account.length = 0;
      const device = new Authenticator();

      const options = await call(auth, browser, '/passkey/generate-register-options');
      const added = await call(auth, browser, '/passkey/verify-registration', { response: device.create(options.body?.challenge as string) });

      expect(added.status).toBe(200);

      for (const row of store.session) {
        row.createdAt = new Date(Date.now() - 11 * 60 * 1000);
      }

      await expect(call(auth, browser, '/passkey/generate-register-options')).resolves.toMatchObject({
        body: { code: 'SESSION_NOT_FRESH' },
        status: 403
      });
    });
  });

  describe('adding one', () => {
    it('stores the key for the session’s account, writes auth.passkey_added, and mails the account', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      const device = new Authenticator();

      const added = await addPasskey(auth, browser, device);
      await drain();

      expect(added.status).toBe(200);
      expect(store.passkey).toMatchObject([{ credentialID: device.id, name: 'iPhone', transports: 'internal,hybrid', userId: userId(ANA.email) }]);
      expect(passkeyChanged).toHaveBeenCalledTimes(1);
      expect(passkeyChanged).toHaveBeenCalledWith(userId(ANA.email), true);
      expect(mails).toEqual([{ to: ANA.email, userId: userId(ANA.email) }]);
    });

    it('mints no session, whatever the body asks', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      const sessions = store.session.length;
      const counted = sessionsStarted().length;

      const added = await addPasskey(auth, browser, new Authenticator(), { createSession: true });

      expect(added.status).toBe(200);
      expect(added.body?.session).toBeUndefined();
      expect(store.session).toHaveLength(sessions);
      expect(sessionsStarted()).toHaveLength(counted);
    });

    it('refuses a key made for another challenge, and writes and mails nothing', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      await confirm(auth, browser);
      await call(auth, browser, '/passkey/generate-register-options');

      const refused = await call(auth, browser, '/passkey/verify-registration', { response: new Authenticator().create('not-the-challenge') });
      await drain();

      expect(refused.status).toBeGreaterThanOrEqual(400);
      expect(store.passkey).toEqual([]);
      expect(passkeyChanged).not.toHaveBeenCalled();
      expect(mails).toEqual([]);
    });

    it('still answers 200 and mails when the row cannot be written, with a line that names nothing of the key', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);
      const device = new Authenticator();
      passkeyChanged.mockRejectedValue(new Error('database down'));

      const added = await addPasskey(auth, browser, device);
      await drain();

      expect(added.status).toBe(200);
      expect(mails).toHaveLength(1);
      expect(logged).toContain(`passkey_unrecorded {"event":"added","userId":"${userId(ANA.email)}"}`);
      expect(logged.join('\n')).not.toContain(device.id);
    });
  });

  describe('signing in with one', () => {
    it('opens a session for the key’s account with no password, counted once as a visit, and writes nothing to the trail', async () => {
      const auth = build();
      const device = new Authenticator();
      await addPasskey(auth, await signUp(auth, ANA), device);
      passkeyChanged.mockClear();
      const counted = sessionsStarted().length;
      const browser = new Browser();

      const options = await call(auth, browser, '/passkey/generate-authenticate-options');
      const signedIn = await call(auth, browser, '/passkey/verify-authentication', { response: device.get(options.body?.challenge as string) });

      expect(signedIn.status).toBe(200);
      expect(signedIn.body?.user).toMatchObject({ email: ANA.email });
      expect(browser.has('session_token')).toBe(true);
      expect(sessionsStarted()).toHaveLength(counted + 1);
      expect(passkeyChanged).not.toHaveBeenCalled();
    });

    it('opens a session at once for an account with TOTP on: no second step, by design (0083)', async () => {
      const auth = build();
      const device = new Authenticator();
      await addPasskey(auth, await signUp(auth, ANA), device);

      for (const row of store.user) {
        row.twoFactorEnabled = true;
      }

      const browser = new Browser();
      const options = await call(auth, browser, '/passkey/generate-authenticate-options');
      const signedIn = await call(auth, browser, '/passkey/verify-authentication', { response: device.get(options.body?.challenge as string) });

      expect(signedIn.status).toBe(200);
      expect(signedIn.body).not.toHaveProperty('twoFactorRedirect');
      expect(browser.has('session_token')).toBe(true);
      expect(browser.has('two_factor')).toBe(false);
    });

    it('cancels a pending removal of the second factor, awaited, and sends the "cancelled" mail', async () => {
      const auth = build();
      const device = new Authenticator();
      await addPasskey(auth, await signUp(auth, ANA), device);
      await drain();
      cancelRemoval.mockResolvedValue({ email: ANA.email });

      const browser = new Browser();
      const options = await call(auth, browser, '/passkey/generate-authenticate-options');
      const signedIn = await call(auth, browser, '/passkey/verify-authentication', { response: device.get(options.body?.challenge as string) });

      expect(signedIn.status).toBe(200);
      expect(cancelRemoval).toHaveBeenCalledWith(userId(ANA.email));

      await drain();

      expect(removalMails).toEqual([{ event: { kind: 'cancelled' }, to: ANA.email, userId: userId(ANA.email) }]);
    });

    it('signs in all the same when the cancel fails, with a line that names only the account', async () => {
      const auth = build();
      const device = new Authenticator();
      await addPasskey(auth, await signUp(auth, ANA), device);
      cancelRemoval.mockRejectedValue(new Error('database down'));

      const browser = new Browser();
      const options = await call(auth, browser, '/passkey/generate-authenticate-options');
      const signedIn = await call(auth, browser, '/passkey/verify-authentication', { response: device.get(options.body?.challenge as string) });
      await drain();

      expect(signedIn.status).toBe(200);
      expect(logged).toContain(`two_factor_removal_uncancelled {"userId":"${userId(ANA.email)}"}`);
      expect(removalMails).toEqual([]);
    });

    it('asks nothing of the removal on a refused sign-in', async () => {
      const auth = build();
      const browser = new Browser();
      const options = await call(auth, browser, '/passkey/generate-authenticate-options');

      await call(auth, browser, '/passkey/verify-authentication', { response: new Authenticator().get(options.body?.challenge as string) });

      expect(cancelRemoval).not.toHaveBeenCalled();
    });

    it('keeps both challenges out of every line when the answer was made for another one', async () => {
      const auth = build();
      const device = new Authenticator();
      await addPasskey(auth, await signUp(auth, ANA), device);
      logged.length = 0;

      const browser = new Browser();
      const options = await call(auth, browser, '/passkey/generate-authenticate-options');
      const ours = options.body?.challenge as string;
      const theirs = 'a-challenge-somebody-else-was-given';
      const refused = await call(auth, browser, '/passkey/verify-authentication', { response: device.get(theirs) });

      expect(refused).toMatchObject({ body: { code: 'AUTHENTICATION_FAILED' }, status: 400 });
      expect(logged.join('\n')).toContain('Failed to verify authentication');
      expect(logged.join('\n')).not.toContain(ours);
      expect(logged.join('\n')).not.toContain(theirs);
    });

    it('refuses a key nobody registered, with no session', async () => {
      const auth = build();
      const browser = new Browser();

      const options = await call(auth, browser, '/passkey/generate-authenticate-options');
      const refused = await call(auth, browser, '/passkey/verify-authentication', {
        response: new Authenticator().get(options.body?.challenge as string)
      });

      expect(refused.status).toBe(401);
      expect(browser.has('session_token')).toBe(false);
    });
  });

  describe('listing and removing, by the session’s own account only', () => {
    async function twoAccounts(auth: Auth) {
      const ana = await signUp(auth, ANA);
      const bea = await signUp(auth, BEA);
      await addPasskey(auth, ana, new Authenticator());
      await addPasskey(auth, bea, new Authenticator());
      await drain();
      passkeyChanged.mockClear();
      mails.length = 0;
      const beas = store.passkey.find(row => row.userId === userId(BEA.email))?.id as string;

      return { ana, bea, beas };
    }

    it('lists the account’s own passkeys and nobody else’s', async () => {
      const auth = build();
      const { ana } = await twoAccounts(auth);

      const listed = await call(auth, ana, '/passkey/list-user-passkeys');

      expect(listed.status).toBe(200);
      expect(listed.body).toHaveLength(1);
      expect(listed.body).toMatchObject([{ name: 'iPhone', userId: userId(ANA.email) }]);
    });

    it('answers another account’s passkey the guard’s 404, byte for byte the same as an id that does not exist, and removes nothing', async () => {
      const auth = build();
      const { ana, beas } = await twoAccounts(auth);

      const theirs = await call(auth, ana, '/passkey/delete-passkey', { id: beas });
      const nobodys = await call(auth, ana, '/passkey/delete-passkey', { id: 'no-such-passkey' });
      const renamed = await call(auth, ana, '/passkey/update-passkey', { id: beas, name: 'mine now' });

      expect(theirs).toMatchObject({ raw: NOT_FOUND, status: 404 });
      expect(nobodys).toMatchObject({ raw: NOT_FOUND, status: 404 });
      expect(renamed).toMatchObject({ raw: NOT_FOUND, status: 404 });
      expect(store.passkey).toHaveLength(2);
      expect(store.passkey.find(row => row.id === beas)?.name).toBe('iPhone');
      expect(passkeyChanged).not.toHaveBeenCalled();
    });

    it('removes the account’s own, writes auth.passkey_removed and mails nothing', async () => {
      const auth = build();
      const { bea, beas } = await twoAccounts(auth);

      const removed = await call(auth, bea, '/passkey/delete-passkey', { id: beas });
      await drain();

      expect(removed).toMatchObject({ body: { status: true }, status: 200 });
      expect(store.passkey.map(row => row.userId)).toEqual([userId(ANA.email)]);
      expect(passkeyChanged).toHaveBeenCalledWith(userId(BEA.email), false);
      expect(mails).toEqual([]);
    });

    it('answers no session with the route’s own 401', async () => {
      const auth = build();
      const { beas } = await twoAccounts(auth);

      await expect(call(auth, new Browser(), '/passkey/delete-passkey', { id: beas })).resolves.toMatchObject({ status: 401 });
      await expect(call(auth, new Browser(), '/passkey/list-user-passkeys')).resolves.toMatchObject({ status: 401 });
      expect(store.passkey).toHaveLength(2);
    });
  });
});
