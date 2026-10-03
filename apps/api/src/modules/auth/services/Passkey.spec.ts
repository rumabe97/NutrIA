import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AnalyticsController } from 'core/controllers/Analytics';
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
 * `UserController` and `AnalyticsController` writes (spied — their SQL is
 * `packages/core`'s to prove) and the background runner (collected;
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

jest.unstable_mockModule('better-auth/adapters/drizzle', () => ({ drizzleAdapter: () => memoryAdapter(store) }));
jest.unstable_mockModule('database', () => ({ database: () => ({}) }));
jest.unstable_mockModule('./SelfService.js', () => ({
  onAccountCreated: async () => Promise.resolve(),
  onAddressConfirmed: async () => Promise.resolve()
}));
jest.unstable_mockModule('./VerificationMail.js', () => ({ sendVerificationMail: async () => Promise.resolve() }));
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
 * hands back, built by hand. Flags UP and UV (and AT when registering), a
 * zero AAGUID as an iPhone sends under attestation `none`, the signature an
 * ECDSA P-256 over the authenticator data and the client data's hash.
 */
class Authenticator {
  readonly credentialId = randomBytes(16);
  private readonly keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  private counter = 0;

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
      Buffer.from([0x45]),
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
    const authData = Buffer.concat([sha256('localhost'), Buffer.from([0x05]), uint32(this.counter)]);

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

async function signUp(auth: Auth, account: { email: string; name: string }): Promise<Browser> {
  const browser = new Browser();
  await call(auth, browser, '/sign-up/email', { ...account, password: PASSWORD });

  return browser;
}

/** The browser asks for options, the device makes a key, the browser hands it back: the answer of the last step. */
async function addPasskey(auth: Auth, browser: Browser, device: Authenticator, extra: Record<string, unknown> = {}) {
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
  const logged: string[] = [];

  beforeEach(() => {
    for (const rows of Object.values(store)) {
      rows.length = 0;
    }

    mails.length = 0;
    tasks.length = 0;
    logged.length = 0;
    passkeyChanged = jest.spyOn(UserController, 'passkeyChanged').mockResolvedValue(undefined);
    analytics = jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);
    jest.spyOn(AnalyticsController, 'recordUse').mockResolvedValue(undefined);

    const keep = (...parts: unknown[]) => {
      logged.push(parts.map(part => (typeof part === 'string' ? part : JSON.stringify(part))).join(' '));
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

      const options = await call(auth, browser, '/passkey/generate-register-options');

      expect(options.status).toBe(200);
      expect(options.body?.rp).toEqual({ id: 'localhost', name: 'NutrIA' });
      expect(options.body?.attestation).toBe('none');
    });
  });

  describe('who may add one', () => {
    it('answers no session with the route’s own 401, and writes no challenge', async () => {
      const auth = build();

      await expect(call(auth, new Browser(), '/passkey/generate-register-options')).resolves.toMatchObject({ status: 401 });
      expect(store.verification).toEqual([]);
    });

    it('answers a session older than a day 403 SESSION_NOT_FRESH: the web asks for a fresh sign-in', async () => {
      const auth = build();
      const browser = await signUp(auth, ANA);

      for (const row of store.session) {
        row.createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
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
