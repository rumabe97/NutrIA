import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { SettingsController } from 'core/controllers/Settings';
import { UserController } from 'core/controllers/User';

import { createApp, httpServer, PREFIX, ScriptedAiClient } from './harness.js';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * Arriving through a provider (`0058`), asserted on the real tables.
 *
 * Google is never called. The one request this service makes to it — trading
 * the code for tokens — is answered here with an identity the test chose, which
 * is the only part of the exchange this service decides anything about. What
 * is proved is everything after it: that an account born confirmed passes the
 * first lock and meets the second like everybody else, and above all that an
 * address nobody confirmed is never joined to whoever arrives with it.
 *
 * Requires a real database — see ./README.md.
 */
const PASSWORD = 'correct-horse-battery-staple-9';
const GOOGLE = { clientId: 'nutria-e2e.apps.googleusercontent.com', clientSecret: 'not-a-real-secret' };
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const APP = 'http://localhost:3000';

type Identity = { readonly email: string; readonly emailVerified: boolean; readonly name: string; readonly sub: string };

function part(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Shaped like Google's, signed by nobody: the callback reads the claims of a token it fetched itself over TLS. */
function idToken(identity: Identity): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: GOOGLE.clientId,
    email: identity.email,
    email_verified: identity.emailVerified,
    exp: now + 3600,
    iat: now,
    iss: 'https://accounts.google.com',
    name: identity.name,
    sub: identity.sub
  };

  return `${part({ alg: 'RS256', typ: 'JWT' })}.${part(claims)}.unsigned`;
}

