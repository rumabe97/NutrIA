import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import request from 'supertest';
import { hashPassword } from 'better-auth/crypto';

import { database } from 'database';

import { EmailService } from '../src/modules/email/services/index.js';
import { activate, CookieJar, createApp, deleteAccountByEmail, httpServer, paced, PREFIX, ScriptedAiClient } from './harness.js';

import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * Passkeys (project 011, phase 5): Better Auth's `passkey` plugin, used as it
 * is, with the product's hooks around it.
 *
 * - registration options need a session — none is the route's own 401 — and
 *   name the web's own host as the relying party;
 * - a password account confirms its password first (`/passkey/confirm-password`):
 *   without it both steps are 403 `PASSWORD_CONFIRMATION_REQUIRED`, a wrong
 *   one is `INVALID_PASSWORD`, and one confirmation lets one passkey in;
 * - a key added from a session is stored for that session's account, under
 *   the real column names, writes `auth.passkey_added` (no entity id, no IP,
 *   nothing in the metadata) and mails the account, with no word of health;
 * - a sign-in with the key opens a session for its account, counted once;
 * - the list holds the account's own passkeys and nobody else's;
 * - another account's passkey, by delete or by rename, is the guard's 404
 *   byte for byte — the same answer as an id that does not exist — and
 *   changes nothing; the account's own is removed with `auth.passkey_removed`;
 * - one credential id is registered once, whoever tries again;
 * - a password reset removes every passkey of the account, one
 *   `auth.passkey_removed` each, and its mail says so;
 * - deleting the account deletes its passkeys (ON DELETE CASCADE).
 *
 * The device is `Authenticator` below — a P-256 key made here, packed as a
 * browser hands it over with attestation `none` — so the plugin's real
 * verification runs. Mail is caught at `EmailService.send`; nothing is sent.
 *
 * Requires a real database — see ./README.md.
 */
const PASSWORD = 'correct-horse-battery-staple-9';
/** Used only to delete what is left: written straight into an account's credential, then signed in with. */
const CLEANUP_PASSWORD = 'quiet-orchard-lamp-velvet-3';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const APP = 'http://localhost:3000';
const RP_ID = 'localhost';
const ADDED_MAIL = /llave de acceso/i;
/** M14: the mail says nothing of health. */
const HEALTH_WORDS = /alerg|allerg|salud|health|dieta|diet\b|peso|weight|calor|medic|embaraz|pregnan/i;

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;
type Made = { readonly id: string; readonly email: string };
type AuditRow = {
  readonly actorId: string | null;
  readonly entity: string;
  readonly entityId: string | null;
  readonly ipHash: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly subjectUserId: string | null;
};

