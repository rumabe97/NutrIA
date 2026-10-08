import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { database } from 'database';

import { createApp, deleteAccountByEmail, httpServer, paced, PREFIX, ScriptedAiClient } from './harness.js';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * Opening the confirmation link signs nobody in (hotfix found by the PLAN 011
 * phase 8 invariant review), on the product's own assembly and Better Auth's
 * real `/verify-email`.
 *
 * The attack it shuts, played through: a stranger signs the victim's address
 * up with a password of their own; the victim opens the link from another
 * client. The victim gets no session — the link lands on `/verificar-email`,
 * "confirmed, now sign in" — and the stranger, now able to sign in with
 * their password, does. The victim, not knowing the password, resets it: every session
 * the stranger had is gone, the stranger's password is refused, and only the
 * victim's new one gets in. So nothing the victim enters from then on is
 * reachable by the stranger.
 *
 * With no SMTP configured and `NODE_ENV=test`, `VerificationMail.ts` logs the
 * link instead of mailing it; the suite reads it off `console.info`, as
 * `audit.e2e-spec.ts` does. The reset token is read from `verification`, as
 * `passkeys.e2e-spec.ts` does.
 */
type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

const STRANGERS_PASSWORD = 'correct-horse-battery-staple-9';
const VICTIMS_PASSWORD = 'amber-lantern-quietly-walks-7';

describe('verify-email: the confirmation link signs nobody in', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const email = `verify-victim-${stamp}@e2e.invalid`;
  const sql = (): Sql => (database() as unknown as { readonly $client: Sql }).$client;

  const post = async (path: string, body: object, cookie?: string): Promise<Response> =>
    paced(() => {
      const call = request(httpServer(app)).post(`/${PREFIX}/${path}`).send(body);

      return cookie === undefined ? call : call.set('Cookie', cookie);
    });
  const me = async (cookie: string): Promise<number> => (await request(httpServer(app)).get(`/${PREFIX}/users/me`).set('Cookie', cookie)).status;
  const cookieOf = (response: Response): string => ((response.headers['set-cookie'] as unknown as string[] | undefined) ?? []).join('; ');

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient([]));
  });

  afterAll(async () => {
    // Whichever password the account ended with: the victim's after a passing run, the stranger's after a failing one.
    await deleteAccountByEmail(app, email, VICTIMS_PASSWORD);
    await deleteAccountByEmail(app, email, STRANGERS_PASSWORD);
    await app.close();
  });

  it('confirms the address with no session, lands on the confirmation page, and the reset ends the stranger’s sessions', async () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    let link: URL;
    let id: string;

    try {
      const signedUp = await post('auth/sign-up/email', { email, name: 'Nadie', password: STRANGERS_PASSWORD });

      expect(signedUp.status).toBe(200);
      // Sign-up gives no session, and the password is refused until the address is confirmed.
      expect(await me(cookieOf(signedUp))).toBe(404);
      expect((await post('auth/sign-in/email', { email, password: STRANGERS_PASSWORD })).status).toBe(401);

      const [row] = await sql()<{ id: string }>`select id from "user" where email = ${email}`;

      id = row?.id ?? '';

      const logged = () => spy.mock.calls.find(call => typeof call[0] === 'string' && call[0].includes(`verification url for ${id}:`));
      // The mail goes in the background, so the line may land after sign-up answered.
      const deadline = Date.now() + 5_000;

      while (!logged() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const line = logged();

      if (!line) {
        throw new Error('No verification url was logged for the new account within 5 s');
      }

      link = new URL(String(line[0]).split(': ').slice(1).join(': ').trim());
    } finally {
      spy.mockRestore();
    }

    // The owner of the mailbox opens it, from another client: no cookie of any kind.
    const opened: Response = await request(httpServer(app)).get(`${link.pathname}${link.search}`);

    expect(opened.status).toBe(302);
    expect(new URL(String(opened.headers.location)).pathname).toBe('/verificar-email');
    expect(cookieOf(opened)).not.toMatch(/session_token=[^;]/);

    const [confirmed] = await sql()<{ emailVerified: boolean }>`select email_verified as "emailVerified" from "user" where id = ${id}`;

    expect(confirmed?.emailVerified).toBe(true);
    // No session was made for anybody by opening it.
    await expect(sql()<{ n: number }>`select count(*)::int as n from session where user_id = ${id}`).resolves.toEqual([{ n: 0 }]);

    // Confirmed, the stranger can sign in with their password; confirming ended nothing, the reset does.
    const strangerIn = await post('auth/sign-in/email', { email, password: STRANGERS_PASSWORD });

    expect(strangerIn.status).toBe(200);
    const stranger = cookieOf(strangerIn);
    expect(await me(stranger)).toBe(200);
    await expect(sql()<{ n: number }>`select count(*)::int as n from session where user_id = ${id}`).resolves.toEqual([{ n: 1 }]);

    // A refused link lands on the same page, saying so.
    const forged: Response = await request(httpServer(app)).get(
      `${link.pathname}?token=not-a-token&callbackURL=${encodeURIComponent(String(link.searchParams.get('callbackURL')))}`
    );

    expect(forged.status).toBe(302);
    expect(new URL(String(forged.headers.location)).searchParams.get('error')).toBe('INVALID_TOKEN');
    expect(cookieOf(forged)).not.toMatch(/session_token=[^;]/);

    // The password is not the victim's, so they reset it.
    expect((await post('auth/request-password-reset', { email, redirectTo: '/restablecer' })).status).toBe(200);

    const [reset] = await sql()<{ identifier: string }>`
      select identifier from verification where value = ${id} and identifier like 'reset-password:%' order by created_at desc limit 1`;
    const token = reset?.identifier.slice('reset-password:'.length) ?? '';

    expect((await post('auth/reset-password', { newPassword: VICTIMS_PASSWORD, token })).status).toBe(200);

    // The stranger is out, and stays out.
    expect(await me(stranger)).toBe(404);
    expect((await post('auth/sign-in/email', { email, password: STRANGERS_PASSWORD })).status).toBe(401);

    const back = await post('auth/sign-in/email', { email, password: VICTIMS_PASSWORD });

    expect(back.status).toBe(200);
    expect(await me(cookieOf(back))).toBe(200);
    await expect(sql()<{ n: number }>`select count(*)::int as n from session where user_id = ${id}`).resolves.toEqual([{ n: 1 }]);
  });
});