describe('social sign-in: arriving through a provider', () => {
  let app: INestApplication;
  let arriving: Identity;
  const realFetch = globalThis.fetch;
  const sessions: string[] = [];
  const stamp = Date.now();

  function cookiesOf(response: Response): string {
    return ((response.headers['set-cookie'] as unknown as string[] | undefined) ?? []).map(cookie => cookie.split(';')[0]).join('; ');
  }

  /** The whole round trip: ask for Google's address, come back from it as `identity`. */
  async function arriveThroughGoogle(identity: Identity): Promise<{ readonly cookie: string; readonly location: string }> {
    const server = httpServer(app);

    arriving = identity;

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
    const cookie = cookiesOf(back);

    if (cookie.includes('session_token')) {
      sessions.push(cookie);
    }

    return { cookie, location: String(back.headers.location) };
  }

  async function me(cookie: string): Promise<{ id: string; activated: boolean; email: string; emailVerified: boolean }> {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/users/me`).set('Cookie', cookie).expect(200);

    return response.body as { id: string; activated: boolean; email: string; emailVerified: boolean };
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
          id_token: idToken(arriving),
          scope: 'openid email profile',
          token_type: 'Bearer'
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 }
      );
    }) as typeof fetch;

    app = await createApp(new ScriptedAiClient([]));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    // These accounts are this suite's own, and it may be pointed at a database
    // that outlives it.
    for (const cookie of sessions) {
      await request(httpServer(app)).delete(`/${PREFIX}/users/me`).set('Cookie', cookie);
    }

    globalThis.fetch = realFetch;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    await app?.close();
  });

  it('tells anybody, signed in or not, which providers this deployment can honour', async () => {
    const answer: Response = await request(httpServer(app)).get(`/${PREFIX}/settings/sign-in-providers`).expect(200);

    expect(answer.body).toEqual({ providers: ['google'] });
  });

  it('sends somebody to Google with this deployment’s own callback, asking for an identity and nothing else', async () => {
    const start: Response = await request(httpServer(app))
      .post(`/${PREFIX}/auth/sign-in/social`)
      .send({ callbackURL: `${APP}/inicio`, provider: 'google' })
      .expect(200);
    const url = new URL((start.body as { url: string }).url);

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe(GOOGLE.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(`${process.env.BETTER_AUTH_URL}/${PREFIX}/auth/callback/google`);
    expect((url.searchParams.get('scope') ?? '').split(' ').sort()).toEqual(['email', 'openid', 'profile']);
    expect(url.searchParams.get('access_type')).not.toBe('offline');
  });

  it('has no Apple to offer while Apple has no credentials', async () => {
    await request(httpServer(app))
      .post(`/${PREFIX}/auth/sign-in/social`)
      .send({ callbackURL: `${APP}/inicio`, provider: 'apple' })
      .expect(404);
  });

  it('opens an account born through Google by itself when the door is open — no verification link will ever come', async () => {
    jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(true);

    const email = `social-open-${stamp}@e2e.invalid`;
    const { cookie, location } = await arriveThroughGoogle({ email, emailVerified: true, name: 'Ada', sub: `g-open-${stamp}` });

    expect(location).toBe(`${APP}/inicio`);
    await expect(me(cookie)).resolves.toMatchObject({ activated: true, email, emailVerified: true });
  });

  it('leaves it confirmed and waiting for the owner when the door is shut', async () => {
    jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(false);

    const email = `social-shut-${stamp}@e2e.invalid`;
    const { cookie } = await arriveThroughGoogle({ email, emailVerified: true, name: 'Grace', sub: `g-shut-${stamp}` });

    await expect(me(cookie)).resolves.toMatchObject({ activated: false, emailVerified: true });
  });

  it('is the same person the second time, not a second account', async () => {
    jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(true);

    const identity = { email: `social-twice-${stamp}@e2e.invalid`, emailVerified: true, name: 'Edsger', sub: `g-twice-${stamp}` };
    const first = await me((await arriveThroughGoogle(identity)).cookie);
    const second = await me((await arriveThroughGoogle(identity)).cookie);

    expect(second.id).toBe(first.id);
  });

  it('joins a password account that confirmed its address: same address, same person', async () => {
    const email = `social-link-${stamp}@e2e.invalid`;
    const server = httpServer(app);

    await request(server).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Barbara', password: PASSWORD }).expect(200);
    await UserController.confirmAddress(email);
    await UserController.activate({ email });

    const signIn: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: PASSWORD }).expect(200);
    const byPassword = await me(cookiesOf(signIn));
    const byGoogle = await me((await arriveThroughGoogle({ email, emailVerified: true, name: 'Barbara', sub: `g-link-${stamp}` })).cookie);

    expect(byGoogle.id).toBe(byPassword.id);
  });

  it('never joins an account nobody confirmed — whoever signed up with that address chose its password', async () => {
    jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(true);

    const email = `social-squat-${stamp}@e2e.invalid`;
    const server = httpServer(app);

    // Somebody signs up with an address and never proves it is theirs…
    await request(server).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Mallory', password: PASSWORD }).expect(200);

    // …and the address's real owner arrives through Google.
    const { cookie, location } = await arriveThroughGoogle({ email, emailVerified: true, name: 'Victim', sub: `g-squat-${stamp}` });

    expect(new URL(location).origin + new URL(location).pathname).toBe(`${APP}/acceder`);
    expect(new URL(location).searchParams.get('error')).toBe('account_not_linked');
    expect(cookie).not.toContain('session_token');

    // The account is exactly as it was: unconfirmed, unopened, and holding nothing of theirs.
    const signIn: Response = await request(server).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password: PASSWORD }).expect(200);
    const squatter = cookiesOf(signIn);

    sessions.push(squatter);
    await expect(me(squatter)).resolves.toMatchObject({ activated: false, emailVerified: false });
  });

  it('does not confirm an address the provider would not vouch for', async () => {
    const automatic = jest.spyOn(SettingsController, 'automaticActivation').mockResolvedValue(true);
    const email = `social-unvouched-${stamp}@e2e.invalid`;
    const { cookie } = await arriveThroughGoogle({ email, emailVerified: false, name: 'Niklaus', sub: `g-unvouched-${stamp}` });

    await expect(me(cookie)).resolves.toMatchObject({ activated: false, emailVerified: false });
    expect(automatic).not.toHaveBeenCalled();
  });
});
