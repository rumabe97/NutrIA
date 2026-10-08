import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { hashPassword } from 'better-auth/crypto';

import { UserController } from 'core/controllers/User';
import { database } from 'database';

import { createApp, deleteAccountByEmail, httpServer, PREFIX, ScriptedAiClient } from './harness.js';
import { hibpAttempts, hibpTripwireInstalled } from './hibp-tripwire.js';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * Which new passwords the three doors refuse (project 011, phase 1; design
 * 0007 § 4.1): sign-up, reset and change.
 *
 * Twelve characters at least and 128 at most, counted the way Better Auth
 * counts, and refused with Better Auth's own codes. Past the length, a password
 * that carries the account's own address, a word of its name or the product's
 * name is refused with one code for all three — the answer never says which
 * word it found. Sign-in is not a door: a password set before the rule still
 * opens the account.
 *
 * The breached-password refusal is not here. Under `NODE_ENV=test` the API
 * never asks Have I Been Pwned, and `hibp-tripwire.ts` makes that checkable:
 * every request to HIBP's host is refused and counted before it leaves, and
 * this suite ends by asserting that none was attempted. That refusal is
 * proved by the unit tests beside the hook.
 *
 * Requires a real database — see ./README.md.
 */
const CLEAN_TWELVE = 'zq7-mbl-x4pw';
const ELEVEN = 'zq7-mbl-x4p';
/** Used only to delete what is left: written straight into an account's credential, then signed in with. */
const CLEANUP_PASSWORD = 'quiet-orchard-lamp-velvet-3';

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;
type Refusal = { readonly code?: string; readonly message?: string };

