import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { hashPassword } from 'better-auth/crypto';

import { UserController } from 'core/controllers/User';
import { database } from 'database';

import { EmailService } from '../src/modules/email/services/index.js';
import {
  activate,
  CookieJar,
  createApp,
  deleteAccountByEmail,
  httpServer,
  paced,
  PREFIX,
  ScriptedAiClient,
  TotpClock,
  totpCode,
  totpSecret
} from './harness.js';

import type { INestApplication } from '@nestjs/common';
import type { OutgoingEmail } from '../src/modules/email/services/index.js';
import type { Response } from 'supertest';

/**
 * Taking a second factor off for somebody who lost it (project 011, phase 4):
 * the owner asks, the account's own address is told at once, and nothing is
 * removed until the daily cron runs past `due_at` (48 h after the request).
 *
 * - `POST /admin/accounts/:id/two-factor/removal` → 201 `{ dueAt }`, only for an
 *   account with the factor on; a second one while one waits is 409
 *   `TWO_FACTOR_REMOVAL_PENDING`, an account without it 409
 *   `TWO_FACTOR_NOT_ENABLED`; `DELETE` cancels (204), and with nothing
 *   waiting is a 404; both are the admin guard's 404 for anybody else;
 * - the cron before `due_at` removes nothing; past it (moved there on the
 *   table) it deletes the `two_factor` row, turns the flag off, forgets every
 *   trusted device, writes `auth.2fa_removed_by_owner` with no actor and
 *   mails the address — once, however many times it runs;
 * - a right TOTP or backup code typed by the account in between cancels the
 *   request (`auth.2fa_removal_cancelled {by:'account'}`, and a mail); a wrong
 *   one does not; a cancelled request is never carried out;
 * - every row follows the phase 2 rule: ids only in `actorId` and
 *   `subjectUserId`, no `entityId`, no `ipHash`, metadata minimal;
 * - no secret, code or TOTP value in a response, a row or a mail, and no mail
 *   names anybody but the account it goes to.
 *
 * Mail is caught at `EmailService.send` (`two-factor.e2e-spec.ts`); nothing is
 * sent. Every code is computed here from the `otpauth://` URI.
 *
 * Requires a real database — see ./README.md.
 */
const ORIGINAL = 'correct-horse-battery-staple-9';
/** Used only to delete what is left: written straight into an account's credential, then signed in with. */
const CLEANUP_PASSWORD = 'quiet-orchard-lamp-velvet-3';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const HOUR = 3_600_000;
/** The three mails, by their `EmailKind`. */
const REQUESTED_MAIL: string = 'two-factor-removal-requested';
const CANCELLED_MAIL: string = 'two-factor-removal-cancelled';
const REMOVED_MAIL: string = 'two-factor-removed';
/** M14: the mail says nothing of health. */
const HEALTH_WORDS = /alerg|allerg|salud|health|dieta|diet\b|peso|weight|calor|medic|embaraz|pregnan/i;

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;
type Made = { readonly id: string; readonly email: string };
type WithFactor = Made & { readonly backupCodes: readonly string[]; readonly jar: CookieJar; readonly uri: string };
type AuditRow = {
  readonly actorId: string | null;
  readonly entity: string;
  readonly entityId: string | null;
  readonly ipHash: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly subjectUserId: string | null;
};
/** The two instants as epoch milliseconds, so they compare as numbers and not as Postgres's text. */
type RemovalRow = { readonly cancelledAt: string | null; readonly dueAt: number; readonly requestedAt: number; readonly requestedBy: string | null };

function code(response: Response): string | undefined {
  return (response.body as { code?: string }).code;
}

/** A code outside the server's ±1 window, and none of the three inside it. */
function wrongCode(uri: string): string {
  const accepted = new Set([-1, 0, 1].map(steps => totpCode(uri, steps)));

  for (let steps = 3; ; steps += 1) {
    const candidate = totpCode(uri, steps);

    if (!accepted.has(candidate)) {
      return candidate;
    }
  }
}