function pause(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
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
 * `credentialId` can be given, to try one id twice.
 */
class Authenticator {
  private readonly keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  private counter = 0;

  constructor(readonly credentialId: Buffer = randomBytes(16)) {}

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
    const authData = Buffer.concat([sha256(RP_ID), Buffer.from([0x45]), uint32(this.counter), Buffer.alloc(16), length, this.credentialId, cose]);
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
        clientDataJSON: Buffer.from(JSON.stringify({ challenge, crossOrigin: false, origin: APP, type: 'webauthn.create' })).toString('base64url'),
        transports: ['internal', 'hybrid']
      },
      type: 'public-key'
    };
  }

  get(challenge: string): Record<string, unknown> {
    this.counter += 1;
    const clientData = Buffer.from(JSON.stringify({ challenge, crossOrigin: false, origin: APP, type: 'webauthn.get' }));
    const authData = Buffer.concat([sha256(RP_ID), Buffer.from([0x05]), uint32(this.counter)]);

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

describe('passkeys: Better Auth’s plugin, owned by the session', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pattern = `passkeys-%-${String(stamp)}@e2e.invalid`;
  const sql = (): Sql => (database() as unknown as { readonly $client: Sql }).$client;
  const outbox: OutgoingEmail[] = [];
  let started = '';

  const server = () => httpServer(app);
  const emailFor = (label: string) => `passkeys-${label}-${String(stamp)}@e2e.invalid`;

  async function post(path: string, cookie: string, body: object = {}): Promise<Response> {
    return paced(() =>
      request(server())
        .post(`/${PREFIX}/${path}`)
        .set('Cookie', cookie)
        .set('Origin', APP)
        .set('User-Agent', IPHONE)
        .set('Accept-Language', 'es')
        .send(body)
    );
  }

  async function get(path: string, cookie: string): Promise<Response> {
    return paced(() => request(server()).get(`/${PREFIX}/${path}`).set('Cookie', cookie).set('Origin', APP).set('User-Agent', IPHONE));
  }

  /** Signed up, both locks open, and signed in: the session lands in a fresh jar. */
  async function account(label: string): Promise<Made & { readonly jar: CookieJar }> {
    const email = emailFor(label);
    const made = await paced(() => request(server()).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: label, password: PASSWORD }));

    expect(made.status).toBe(200);

    const id = (made.body as { user: { id: string } }).user.id;

    await activate(email);

    const signedIn = await post('auth/sign-in/email', '', { email, password: PASSWORD });

    expect(signedIn.status).toBe(200);

    return { id, email, jar: new CookieJar().take(signedIn) };
  }

  /** The password confirmed for the jar's session, as the web asks before adding a passkey. */
  async function confirm(jar: CookieJar, password = PASSWORD): Promise<Response> {
    return post('auth/passkey/confirm-password', jar.header, { password });
  }

  /** The password confirmed, then options, the device's answer, the verify: the verify's response. */
  async function addPasskey(jar: CookieJar, device: Authenticator): Promise<Response> {
    expect((await confirm(jar)).status).toBe(200);

    const options = await get('auth/passkey/generate-register-options', jar.header);

    expect(options.status).toBe(200);
    jar.take(options);

    return post('auth/passkey/verify-registration', jar.header, {
      name: 'iPhone',
      response: device.create((options.body as { challenge: string }).challenge)
    });
  }

  async function passkeysOf(userId: string): Promise<{ id: string; credentialId: string }[]> {
    return sql()<{
      id: string;
      credentialId: string;
    }>`select id, credential_id as "credentialId" from passkey where user_id = ${userId} order by created_at`;
  }

  async function auditRows(userId: string, action: string): Promise<AuditRow[]> {
    return sql()<AuditRow>`
      select actor_id as "actorId", entity, entity_id as "entityId", ip_hash as "ipHash", metadata, subject_user_id as "subjectUserId"
      from audit_logs
      where action = ${action} and created_at >= ${started} and (actor_id = ${userId} or subject_user_id = ${userId})
      order by created_at, id`;
  }

  async function sessionStarts(userId: string): Promise<number> {
    const [row] = await sql()<{ n: number }>`
      select count(*)::int as n from analytics_events where user_id = ${userId} and event = 'session_started'`;

    return row?.n ?? 0;
  }

  async function until(check: () => boolean | Promise<boolean>, what: string): Promise<void> {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      if (await check()) {
        return;
      }

      await pause(100);
    }

    throw new Error(`${what} did not happen within 10 s`);
  }

  /** What the session guard answers a caller with no session: the 404 every denial here must be, byte for byte. */
  async function guardsNotFound(): Promise<{ readonly status: number; readonly text: string }> {
    const answer = await paced(() => request(server()).get(`/${PREFIX}/profile`));

    return { status: answer.status, text: answer.text };
  }

  beforeAll(async () => {
    // On the prototype, so whichever instance a module was handed is the one caught.
    jest.spyOn(EmailService.prototype, 'configured', 'get').mockReturnValue(true);
    jest.spyOn(EmailService.prototype, 'send').mockImplementation(async message => {
      outbox.push(message);

      return Promise.resolve(true);
    });

    const [clock] = await sql()<{ now: string }>`select now()::text as now`;

    started = clock?.now ?? '';
    app = await createApp(new ScriptedAiClient([]));
  });

  afterAll(async () => {
    try {
      // Whatever this suite left: given a known password, then deleted through the product's own door.
      const left = await sql()<{ id: string; email: string }>`select id, email from "user" where email like ${pattern}`;
      const known = await hashPassword(CLEANUP_PASSWORD);

      for (const { id, email } of left) {
        await sql()`update account set password = ${known} where user_id = ${id} and provider_id = 'credential'`;
        await deleteAccountByEmail(app, email, CLEANUP_PASSWORD);
      }

      const [remaining] = await sql()<{ n: number }>`select count(*)::int as n from "user" where email like ${pattern}`;

      expect(remaining?.n ?? 0).toBe(0);
    } finally {
      jest.restoreAllMocks();
      await app?.close();
    }
  });

  describe('registration options', () => {
    it('answer no session with the route’s own 401', async () => {
      const refused = await get('auth/passkey/generate-register-options', '');

      expect(refused.status).toBe(401);
      expect(refused.body).not.toHaveProperty('challenge');
    });

    it('name the web’s own host as the relying party, NutrIA', async () => {
      const { jar } = await account('options');

      expect((await confirm(jar)).status).toBe(200);

      const options = await get('auth/passkey/generate-register-options', jar.header);

      expect(options.status).toBe(200);
      expect(options.body).toMatchObject({ attestation: 'none', rp: { id: RP_ID, name: 'NutrIA' } });
    });
  });

  describe('the password first', () => {
    it('refuses both steps 403 PASSWORD_CONFIRMATION_REQUIRED without it, a wrong one with INVALID_PASSWORD, and lets one passkey in per confirmation', async () => {
      const { id, jar } = await account('confirms');

      const unconfirmed = await get('auth/passkey/generate-register-options', jar.header);
      const verify = await post('auth/passkey/verify-registration', jar.header, { response: new Authenticator().create('any') });
      const wrong = await confirm(jar, 'not-the-password-at-all-7');

      expect(unconfirmed.status).toBe(403);
      expect((unconfirmed.body as { code?: string }).code).toBe('PASSWORD_CONFIRMATION_REQUIRED');
      expect(verify.status).toBe(403);
      expect(wrong.status).toBe(400);
      expect((wrong.body as { code?: string }).code).toBe('INVALID_PASSWORD');
      expect((await get('auth/passkey/generate-register-options', jar.header)).status).toBe(403);

      expect((await addPasskey(jar, new Authenticator())).status).toBe(200);
      expect((await get('auth/passkey/generate-register-options', jar.header)).status).toBe(403);
      expect(await passkeysOf(id)).toHaveLength(1);

      const [grants] = await sql()<{ n: number }>`
        select count(*)::int as n from verification where identifier like 'passkey-grant-%' and value = ${id}`;

      expect(grants?.n).toBe(0);
    });
  });

  describe('adding one and signing in with it', () => {
    it('stores the key for the session’s account, writes auth.passkey_added with nothing in it, and mails the account', async () => {
      const { id, email, jar } = await account('adds');
      const device = new Authenticator();

      const added = await addPasskey(jar, device);

      expect(added.status).toBe(200);
      expect(added.body).not.toHaveProperty('session');
      expect(await passkeysOf(id)).toEqual([{ id: (added.body as { id: string }).id, credentialId: device.id }]);

      const [row, ...more] = await auditRows(id, 'auth.passkey_added');

      expect(more).toEqual([]);
      expect(row).toEqual({ actorId: id, entity: 'passkey', entityId: null, ipHash: null, metadata: {}, subjectUserId: id });

      await until(() => outbox.some(mail => mail.to === email && ADDED_MAIL.test(mail.subject)), 'the passkey mail');

      const mail = outbox.find(sent => sent.to === email && ADDED_MAIL.test(sent.subject));
      const said = `${mail?.subject ?? ''}\n${mail?.text ?? ''}`;

      expect(said).toMatch(/iPhone/);
      expect(said).not.toContain(IPHONE);
      expect(said).not.toMatch(HEALTH_WORDS);
      expect(said).not.toContain(device.id);
    });

    it('signs in with the key, with no password, into its own account, counted as one visit', async () => {
      const { id, email, jar } = await account('signs-in');
      const device = new Authenticator();

      expect((await addPasskey(jar, device)).status).toBe(200);

      const visits = await sessionStarts(id);
      const browser = new CookieJar();
      const options = await get('auth/passkey/generate-authenticate-options', '');

      browser.take(options);

      const signedIn = await post('auth/passkey/verify-authentication', browser.header, {
        response: device.get((options.body as { challenge: string }).challenge)
      });

      expect(signedIn.status).toBe(200);
      expect(signedIn.body).toMatchObject({ user: { id, email } });
      expect(browser.take(signedIn).has('session_token')).toBe(true);
      expect(await sessionStarts(id)).toBe(visits + 1);

      const me = await get('users/me', browser.header);

      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({ id });
    });

    it('registers one credential id once: another account offering the same id gets no passkey and no row', async () => {
      const first = await account('first-id');
      const second = await account('same-id');
      const device = new Authenticator();

      expect((await addPasskey(first.jar, device)).status).toBe(200);

      const again = await addPasskey(second.jar, new Authenticator(device.credentialId));

      expect(again.status).toBeGreaterThanOrEqual(400);
      expect(await passkeysOf(second.id)).toEqual([]);
      expect(await auditRows(second.id, 'auth.passkey_added')).toEqual([]);
      expect(await passkeysOf(first.id)).toHaveLength(1);
    });
  });

  describe('listing and removing, owned by the session', () => {
    it('lists the account’s own passkeys and nobody else’s', async () => {
      const ana = await account('lists-ana');
      const bea = await account('lists-bea');

      await addPasskey(ana.jar, new Authenticator());
      await addPasskey(bea.jar, new Authenticator());

      const listed = await get('auth/passkey/list-user-passkeys', ana.jar.header);

      expect(listed.status).toBe(200);
      expect(listed.body).toHaveLength(1);
      expect(listed.body).toMatchObject([{ name: 'iPhone', userId: ana.id }]);
      expect((await get('auth/passkey/list-user-passkeys', '')).status).toBe(401);
    });

    it('answers another account’s passkey the guard’s 404, byte for byte as an id that does not exist, and changes nothing', async () => {
      const ana = await account('denied-ana');
      const bea = await account('denied-bea');

      await addPasskey(bea.jar, new Authenticator());

      const [beas] = await passkeysOf(bea.id);
      const notFound = await guardsNotFound();
      const deleted = await post('auth/passkey/delete-passkey', ana.jar.header, { id: beas?.id });
      const renamed = await post('auth/passkey/update-passkey', ana.jar.header, { id: beas?.id, name: 'mine now' });
      const nobodys = await post('auth/passkey/delete-passkey', ana.jar.header, { id: 'no-such-passkey' });

      for (const answer of [deleted, renamed, nobodys]) {
        expect(answer.status).toBe(notFound.status);
        expect(answer.text).toBe(notFound.text);
      }

      const [still] = await sql()<{ name: string }>`select name from passkey where id = ${beas?.id ?? ''}`;

      expect(still).toEqual({ name: 'iPhone' });
      expect(await auditRows(ana.id, 'auth.passkey_removed')).toEqual([]);
    });

    it('removes the account’s own and writes auth.passkey_removed with nothing in it', async () => {
      const { id, jar } = await account('removes');

      await addPasskey(jar, new Authenticator());

      const [own] = await passkeysOf(id);
      const removed = await post('auth/passkey/delete-passkey', jar.header, { id: own?.id });

      expect(removed.status).toBe(200);
      expect(removed.body).toEqual({ status: true });
      expect(await passkeysOf(id)).toEqual([]);
      expect(await auditRows(id, 'auth.passkey_removed')).toEqual([
        { actorId: id, entity: 'passkey', entityId: null, ipHash: null, metadata: {}, subjectUserId: id }
      ]);
    });
  });

  describe('a password reset', () => {
    it('removes every passkey of the account, writes auth.passkey_removed for each, and the mail says so', async () => {
      const { id, email, jar } = await account('reset');

      await addPasskey(jar, new Authenticator());
      await addPasskey(jar, new Authenticator());
      expect(await passkeysOf(id)).toHaveLength(2);

      expect((await post('auth/request-password-reset', '', { email })).status).toBe(200);

      // Read from the table, not from the mail: the row is written before the response, the mail may land after it.
      const [row] = await sql()<{ identifier: string }>`
        select identifier from verification where value = ${id} and identifier like 'reset-password:%' order by created_at desc limit 1`;
      const token = row?.identifier.slice('reset-password:'.length) ?? '';
      const reset = await post('auth/reset-password', '', { newPassword: 'amber-lantern-quietly-walks-7', token });

      expect(reset.status).toBe(200);
      expect(await passkeysOf(id)).toEqual([]);
      expect(await auditRows(id, 'auth.passkey_removed')).toEqual([
        { actorId: id, entity: 'passkey', entityId: null, ipHash: null, metadata: {}, subjectUserId: id },
        { actorId: id, entity: 'passkey', entityId: null, ipHash: null, metadata: {}, subjectUserId: id }
      ]);

      await until(() => outbox.some(mail => mail.to === email && /han quitado las 2 llaves de acceso/.test(mail.text)), 'the reset mail');
    });
  });

  describe('deleting the account', () => {
    it('deletes its passkeys with it', async () => {
      const { id, jar } = await account('deleted');

      await addPasskey(jar, new Authenticator());
      await addPasskey(jar, new Authenticator());
      expect(await passkeysOf(id)).toHaveLength(2);

      const gone = await paced(() => request(server()).delete(`/${PREFIX}/users/me`).set('Cookie', jar.header));

      expect(gone.status).toBe(204);
      expect(await passkeysOf(id)).toEqual([]);
    });
  });
});