/** Lowercase, accents gone: how the rule itself compares, so "the body names no word" is read the same way. */
function plain(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function cookiesOf(response: Response): string {
  return ((response.headers['set-cookie'] as unknown as string[] | undefined) ?? []).map(cookie => cookie.split(';')[0]).join('; ');
}

describe('passwords: the length, and nothing of the account in it', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const sql = (): Sql => (database() as unknown as { readonly $client: Sql }).$client;
  /** Every password this suite sent, so the end can assert none of them was written anywhere. */
  const sent: string[] = [];
  const logged: string[] = [];
  const restoreLogs: (() => void)[] = [];
  let started = '';

  const server = () => httpServer(app);
  const emailFor = (label: string) => `passwords-${label}-${stamp}@e2e.invalid`;

  function signUp(email: string, name: string, password: string) {
    sent.push(password);

    return request(server()).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name, password });
  }

  /** A password sign-in, the address confirmed first as its link would: an unconfirmed account cannot sign in (PLAN 011 phase 8). */
  async function signIn(email: string, password: string, status: number): Promise<Response> {
    await UserController.confirmAddress(email);

    return request(server()).post(`/${PREFIX}/auth/sign-in/email`).send({ email, password }).expect(status);
  }

  async function accountsWith(email: string): Promise<number> {
    const [row] = await sql()<{ n: number }>`select count(*)::int as n from "user" where email = ${email}`;

    return row?.n ?? 0;
  }

  /** A refusal of ours: the code, a message, and none of what the person typed or which word matched. */
  function expectRefusal(response: Response, code: string, unsaid: readonly string[]): Refusal {
    const body = response.body as Refusal;
    const said = plain(JSON.stringify(body));

    expect(response.status).toBe(400);
    expect(body.code).toBe(code);
    expect(typeof body.message).toBe('string');

    for (const word of unsaid) {
      expect(said).not.toContain(plain(word));
    }

    return body;
  }

  function shown(part: unknown): string {
    if (typeof part === 'string') {
      return part;
    }

    if (part instanceof Error) {
      return `${part.message} ${part.stack ?? ''}`;
    }

    try {
      return JSON.stringify(part) ?? String(part);
    } catch {
      return String(part);
    }
  }

  function capture(line: readonly unknown[]): void {
    logged.push(line.map(shown).join(' '));
  }

  beforeAll(async () => {
    // The tripwire must be live before anything here could reach HIBP, or "no attempt" at the end proves nothing.
    expect(hibpTripwireInstalled()).toBe(true);
    await expect(fetch('https://api.pwnedpasswords.com/range/00000')).rejects.toThrow();
    expect(hibpAttempts()).toBe(1);

    for (const method of ['debug', 'error', 'info', 'log', 'warn'] as const) {
      const original = console[method];

      console[method] = (...line: unknown[]) => {
        capture(line);
        original.apply(console, line);
      };

      restoreLogs.push(() => {
        console[method] = original;
      });
    }

    for (const stream of [process.stdout, process.stderr]) {
      const original = stream.write;

      stream.write = ((chunk: unknown, ...rest: unknown[]) => {
        capture([String(chunk)]);

        return (original as (...args: unknown[]) => boolean).call(stream, chunk, ...rest);
      }) as typeof stream.write;
      restoreLogs.push(() => {
        stream.write = original;
      });
    }

    const [clock] = await sql()<{ now: string }>`select now()::text as now`;

    started = clock?.now ?? '';
    app = await createApp(new ScriptedAiClient([]));
  });

  afterAll(async () => {
    // Whatever this suite made, whatever password it ended with: given a known one, then deleted through the product's own door.
    const left = await sql()<{
      id: string;
      email: string;
    }>`select id, email from "user" where email like ${`passwords-%-${String(stamp)}@e2e.invalid`}`;
    const known = await hashPassword(CLEANUP_PASSWORD);

    for (const { id, email } of left) {
      await sql()`update account set password = ${known} where user_id = ${id} and provider_id = 'credential'`;
      await deleteAccountByEmail(app, email, CLEANUP_PASSWORD);
    }

    const [remaining] = await sql()<{
      n: number;
    }>`select count(*)::int as n from "user" where email like ${`passwords-%-${String(stamp)}@e2e.invalid`}`;

    await app?.close();

    for (const restore of restoreLogs) {
      restore();
    }

    expect(remaining?.n ?? 0).toBe(0);
  });

  describe('sign-up', () => {
    it('refuses eleven characters with Better Auth’s own code, and makes no account', async () => {
      const email = emailFor('short');
      const refused = await signUp(email, 'Corto Maltés', ELEVEN);

      expectRefusal(refused, 'PASSWORD_TOO_SHORT', [ELEVEN]);
      expect(await accountsWith(email)).toBe(0);
    });

    it('measures the length before it reads the words: eleven characters with "nutria" in them are too short', async () => {
      const email = emailFor('order');
      const refused = await signUp(email, 'Orden Primero', 'nutria-1234');

      expectRefusal(refused, 'PASSWORD_TOO_SHORT', ['nutria-1234']);
      expect(await accountsWith(email)).toBe(0);
    });

    it('refuses 129 characters with Better Auth’s own code', async () => {
      const email = emailFor('long');
      const long = `${'k7'.repeat(64)}q`;

      expect(long).toHaveLength(129);

      const refused = await signUp(email, 'Largo Caballero', long);

      expectRefusal(refused, 'PASSWORD_TOO_LONG', [long]);
      expect(await accountsWith(email)).toBe(0);
    });

    it('refuses the address, a word of the name and the product’s name with one code and one message, naming none of them', async () => {
      const local = `passwords-local-${String(stamp)}`;
      const cases = [
        // The whole local part, in capitals.
        { email: `${local}@e2e.invalid`, matched: local, name: 'Ana Gil', password: `${local.toUpperCase()} is mine` },
        // A word of the name, accented there and plain here.
        { email: emailFor('name'), matched: 'inigo', name: 'Íñigo Zubizarreta', password: 'inigo rides the night bus' },
        // A name split on its hyphen: each half is a word.
        { email: emailFor('hyphen'), matched: 'sophie', name: 'Anne-Sophie Lefèvre', password: 'Sophie paints the harbour' },
        // The product's name, accented and in mixed case on the password's side.
        { email: emailFor('brand'), matched: 'nutria', name: 'Bruno Sáez', password: 'Mi NútrIA de cada mañana' }
      ];
      const messages = new Set<string | undefined>();

      for (const { email, matched, name, password } of cases) {
        const refused = await signUp(email, name, password);
        const body = expectRefusal(refused, 'PASSWORD_HAS_CONTEXT', [password, matched]);

        messages.add(body.message);
        expect(await accountsWith(email)).toBe(0);
      }

      // One message for all three causes: which word it was is not for whoever is typing.
      expect(messages.size).toBe(1);
    });

    it('accepts twelve clean characters', async () => {
      const email = emailFor('clean');
      const accepted = await signUp(email, 'Teodora Vallejo', CLEAN_TWELVE);

      expect(accepted.status).toBe(200);
      expect(await accountsWith(email)).toBe(1);

      await signIn(email, CLEAN_TWELVE, 200);
    });
  });

  describe('reset', () => {
    const email = emailFor('reset');
    const name = 'Leocadia Quintanilla';
    const original = 'pebble-harvest-window-5';
    const renewed = 'violet-kettle-umbrella-8';
    let token = '';

    const reset = (newPassword: string, using = token) => {
      sent.push(newPassword);

      return request(server()).post(`/${PREFIX}/auth/reset-password`).send({ newPassword, token: using });
    };

    beforeAll(async () => {
      const made = await signUp(email, name, original).expect(200);
      const userId = (made.body as { user: { id: string } }).user.id;

      await request(server()).post(`/${PREFIX}/auth/request-password-reset`).send({ email }).expect(200);

      // Read from the table, not from the mail: the row is written before the response, the mail may land after it.
      const [row] = await sql()<{ identifier: string }>`
        select identifier from verification where value = ${userId} and identifier like 'reset-password:%' order by created_at desc limit 1`;

      token = row?.identifier.slice('reset-password:'.length) ?? '';
      expect(token).not.toBe('');
    });

    it('refuses eleven characters with Better Auth’s own code', async () => {
      expectRefusal(await reset(ELEVEN), 'PASSWORD_TOO_SHORT', [ELEVEN]);
    });

    it('refuses the account’s own address, as the account the token belongs to', async () => {
      const local = email.split('@')[0] ?? '';

      expectRefusal(await reset(`new ${local} key`), 'PASSWORD_HAS_CONTEXT', [local]);
    });

    it('refuses a word of the account’s name, whatever its case', async () => {
      expectRefusal(await reset('QUINTANILLA by the sea'), 'PASSWORD_HAS_CONTEXT', ['quintanilla']);
    });

    it('leaves a token nobody issued to Better Auth: its own INVALID_TOKEN, even for a password ours would refuse', async () => {
      const refused = await reset('nutria under the bridge', 'not-a-token-anybody-issued');

      expect(refused.status).toBe(400);
      expect((refused.body as Refusal).code).toBe('INVALID_TOKEN');
    });

    describe('a token in the query, which Better Auth reads when the body has none', () => {
      const resetWithQuery = (newPassword: string, body: string, query: string) => {
        sent.push(newPassword);

        return request(server()).post(`/${PREFIX}/auth/reset-password`).query({ token: query }).send({ newPassword, token: body });
      };

      const stillOriginal = () => signIn(email, original, 200);

      it('checks the password against the account the query token belongs to when the body token is empty', async () => {
        expectRefusal(await resetWithQuery('quintanilla-quintanilla-1', '', token), 'PASSWORD_HAS_CONTEXT', ['quintanilla']);
        await stillOriginal();
      });

      it('still checks the body token when the query token is dead', async () => {
        expectRefusal(await resetWithQuery('quintanilla-quintanilla-2', token, 'not-a-token-anybody-issued'), 'PASSWORD_HAS_CONTEXT', [
          'quintanilla'
        ]);
        await stillOriginal();
      });

      it('answers INVALID_TOKEN when the body token is dead and the query token live, and sets nothing', async () => {
        const refused = await resetWithQuery('meadow-lantern-copper-4', 'not-a-token-anybody-issued', token);

        expect(refused.status).toBe(400);
        expect((refused.body as Refusal).code).toBe('INVALID_TOKEN');
        await stillOriginal();
      });
    });

    it('accepts a clean password with the same token — a refusal does not spend it — and only the new one signs in', async () => {
      const accepted = await reset(renewed);

      expect(accepted.status).toBe(200);

      await signIn(email, renewed, 200);
      await signIn(email, original, 401);

      // Spent now, by the reset that went through.
      const again = await reset('another-clean-phrase-2');

      expect((again.body as Refusal).code).toBe('INVALID_TOKEN');
    });
  });

  describe('an expired verification row, before the sweep reaches it', () => {
    const email = emailFor('expired');
    const original = 'amber-thistle-railway-6';
    /** A row nobody would ever look up: only the cleanup Better Auth runs on every lookup could remove it. */
    const bystander = `passwords-bystander:${String(stamp)}`;
    let userId = '';
    let token = '';
    let hash = '';

    const passwordHash = async () => {
      const [row] = await sql()<{ password: string }>`select password from account where user_id = ${userId} and provider_id = 'credential'`;

      return row?.password ?? '';
    };

    beforeAll(async () => {
      const made = await signUp(email, 'Eustaquio Berrocal', original).expect(200);

      userId = (made.body as { user: { id: string } }).user.id;
      await request(server()).post(`/${PREFIX}/auth/request-password-reset`).send({ email }).expect(200);

      const [row] = await sql()<{ identifier: string }>`
        select identifier from verification where value = ${userId} and identifier like 'reset-password:%' order by created_at desc limit 1`;

      token = row?.identifier.slice('reset-password:'.length) ?? '';
      expect(token).not.toBe('');

      // Expired a minute ago, as a link left in a mailbox past its hour would be.
      await sql()`update verification set expires_at = now() - interval '1 minute' where identifier = ${`reset-password:${token}`}`;
      await sql()`
        insert into verification (id, identifier, value, expires_at, created_at, updated_at)
        values (${bystander}, ${bystander}, 'nobody', now() - interval '1 minute', now(), now())`;
      hash = await passwordHash();
    });

    afterAll(async () => {
      await sql()`delete from verification where id = ${bystander} or identifier = ${`reset-password:${token}`}`;
    });

    it('stays in the table through lookups: Better Auth’s own cleanup is off, the sweep owns expiry', async () => {
      // Each of these looks a verification up, which is what deletes every expired row when the cleanup is on.
      await request(server())
        .post(`/${PREFIX}/auth/request-password-reset`)
        .send({ email: emailFor('nobody') })
        .expect(200);
      await request(server())
        .post(`/${PREFIX}/auth/reset-password`)
        .send({ newPassword: 'cobalt-harbour-willow-7', token: 'not-a-token-anybody-issued' });
      sent.push('cobalt-harbour-willow-7');

      const [row] = await sql()<{ n: number }>`select count(*)::int as n from verification where id = ${bystander}`;

      expect(row?.n).toBe(1);
    });

    it('is refused by the reset link: a redirect with INVALID_TOKEN', async () => {
      const opened = await request(server())
        .get(`/${PREFIX}/auth/reset-password/${token}`)
        .query({ callbackURL: 'http://localhost:3000/restablecer' })
        .redirects(0);

      expect(opened.status).toBe(302);
      expect(new URL(String(opened.headers.location)).searchParams.get('error')).toBe('INVALID_TOKEN');
    });

    it('is refused by the reset itself with INVALID_TOKEN, before any check of ours, and the password is unchanged', async () => {
      for (const newPassword of ['berrocal-berrocal-berrocal', 'saffron-meadow-ladder-9']) {
        sent.push(newPassword);

        const refused = await request(server()).post(`/${PREFIX}/auth/reset-password`).send({ newPassword, token });

        expect(refused.status).toBe(400);
        expect((refused.body as Refusal).code).toBe('INVALID_TOKEN');
      }

      expect(await passwordHash()).toBe(hash);
      await signIn(email, original, 200);
    });
  });

  describe('change', () => {
    const email = emailFor('change');
    const current = 'granite-meadow-cobalt-4';
    let cookie = '';

    /**
     * Better Auth allows three password changes in ten seconds from one address (its own rule, which the test
     * environment does not raise), and the suites before this one change passwords too: a 429 is waited out, for as
     * long as it says, and the same change sent again — as in `account-security.e2e-spec.ts`.
     */
    const change = async (newPassword: string): Promise<Response> => {
      sent.push(newPassword);

      const send = () =>
        request(server()).post(`/${PREFIX}/auth/change-password`).set('Cookie', cookie).send({ currentPassword: current, newPassword });
      let response = await send();

      for (let retry = 0; retry < 2 && response.status === 429; retry += 1) {
        const wait = Number(response.headers['x-retry-after'] ?? 10);

        await new Promise<void>(resolve => setTimeout(resolve, (Number.isFinite(wait) ? wait : 10) * 1000 + 500));
        response = await send();
      }

      return response;
    };

    beforeAll(async () => {
      await signUp(email, 'Casilda Ybarra', current).expect(200);

      const signedIn = await signIn(email, current, 200);

      cookie = cookiesOf(signedIn);
    });

    // Better Auth allows three changes in ten seconds: these are the three.
    it('refuses eleven characters with Better Auth’s own code', async () => {
      expectRefusal(await change(ELEVEN), 'PASSWORD_TOO_SHORT', [ELEVEN]);
    });

    it('refuses a word of the signed-in account’s name', async () => {
      expectRefusal(await change('ybarra keeps the lights on'), 'PASSWORD_HAS_CONTEXT', ['ybarra']);
    });

    it('accepts a clean one', async () => {
      const accepted = await change('amber-lantern-quietly-7');

      expect(accepted.status).toBe(200);
      await signIn(email, 'amber-lantern-quietly-7', 200);
    });
  });

  describe('sign-in', () => {
    it('still opens an account whose password predates the rule: eight characters, the product’s name in them', async () => {
      const email = emailFor('legacy');
      const legacy = 'nutria-8';

      sent.push(legacy);

      const made = await signUp(email, 'Hermenegildo Paz', 'saffron-bicycle-tundra-6').expect(200);
      const userId = (made.body as { user: { id: string } }).user.id;

      // Written on the table: no door sets such a password any more, which is the point.
      await sql()`update account set password = ${await hashPassword(legacy)} where user_id = ${userId} and provider_id = 'credential'`;

      await signIn(email, legacy, 200);
    });
  });

  describe('what is left behind', () => {
    it('no password in a log line, an audit row or an analytics event, and no request to HIBP', async () => {
      const distinct = [...new Set(sent)];

      expect(distinct.length).toBeGreaterThan(10);

      for (const password of distinct) {
        expect(logged.filter(line => line.includes(password))).toEqual([]);

        const [audit] = await sql()<{ n: number }>`
          select count(*)::int as n from audit_logs where created_at >= ${started} and position(${password} in coalesce(metadata::text, '')) > 0`;
        const [events] = await sql()<{ n: number }>`
          select count(*)::int as n from analytics_events where created_at >= ${started} and position(${password} in coalesce(properties::text, '')) > 0`;

        expect(audit?.n).toBe(0);
        expect(events?.n).toBe(0);
      }

      // The one attempt is the tripwire's own check in `beforeAll`; the API made none.
      expect(hibpAttempts()).toBe(1);
    });
  });
});
