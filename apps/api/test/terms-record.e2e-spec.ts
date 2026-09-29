import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { TERMS_VERSION } from 'core/entities/User';
import { database } from 'database';

import { createApp, deleteAccountByEmail, deleteAccounts, httpServer, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The terms an account was created under (`0071`, project 008 phase 7), asserted
 * on the real `user` table.
 *
 * Every way to an account records `/condiciones`' version and the instant, in
 * the same insert that creates it; no client can write either — not at
 * sign-up, not afterwards. Google is never called: its token exchange is
 * answered here, as `social-sign-in.e2e-spec.ts` does.
 *
 * Requires a real database — see ./README.md.
 */
const PASSWORD = 'correct-horse-battery-staple-9';
const GOOGLE = { clientId: 'nutria-e2e.apps.googleusercontent.com', clientSecret: 'not-a-real-secret' };
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const APP = 'http://localhost:3000';

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;
type TermsRow = { readonly id: string; readonly at: Date | null; readonly version: string | null };

function part(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function idToken(email: string, sub: string): string {
  const now = Math.floor(Date.now() / 1000);

  return `${part({ alg: 'RS256', typ: 'JWT' })}.${part({
    aud: GOOGLE.clientId,
    email,
    email_verified: true,
    exp: now + 3600,
    iat: now,
    iss: 'https://accounts.google.com',
    name: 'Terms Google',
    sub
  })}.unsigned`;
}

describe('the terms an account was created under', () => {
  let app: INestApplication;
  let arrivingEmail = '';
  let arrivingSub = '';
  const realFetch = globalThis.fetch;
  const stamp = Date.now();
  const sessions: string[] = [];
  const byEmail: string[] = [];
  const sql = (): Sql => (database() as unknown as { readonly $client: Sql }).$client;

  async function termsOf(email: string): Promise<TermsRow | undefined> {
    const rows = await sql()<TermsRow>`select id, terms_version as version, terms_accepted_at as at from "user" where email = ${email}`;

    return rows[0];
  }

  function cookiesOf(response: Response): string {
    return ((response.headers['set-cookie'] as unknown as string[] | undefined) ?? []).map(cookie => cookie.split(';')[0]).join('; ');
  }

  beforeAll(async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = GOOGLE.clientId;
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = GOOGLE.clientSecret;

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (!url.startsWith(TOKEN_ENDPOINT)) {
        return realFetch(input, init);
      }

      return new Response(
        JSON.stringify({
          access_token: 'e2e-access',
          expires_in: 3600,
          id_token: idToken(arrivingEmail, arrivingSub),
          scope: 'openid email profile',
          token_type: 'Bearer'
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 }
      );
    }) as typeof fetch;

    app = await createApp(new ScriptedAiClient([]));
  });

  afterAll(async () => {
    await deleteAccounts(app, sessions);

    for (const email of byEmail) {
      await deleteAccountByEmail(app, email);
    }

    globalThis.fetch = realFetch;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    await app?.close();
  });

  it('records the version and the moment on an email sign-up', async () => {
    const email = `terms-email-${stamp}@e2e.invalid`;
    const before = Date.now();

    byEmail.push(email);
    await request(httpServer(app)).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Terms', password: PASSWORD }).expect(200);

    const row = await termsOf(email);

    expect(TERMS_VERSION).toBe('2.0.0');
    expect(row?.version).toBe(TERMS_VERSION);
    expect(row?.at).not.toBeNull();
    // The database's clock and this one may differ a little; a minute is "now" and nothing else is.
    expect(Math.abs(new Date(row?.at as Date).getTime() - before)).toBeLessThan(60_000);
  });

  it('records the same on an account that arrives through Google', async () => {
    arrivingEmail = `terms-google-${stamp}@e2e.invalid`;
    arrivingSub = `terms-google-sub-${stamp}`;
    byEmail.push(arrivingEmail);

    const before = Date.now();
    const server = httpServer(app);
    const start: Response = await request(server)
      .post(`/${PREFIX}/auth/sign-in/social`)
      .send({ callbackURL: `${APP}/inicio`, errorCallbackURL: `${APP}/acceder`, provider: 'google' })
      .expect(200);
    const state = new URL((start.body as { url: string }).url).searchParams.get('state') ?? '';
    const back: Response = await request(server)
      .get(`/${PREFIX}/auth/callback/google`)
      .query({ code: 'e2e-code', state })
      .set('Cookie', cookiesOf(start))
      .expect(302);

    if (cookiesOf(back).includes('session_token')) {
      sessions.push(cookiesOf(back));
    }

    const row = await termsOf(arrivingEmail);

    expect(row).toBeDefined();
    expect(row?.version).toBe(TERMS_VERSION);
    expect(row?.at).not.toBeNull();
    expect(Math.abs(new Date(row?.at as Date).getTime() - before)).toBeLessThan(60_000);
  });

  it('refuses a sign-up that carries its own terms, and makes no account', async () => {
    const server = httpServer(app);
    const bodies: { readonly field: string; readonly value: string }[] = [
      { field: 'termsVersion', value: '9.9.9' },
      { field: 'termsAcceptedAt', value: '2001-01-01T00:00:00.000Z' }
    ];

    for (const { field, value } of bodies) {
      const email = `terms-forged-${field.toLowerCase()}-${stamp}@e2e.invalid`;

      byEmail.push(email);

      const answer: Response = await request(server)
        .post(`/${PREFIX}/auth/sign-up/email`)
        .send({ email, [field]: value, name: 'Forged', password: PASSWORD });

      expect(answer.status).toBe(400);
      expect(await termsOf(email)).toBeUndefined();
    }
  });

  it('cannot be rewritten by the account afterwards', async () => {
    const account = await register(app, `terms-update-${stamp}@e2e.invalid`);

    sessions.push(account.cookie);

    const original = await termsOf(account.email);

    expect(original?.version).toBe(TERMS_VERSION);

    // The control: the same route, with a legitimate field, is live — so the refusals below are about the terms.
    await request(httpServer(app)).post(`/${PREFIX}/auth/update-user`).set('Cookie', account.cookie).send({ name: 'Renamed once' }).expect(200);
    expect(await termsOf(account.email)).toEqual(original);

    const smuggled = { termsAcceptedAt: '2001-01-01T00:00:00Z', termsVersion: '9.9.9' };
    const server = httpServer(app);

    // Better Auth's own route for an account's update; there is no PATCH /users/me.
    await request(server).patch(`/${PREFIX}/users/me`).set('Cookie', account.cookie).send(smuggled).expect(404);

    const forged: Response = await request(server)
      .post(`/${PREFIX}/auth/update-user`)
      .set('Cookie', account.cookie)
      .send({ name: 'Still the same', ...smuggled });

    expect(forged.status).toBe(400);
    expect(await termsOf(account.email)).toEqual(original);

    // A client trying to blank the record is refused or ignored, never obeyed.
    for (const empty of [null, '']) {
      const answer: Response = await request(server)
        .post(`/${PREFIX}/auth/update-user`)
        .set('Cookie', account.cookie)
        .send({ name: 'Still the same', termsAcceptedAt: empty, termsVersion: empty });

      expect([200, 400]).toContain(answer.status);
      expect(await termsOf(account.email)).toEqual(original);
    }

    for (const patch of [{ termsVersion: '9.9.9' }, { termsAcceptedAt: '2001-01-01T00:00:00.000Z' }]) {
      const answer: Response = await request(server).post(`/${PREFIX}/auth/update-user`).set('Cookie', account.cookie).send(patch);

      expect([200, 400]).toContain(answer.status);
      expect(await termsOf(account.email)).toEqual(original);
    }
  });
});