function pause(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

describe('two-factor-removal: the owner takes a lost factor off, 48 hours after telling the account', () => {
  let app: INestApplication;
  let owner: Made & { readonly cookie: string };
  let ordinary: Made & { readonly cookie: string };
  const stamp = Date.now();
  const pattern = `two-factor-removal-%-${String(stamp)}@e2e.invalid`;
  const sql = (): Sql => (database() as unknown as { readonly $client: Sql }).$client;
  const cronSecret = randomBytes(24).toString('hex');
  const previousCronSecret = process.env['CRON_SECRET'];
  const clock = new TotpClock();
  const outbox: OutgoingEmail[] = [];
  /** Every secret and backup code this suite was handed, and every code it typed: they may be in no row, mail or other response. */
  const secrets: string[] = [];
  /** Every response body but enable's, so the end can look for the secrets in them. */
  const bodies: string[] = [];
  let started = '';

  const server = () => httpServer(app);
  const emailFor = (label: string) => `two-factor-removal-${label}-${String(stamp)}@e2e.invalid`;
  const mailsTo = (email: string, kind: string) => outbox.filter(mail => mail.to === email && mail.kind === kind);

  function seen(response: Response): Response {
    bodies.push(JSON.stringify(response.body ?? {}));

    return response;
  }

  async function post(path: string, cookie: string, body: object = {}): Promise<Response> {
    return seen(
      await paced(() =>
        request(server()).post(`/${PREFIX}/${path}`).set('Cookie', cookie).set('User-Agent', IPHONE).set('Accept-Language', 'es').send(body)
      )
    );
  }

  async function get(path: string, cookie: string): Promise<Response> {
    return seen(await paced(() => request(server()).get(`/${PREFIX}/${path}`).set('Cookie', cookie).set('User-Agent', IPHONE)));
  }

  async function account(label: string, name: string): Promise<Made> {
    const email = emailFor(label);
    const made = await paced(() =>
      request(server()).post(`/${PREFIX}/auth/sign-up/email`).set('User-Agent', IPHONE).send({ email, name, password: ORIGINAL })
    );

    expect(made.status).toBe(200);

    const id = (made.body as { user: { id: string } }).user.id;

    await sql()`delete from session where user_id = ${id}`;
    await activate(email);

    return { id, email };
  }

  async function signedIn(email: string): Promise<CookieJar> {
    const response = await post('auth/sign-in/email', '', { email, password: ORIGINAL });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('twoFactorRedirect');

    return new CookieJar().take(response);
  }

  async function challenged(email: string): Promise<CookieJar> {
    const response = await post('auth/sign-in/email', '', { email, password: ORIGINAL });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ twoFactorMethods: ['totp'], twoFactorRedirect: true });

    return new CookieJar().take(response);
  }

  async function verifyTotp(cookie: string, typed: string, trustDevice?: boolean): Promise<Response> {
    secrets.push(typed);

    return post('auth/two-factor/verify-totp', cookie, trustDevice === undefined ? { code: typed } : { code: typed, trustDevice });
  }

  /** An account with the factor on, signed in by the session the enabling verify handed back. */
  async function withFactor(label: string, name: string): Promise<WithFactor> {
    const made = await account(label, name);
    const jar = await signedIn(made.email);
    // Not through `post`: the one response the secret may be in.
    const enabled = await paced(() =>
      request(server()).post(`/${PREFIX}/auth/two-factor/enable`).set('Cookie', jar.header).set('User-Agent', IPHONE).send({ password: ORIGINAL })
    );

    expect(enabled.status).toBe(200);

    const { backupCodes, totpURI } = enabled.body as { backupCodes: string[]; totpURI: string };
    const secret = totpSecret(totpURI);

    secrets.push(secret.base32, secret.raw, ...backupCodes);

    const verified = await verifyTotp(jar.header, await clock.fresh(totpURI));

    expect(verified.status).toBe(200);
    jar.take(verified);
    expect(await flagOf(made.id)).toBe(true);

    return { ...made, backupCodes, jar, uri: totpURI };
  }

  const removal = (userId: string) => `admin/accounts/${userId}/two-factor/removal`;

  async function requestRemoval(userId: string, cookie = owner.cookie): Promise<Response> {
    return post(removal(userId), cookie);
  }

  async function cancelRemoval(userId: string, cookie = owner.cookie): Promise<Response> {
    return seen(
      await paced(() =>
        request(server())
          .delete(`/${PREFIX}/${removal(userId)}`)
          .set('Cookie', cookie)
          .set('User-Agent', IPHONE)
      )
    );
  }

  async function cron(): Promise<Response> {
    return seen(await request(server()).get(`/${PREFIX}/cron/two-factor-removals`).set('Authorization', `Bearer ${cronSecret}`));
  }

  async function flagOf(userId: string): Promise<boolean | null> {
    const [row] = await sql()<{ on: boolean }>`select two_factor_enabled as on from "user" where id = ${userId}`;

    return row?.on ?? null;
  }

  async function twoFactorRows(userId: string): Promise<number> {
    const [row] = await sql()<{ n: number }>`select count(*)::int as n from two_factor where user_id = ${userId}`;

    return row?.n ?? 0;
  }

  async function removalRows(userId: string): Promise<RemovalRow[]> {
    return sql()<RemovalRow>`
      select requested_by as "requestedBy", (extract(epoch from requested_at) * 1000)::float8 as "requestedAt",
             (extract(epoch from due_at) * 1000)::float8 as "dueAt", cancelled_at::text as "cancelledAt"
      from two_factor_removal where user_id = ${userId}`;
  }

  /** A request still waiting: a row, not cancelled. A row closed by a cancel or by the cron counts as none. */
  async function pending(userId: string): Promise<boolean> {
    return (await removalRows(userId)).some(row => row.cancelledAt === null);
  }

  /** The two days skipped: `due_at` written into the past, which is all the cron reads. */
  async function due(userId: string): Promise<void> {
    await sql()`update two_factor_removal set due_at = now() - interval '1 minute' where user_id = ${userId}`;
  }

  async function trustRows(userId: string): Promise<number> {
    const [row] = await sql()<{ n: number }>`
      select count(*)::int as n from verification where identifier like 'trust-device-%' and value = ${userId}`;

    return row?.n ?? 0;
  }

  async function auditRows(userId: string, action: string): Promise<(AuditRow & { action: string })[]> {
    return sql()<AuditRow & { action: string }>`
      select action, actor_id as "actorId", entity, entity_id as "entityId", ip_hash as "ipHash", metadata, subject_user_id as "subjectUserId"
      from audit_logs
      where action = ${action} and created_at >= ${started} and subject_user_id = ${userId}
      order by created_at, id`;
  }

  /** The phase 2 shape: ids only where they belong, nothing else anywhere. */
  function expectRow(row: AuditRow | undefined, actorId: string | null, subjectUserId: string, metadata: Record<string, unknown>): void {
    expect(row).toMatchObject({ actorId, entityId: null, ipHash: null, subjectUserId });
    expect(row?.metadata ?? {}).toEqual(metadata);
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

  function words(mail: OutgoingEmail | undefined): string {
    return `${mail?.subject ?? ''}\n${mail?.text ?? ''}\n${mail?.html ?? ''}`;
  }

  /** What every mail of this phase may and may not say: the account's own address is the only person in it. */
  function expectQuietMail(mail: OutgoingEmail | undefined): void {
    const said = words(mail);

    expect(mail).toBeDefined();
    expect(said).not.toContain(owner.email);
    expect(said).not.toContain(owner.id);
    expect(said).not.toContain(IPHONE);
    expect(said).not.toMatch(/127\.0\.0\.1|::1|::ffff/);
    expect(`${mail?.subject ?? ''}\n${mail?.text ?? ''}`).not.toMatch(HEALTH_WORDS);

    for (const secret of secrets) {
      expect(said).not.toContain(secret);
    }
  }

  beforeAll(async () => {
    process.env['CRON_SECRET'] = cronSecret;

    // On the prototype, so whichever instance a module was handed is the one caught.
    jest.spyOn(EmailService.prototype, 'configured', 'get').mockReturnValue(true);
    jest.spyOn(EmailService.prototype, 'send').mockImplementation(message => {
      outbox.push(message);

      return Promise.resolve(true);
    });

    const [dbNow] = await sql()<{ now: string }>`select now()::text as now`;

    started = dbNow?.now ?? '';
    app = await createApp(new ScriptedAiClient([]));

    const ownerMade = await account('owner', 'Olivia Dueña');

    await UserController.grantAdmin(ownerMade.email);
    owner = { ...ownerMade, cookie: (await signedIn(ownerMade.email)).header };

    const ordinaryMade = await account('ordinary', 'Oscar Llano');

    ordinary = { ...ordinaryMade, cookie: (await signedIn(ordinaryMade.email)).header };
  });

  afterAll(async () => {
    try {
      // Whatever this suite made, factor on or off, request or none: the factor taken off and a known password given
      // on the table, then deleted through the product's own door. The request row goes with the account (cascade).
      const left = await sql()<Made>`select id, email from "user" where email like ${pattern}`;
      const known = await hashPassword(CLEANUP_PASSWORD);

      for (const { id, email } of left) {
        await sql()`delete from two_factor where user_id = ${id}`;
        await sql()`update "user" set two_factor_enabled = false where id = ${id}`;
        await sql()`update account set password = ${known} where user_id = ${id} and provider_id = 'credential'`;
        await deleteAccountByEmail(app, email, CLEANUP_PASSWORD);
      }

      // What the door could not delete goes on the table: the cascade from `user.id` takes the rest.
      await sql()`delete from "user" where email like ${pattern}`;

      const [remaining] = await sql()<{ n: number }>`select count(*)::int as n from "user" where email like ${pattern}`;

      expect(remaining?.n ?? 0).toBe(0);
    } finally {
      if (previousCronSecret === undefined) {
        delete process.env['CRON_SECRET'];
      } else {
        process.env['CRON_SECRET'] = previousCronSecret;
      }

      jest.restoreAllMocks();
      await app?.close();
    }
  });

  describe('asking', () => {
    it('answers 201 { dueAt } 48 h ahead, mails the account’s own address at once, records it, and removes nothing', async () => {
      const { id, email } = await withFactor('ana', 'Ana Rivas');
      const before = Date.now();
      const asked = await requestRemoval(id);

      expect(asked.status).toBe(201);
      expect(Object.keys(asked.body as object)).toEqual(['dueAt']);

      const dueAt = Date.parse((asked.body as { dueAt: string }).dueAt);

      expect(Math.abs(dueAt - (before + 48 * HOUR))).toBeLessThan(5 * 60_000);

      const [row] = await removalRows(id);

      expect(row).toMatchObject({ cancelledAt: null, requestedBy: owner.id });
      expect(Math.round((row?.dueAt ?? 0) - (row?.requestedAt ?? 0))).toBe(48 * HOUR);
      expect(Math.abs((row?.dueAt ?? 0) - dueAt)).toBeLessThan(1);

      // Nothing is removed yet: the factor is on, its row is there, and the next sign-in is still asked.
      expect(await flagOf(id)).toBe(true);
      expect(await twoFactorRows(id)).toBe(1);

      const rows = await auditRows(id, 'auth.2fa_removal_requested');

      expect(rows).toHaveLength(1);
      expectRow(rows[0], owner.id, id, {});

      await until(() => mailsTo(email, REQUESTED_MAIL).length > 0, 'The "removal requested" mail');
      await pause(500);
      expect(mailsTo(email, REQUESTED_MAIL)).toHaveLength(1);
      expectQuietMail(mailsTo(email, REQUESTED_MAIL)[0]);
      // Only the account's own address is told: nothing went to the owner, or to anybody else, about it.
      expect(outbox.filter(mail => mail.kind === REQUESTED_MAIL && mail.to !== email)).toEqual([]);

      // Still asked at sign-in: the request alone turns nothing off.
      await challenged(email);
    });

    it('a second request while one waits is 409 TWO_FACTOR_REMOVAL_PENDING and changes nothing', async () => {
      const { id, email } = await withFactor('bea', 'Bea Lorca');

      expect((await requestRemoval(id)).status).toBe(201);
      await until(() => mailsTo(email, REQUESTED_MAIL).length > 0, 'The "removal requested" mail');

      const [first] = await removalRows(id);
      const again = await requestRemoval(id);

      expect(again.status).toBe(409);
      expect(code(again)).toBe('TWO_FACTOR_REMOVAL_PENDING');
      expect(await removalRows(id)).toEqual([first]);
      expect(await auditRows(id, 'auth.2fa_removal_requested')).toHaveLength(1);
      await pause(500);
      expect(mailsTo(email, REQUESTED_MAIL)).toHaveLength(1);
    });

    it('an id that is no account is a 404', async () => {
      const asked = await requestRemoval('00000000-0000-4000-8000-000000000000');

      expect(asked.status).toBe(404);
      expect((await requestRemoval('no-such-account')).status).toBe(404);
    });

    it('an account without the factor is 409 TWO_FACTOR_NOT_ENABLED: no row, no record, no mail', async () => {
      const { id, email } = await account('carla', 'Carla Muñoz');
      const refused = await requestRemoval(id);

      expect(refused.status).toBe(409);
      expect(code(refused)).toBe('TWO_FACTOR_NOT_ENABLED');
      expect(await removalRows(id)).toEqual([]);
      expect(await auditRows(id, 'auth.2fa_removal_requested')).toEqual([]);
      await pause(500);
      expect(mailsTo(email, REQUESTED_MAIL)).toEqual([]);
    });
  });

  describe('who cannot', () => {
    it('a non-admin gets the admin guard’s 404 on both routes, byte for byte — the account itself included — and nothing is written', async () => {
      const target = await withFactor('dora', 'Dora Vidal');
      // What the guard answers this cookie on a console route that has always existed.
      const guarded = await get('admin/accounts', ordinary.cookie);

      expect(guarded.status).toBe(404);

      const notFound = { status: guarded.status, text: guarded.text };

      for (const cookie of [ordinary.cookie, target.jar.header]) {
        const asked = await requestRemoval(target.id, cookie);

        expect({ status: asked.status, text: asked.text }).toEqual(notFound);
      }

      expect(await removalRows(target.id)).toEqual([]);

      // With a request waiting, neither may cancel it either.
      expect((await requestRemoval(target.id)).status).toBe(201);

      for (const cookie of [ordinary.cookie, target.jar.header, '']) {
        const cancelled = await cancelRemoval(target.id, cookie);

        expect(cancelled.status).toBe(404);

        if (cookie) {
          expect({ status: cancelled.status, text: cancelled.text }).toEqual(notFound);
        }
      }

      const noSession = await post(removal(target.id), '');

      expect(noSession.status).toBe(404);
      expect(await pending(target.id)).toBe(true);
      expect(await auditRows(target.id, 'auth.2fa_removal_requested')).toHaveLength(1);
      expect(await auditRows(target.id, 'auth.2fa_removal_cancelled')).toEqual([]);
    });
  });

  describe('carrying it out', () => {
    it('the cron before due_at removes nothing; past it, it removes the factor, forgets trusted devices, records and mails — once', async () => {
      const { id, email, uri } = await withFactor('elisa', 'Elisa Ferrer');
      // A device trusted to skip the code: it must not skip anything once the factor is back on later.
      const challenge = await challenged(email);
      const trusted = await verifyTotp(challenge.header, await clock.fresh(uri), true);

      expect(trusted.status).toBe(200);
      expect(await trustRows(id)).toBeGreaterThan(0);

      // Asked after the sign-in above, so the sign-in did not cancel it.
      expect((await requestRemoval(id)).status).toBe(201);

      const early = await cron();

      expect(early.status).toBe(200);
      expect(Object.keys(early.body as object).sort()).toEqual(['failed', 'removed']);
      expect(await flagOf(id)).toBe(true);
      expect(await twoFactorRows(id)).toBe(1);
      expect(await pending(id)).toBe(true);
      expect(await auditRows(id, 'auth.2fa_removed_by_owner')).toEqual([]);

      // An hour short of due is still not due.
      await sql()`update two_factor_removal set due_at = now() + interval '1 hour' where user_id = ${id}`;
      expect((await cron()).status).toBe(200);
      expect(await flagOf(id)).toBe(true);

      await due(id);

      const ran = await cron();

      expect(ran.status).toBe(200);
      expect((ran.body as { removed: number }).removed).toBeGreaterThanOrEqual(1);
      expect(await flagOf(id)).toBe(false);
      expect(await twoFactorRows(id)).toBe(0);
      expect(await trustRows(id)).toBe(0);
      // Carried out, the request is gone.
      expect(await removalRows(id)).toEqual([]);

      const rows = await auditRows(id, 'auth.2fa_removed_by_owner');

      expect(rows).toHaveLength(1);
      expectRow(rows[0], null, id, {});

      await until(() => mailsTo(email, REMOVED_MAIL).length > 0, 'The "removed" mail');
      expectQuietMail(mailsTo(email, REMOVED_MAIL)[0]);

      // Removed for good: the password alone signs in now.
      await signedIn(email);

      // Again, and again: nothing more removed, recorded or mailed.
      for (const again of [await cron(), await cron()]) {
        expect(again.status).toBe(200);
        expect(again.body).toEqual({ failed: 0, removed: 0 });
      }

      expect(await auditRows(id, 'auth.2fa_removed_by_owner')).toHaveLength(1);
      await pause(500);
      expect(mailsTo(email, REMOVED_MAIL)).toHaveLength(1);
      expect(await flagOf(id)).toBe(false);
    });

    it('the run takes only the due request: another account’s, not yet due, is left exactly as it was', async () => {
      const dueOne = await withFactor('fabio', 'Fabio Sanz');
      const waiting = await withFactor('gema', 'Gema Ruiz');

      expect((await requestRemoval(dueOne.id)).status).toBe(201);
      expect((await requestRemoval(waiting.id)).status).toBe(201);

      const before = await removalRows(waiting.id);

      await due(dueOne.id);
      expect((await cron()).status).toBe(200);
      expect(await flagOf(dueOne.id)).toBe(false);
      expect(await flagOf(waiting.id)).toBe(true);
      expect(await twoFactorRows(waiting.id)).toBe(1);
      expect(await removalRows(waiting.id)).toEqual(before);
      expect(await auditRows(waiting.id, 'auth.2fa_removed_by_owner')).toEqual([]);
    });

    it('an account that turned the factor off itself meanwhile: the request goes, with no row and no mail', async () => {
      const { id, email, jar } = await withFactor('mario', 'Mario Calvo');

      expect((await requestRemoval(id)).status).toBe(201);
      expect((await post('auth/two-factor/disable', jar.header, { password: ORIGINAL })).status).toBe(200);
      expect(await flagOf(id)).toBe(false);

      // And began turning it on again without confirming: a secret left, unverified, the flag still off.
      const restarted = await paced(() =>
        request(server()).post(`/${PREFIX}/auth/two-factor/enable`).set('Cookie', jar.header).set('User-Agent', IPHONE).send({ password: ORIGINAL })
      );

      expect(restarted.status).toBe(200);
      secrets.push(...(restarted.body as { backupCodes: string[] }).backupCodes, totpSecret((restarted.body as { totpURI: string }).totpURI).base32);
      expect(await twoFactorRows(id)).toBe(1);

      await due(id);

      const ran = await cron();

      expect(ran.status).toBe(200);
      // Not a removal: nothing was on to remove.
      expect(ran.body).toEqual({ failed: 0, removed: 0 });
      expect(await removalRows(id)).toEqual([]);
      expect(await twoFactorRows(id)).toBe(0);
      expect(await flagOf(id)).toBe(false);
      expect(await auditRows(id, 'auth.2fa_removed_by_owner')).toEqual([]);
      await pause(500);
      expect(mailsTo(email, REMOVED_MAIL)).toEqual([]);
    });

    it('the cron without its secret is a 404 and carries nothing out', async () => {
      const { id } = await withFactor('nico', 'Nico Ferro');

      expect((await requestRemoval(id)).status).toBe(201);
      await due(id);

      for (const authorization of ['', 'Bearer not-the-secret']) {
        const call = request(server()).get(`/${PREFIX}/cron/two-factor-removals`);

        expect((await (authorization ? call.set('Authorization', authorization) : call)).status).toBe(404);
      }

      expect(await flagOf(id)).toBe(true);
      expect(await pending(id)).toBe(true);
      expect(await auditRows(id, 'auth.2fa_removed_by_owner')).toEqual([]);
    });

    it('records each run as a cron_run with no user', async () => {
      const [since] = await sql()<{ now: string }>`select now()::text as now`;

      expect((await cron()).status).toBe(200);

      const runs = await sql()<{ properties: Record<string, unknown> | null; userId: string | null }>`
        select properties, user_id as "userId" from analytics_events
        where event = 'cron_run' and created_at >= ${since?.now ?? ''} and properties->>'job' = 'twoFactorRemovals'`;

      expect(runs.length).toBeGreaterThanOrEqual(1);

      for (const run of runs) {
        expect(run.userId).toBeNull();
        expect(Object.keys(run.properties ?? {}).sort()).toEqual(['failed', 'job', 'removed']);
      }
    });
  });

  describe('cancelling', () => {
    it('a right TOTP code typed by the account cancels it, records {by:"account"}, mails, and the cron then removes nothing', async () => {
      const { id, email, uri } = await withFactor('hugo', 'Hugo Prieto');

      expect((await requestRemoval(id)).status).toBe(201);

      // A wrong code is not the account proving it holds the factor: nothing is cancelled.
      const challenge = await challenged(email);
      const wrong = await verifyTotp(challenge.header, wrongCode(uri));

      expect(wrong.status).toBe(401);
      expect(await pending(id)).toBe(true);
      expect(await auditRows(id, 'auth.2fa_removal_cancelled')).toEqual([]);

      const verified = await verifyTotp(challenge.header, await clock.fresh(uri));

      expect(verified.status).toBe(200);
      expect(await pending(id)).toBe(false);

      const rows = await auditRows(id, 'auth.2fa_removal_cancelled');

      expect(rows).toHaveLength(1);
      expectRow(rows[0], id, id, { by: 'account' });

      await until(() => mailsTo(email, CANCELLED_MAIL).length > 0, 'The "removal cancelled" mail');
      expectQuietMail(mailsTo(email, CANCELLED_MAIL)[0]);

      // A cancelled request is never carried out, even with its date gone by.
      await due(id);
      expect((await cron()).status).toBe(200);
      expect(await flagOf(id)).toBe(true);
      expect(await twoFactorRows(id)).toBe(1);
      expect(await auditRows(id, 'auth.2fa_removed_by_owner')).toEqual([]);

      // The next sign-in with a code cancels nothing more.
      const next = await challenged(email);

      expect((await verifyTotp(next.header, await clock.fresh(uri))).status).toBe(200);
      expect(await auditRows(id, 'auth.2fa_removal_cancelled')).toHaveLength(1);

      // And a new request can be made after it.
      expect((await requestRemoval(id)).status).toBe(201);
    });

    it('a backup code typed by the account cancels it the same way', async () => {
      const { id, backupCodes, email } = await withFactor('ines', 'Inés Gil');

      expect((await requestRemoval(id)).status).toBe(201);

      const challenge = await challenged(email);
      const used = await post('auth/two-factor/verify-backup-code', challenge.header, { code: backupCodes[0] ?? '' });

      expect(used.status).toBe(200);
      expect(await pending(id)).toBe(false);

      const rows = await auditRows(id, 'auth.2fa_removal_cancelled');

      expect(rows).toHaveLength(1);
      expectRow(rows[0], id, id, { by: 'account' });
      await until(() => mailsTo(email, CANCELLED_MAIL).length > 0, 'The "removal cancelled" mail');

      await due(id);
      expect((await cron()).status).toBe(200);
      expect(await flagOf(id)).toBe(true);
    });

    it('a right code typed while signed in (not at sign-in) cancels it too', async () => {
      const { id, jar, uri } = await withFactor('julio', 'Julio Pons');

      expect((await requestRemoval(id)).status).toBe(201);
      expect((await verifyTotp(jar.header, await clock.fresh(uri))).status).toBe(200);
      expect(await pending(id)).toBe(false);
      expectRow((await auditRows(id, 'auth.2fa_removal_cancelled'))[0], id, id, { by: 'account' });
    });

    it('the owner cancels with 204 and {by:"owner"}; a second cancel is a 404; the cron then removes nothing', async () => {
      const { id } = await withFactor('karen', 'Karen Soto');

      expect((await requestRemoval(id)).status).toBe(201);

      const cancelled = await cancelRemoval(id);

      expect(cancelled.status).toBe(204);
      expect(await pending(id)).toBe(false);

      const rows = await auditRows(id, 'auth.2fa_removal_cancelled');

      expect(rows).toHaveLength(1);
      expectRow(rows[0], owner.id, id, { by: 'owner' });

      const again = await cancelRemoval(id);

      expect(again.status).toBe(404);
      expect(await auditRows(id, 'auth.2fa_removal_cancelled')).toHaveLength(1);

      await due(id);
      expect((await cron()).status).toBe(200);
      expect(await flagOf(id)).toBe(true);
      expect(await auditRows(id, 'auth.2fa_removed_by_owner')).toEqual([]);
    });

    it('cancelling with nothing ever asked is a 404 and writes nothing', async () => {
      const { id } = await withFactor('lara', 'Lara Bravo');

      expect((await cancelRemoval(id)).status).toBe(404);
      expect(await auditRows(id, 'auth.2fa_removal_cancelled')).toEqual([]);
    });
  });

  describe('leaving no trace', () => {
    it('no secret, backup code or TOTP value in a response, an audit row or a mail; metadata only as declared', async () => {
      expect(secrets.length).toBeGreaterThan(0);

      const rows = await sql()<AuditRow & { action: string }>`
        select action, actor_id as "actorId", entity, entity_id as "entityId", ip_hash as "ipHash", metadata, subject_user_id as "subjectUserId"
        from audit_logs
        where created_at >= ${started}
          and action in ('auth.2fa_removal_requested', 'auth.2fa_removal_cancelled', 'auth.2fa_removed_by_owner')`;

      expect(rows.length).toBeGreaterThanOrEqual(10);

      for (const row of rows) {
        expect(row.ipHash).toBeNull();
        expect(row.entityId).toBeNull();
        expect(Object.keys(row.metadata ?? {})).toEqual(row.action === 'auth.2fa_removal_cancelled' ? ['by'] : []);
      }

      const structured = rows.map(row => JSON.stringify(row.metadata ?? {}));

      for (const said of [...structured, ...bodies, ...outbox.map(words)]) {
        for (const secret of secrets) {
          expect(said).not.toContain(secret);
        }
      }
    });
  });
});
