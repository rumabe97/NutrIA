import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { UserController } from 'core/controllers/User';
import { signInBrakeKey } from 'core/domain/SignInBrake';
import { database } from 'database';

import { createApp, deleteAccountByEmail, httpServer, paced, PREFIX, ScriptedAiClient } from './harness.js';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The per-address brake on password sign-in (PLAN 011 phase 7, PRD 011
 * criterion 12), against the real database: after ten failures in fifteen
 * minutes for one address the next sign-in is answered 429 with
 * `Retry-After`, before the password is checked; the right password gets in
 * once the wait is over; an address with no account is braked exactly like
 * one with an account; and the table holds an HMAC, never an address.
 *
 * Then the daily `/cron/sweep-verifications`, which deletes the brake's quiet
 * rows and the `auth.*` audit rows older than twelve months — and no other
 * action's row, whatever its age.
 *
 * Requires a real database — see ./README.md.
 */
type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

const PASSWORD = 'correct-horse-battery-staple-9';
const WRONG = 'not-the-password-at-all-9';

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

function hasSession(response: Response): boolean {
  return ((response.headers['set-cookie'] as unknown as string[] | undefined) ?? []).some(line => /session_token=[^;]/.test(line));
}

async function pause(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

describe('a brake per address on password sign-in', () => {
  let app: INestApplication;
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const known = `brake-known-${stamp}@e2e.invalid`;
  const unknown = `brake-unknown-${stamp}@e2e.invalid`;
  const cronSecret = randomBytes(24).toString('hex');
  const previousCronSecret = process.env['CRON_SECRET'];
  const keyOf = (email: string) => signInBrakeKey(email, process.env['BETTER_AUTH_SECRET'] ?? '');
  const auditIds: string[] = [];
  const brakeKeys: string[] = [];

  const server = () => httpServer(app);
  const signIn = async (email: string, password: string) =>
    paced(() => request(server()).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password }));

  async function fail(email: string, n: number): Promise<void> {
    for (let i = 0; i < n; i += 1) {
      expect((await signIn(email, WRONG)).status).toBe(401);
    }
  }

  async function brakeRow(email: string): Promise<{ count: number; next_allowed_at: Date | null } | undefined> {
    const [row] = await sql()<{ count: number; next_allowed_at: Date | null }>`
      select count, next_allowed_at from sign_in_failure where key = ${keyOf(email)}`;

    return row;
  }

  beforeAll(async () => {
    process.env['CRON_SECRET'] = cronSecret;
    app = await createApp(new ScriptedAiClient([]));

    await paced(() => request(server()).post(`/${PREFIX}/auth/sign-up/email`).send({ email: known, name: 'Brake', password: PASSWORD }));
    // Confirmed, as its link would: an unconfirmed account's right password is a wrong one (PLAN 011 phase 8).
    await UserController.confirmAddress(known);
  });

  afterAll(async () => {
    await sql()`delete from sign_in_failure where key = any(${[keyOf(known), keyOf(unknown), ...brakeKeys]})`;

    if (auditIds.length > 0) {
      await sql()`delete from audit_logs where id = any(${auditIds})`;
    }

    await deleteAccountByEmail(app, known);

    if (previousCronSecret === undefined) {
      delete process.env['CRON_SECRET'];
    } else {
      process.env['CRON_SECRET'] = previousCronSecret;
    }

    await app?.close();
  });

  let knownBraked: Response;

  /*
   * The attempts are counted under the row's lock before the password is
   * checked, so a burst from many clients cannot all read the count before any
   * writes it: exactly ten run, the rest wait. Each carries its own
   * `X-Forwarded-For`, which Better Auth's per-IP limit reads, as from many IPs.
   */
  it('lets exactly ten of thirty simultaneous wrong passwords through, however many IPs they come from', async () => {
    const burst = `brake-burst-${stamp}@e2e.invalid`;

    brakeKeys.push(keyOf(burst));

    const answers = await Promise.all(
      Array.from({ length: 30 }, async (_, i) =>
        paced(() =>
          request(server())
            .post(`/${PREFIX}/auth/sign-in/email`)
            .set('X-Forwarded-For', `203.0.113.${i + 1}`)
            .send({ email: burst, password: WRONG })
        )
      )
    );
    const statuses = answers.map(answer => answer.status);

    expect(statuses.filter(status => status === 401)).toHaveLength(10);
    expect(statuses.filter(status => status === 429)).toHaveLength(20);
    expect(await brakeRow(burst)).toMatchObject({ count: 10 });
  });

  it('answers 429 with Retry-After after ten failures for an address with an account, even to the right password', async () => {
    await fail(known, 10);

    knownBraked = await signIn(known, PASSWORD);

    expect(knownBraked.status).toBe(429);
    expect(knownBraked.body).toEqual({ code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Try again later.' });
    expect(Number(knownBraked.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(knownBraked.headers['retry-after'])).toBeLessThanOrEqual(30);
    expect(hasSession(knownBraked)).toBe(false);
    expect(await brakeRow(known)).toMatchObject({ count: 10 });
  });

  it('brakes an address with no account the same way: same status, same body, same headers', async () => {
    await fail(unknown, 10);

    const braked = await signIn(unknown, WRONG);

    expect(braked.status).toBe(429);
    expect(braked.body).toEqual(knownBraked.body);
    expect(Object.keys(braked.headers).sort()).toEqual(Object.keys(knownBraked.headers).sort());
    expect(Number(braked.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(braked.headers['retry-after'])).toBeLessThanOrEqual(30);
    expect(await brakeRow(unknown)).toMatchObject({ count: 10 });
  });

  it('keeps no address: four columns, a 64-hex key, and nothing of either address in any row', async () => {
    const columns = await sql()<{ column_name: string }>`
      select column_name from information_schema.columns where table_name = 'sign_in_failure' order by column_name`;
    const rows = await sql()<Record<string, unknown>>`select * from sign_in_failure`;

    expect(columns.map(column => column.column_name)).toEqual(['count', 'key', 'next_allowed_at', 'window_started_at']);

    for (const row of rows) {
      expect(row['key']).toMatch(/^[0-9a-f]{64}$/);
    }

    const dump = JSON.stringify(rows);

    expect(dump).not.toContain('brake-known');
    expect(dump).not.toContain('brake-unknown');
    expect(dump).not.toContain('e2e.invalid');
  });

  it('lets the right password in once the wait is over, and forgets the address', async () => {
    const row = await brakeRow(known);
    const waitMs = (row?.next_allowed_at ? new Date(row.next_allowed_at).getTime() : Date.now()) - Date.now();

    await pause(Math.max(0, waitMs) + 250);

    const signedIn = await signIn(known, PASSWORD);

    expect(signedIn.status).toBe(200);
    expect(hasSession(signedIn)).toBe(true);
    expect(await brakeRow(known)).toBeUndefined();
  });

  it('the daily sweep deletes quiet brake rows and auth rows past twelve months, and no other row', async () => {
    const thirteenMonths = new Date();
    thirteenMonths.setUTCMonth(thirteenMonths.getUTCMonth() - 13);
    const elevenMonths = new Date();
    elevenMonths.setUTCMonth(elevenMonths.getUTCMonth() - 11);
    const twoDays = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const quietKey = keyOf(`brake-quiet-${stamp}@e2e.invalid`);
    const waitingKey = keyOf(`brake-waiting-${stamp}@e2e.invalid`);

    brakeKeys.push(quietKey, waitingKey);
    await sql()`insert into sign_in_failure (key, count, window_started_at, next_allowed_at)
      values (${quietKey}, 3, ${twoDays.toISOString()}, null),
             (${waitingKey}, 40, ${twoDays.toISOString()}, ${new Date(Date.now() + 60_000).toISOString()})`;

    const inserted = await sql()<{ id: string }>`
      insert into audit_logs (action, entity, metadata, created_at, updated_at)
      values ('auth.password_changed', 'user', '{"via":"change"}', ${thirteenMonths.toISOString()}, ${thirteenMonths.toISOString()}),
             ('auth.passkey_added', 'user', '{}', ${elevenMonths.toISOString()}, ${elevenMonths.toISOString()}),
             ('account.activated', 'user', '{"via":"console"}', ${thirteenMonths.toISOString()}, ${thirteenMonths.toISOString()}),
             ('setting.changed', 'setting', '{"enabled":true,"key":"e2e"}', ${thirteenMonths.toISOString()}, ${thirteenMonths.toISOString()})
      returning id`;

    auditIds.push(...inserted.map(row => row.id));

    const swept: Response = await request(server())
      .get(`/${PREFIX}/cron/sweep-verifications`)
      .set('Authorization', `Bearer ${cronSecret}`)
      .expect(200);
    const body = swept.body as { authAuditRows: number; deleted: number; signInFailures: number };

    expect(body.authAuditRows).toBeGreaterThanOrEqual(1);
    expect(body.signInFailures).toBeGreaterThanOrEqual(1);

    const left = await sql()<{ action: string }>`select action from audit_logs where id = any(${auditIds}) order by action`;

    expect(left.map(row => row.action)).toEqual(['account.activated', 'auth.passkey_added', 'setting.changed']);

    const keys = await sql()<{ key: string }>`select key from sign_in_failure where key = any(${[quietKey, waitingKey]})`;

    expect(keys.map(row => row.key)).toEqual([waitingKey]);
  });
});
