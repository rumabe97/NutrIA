import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { database } from 'database';

import { AI_REWRITE_CLIENT } from '../src/modules/ai/ai.config.js';
import { ENV, validateEnv } from '../src/config/index.js';
import { OwnerAlertsService } from '../src/modules/owner-alerts/index.js';
import { EmailService } from '../src/modules/email/services/Email.service.js';
import {
  completeOnboarding,
  createApp,
  deleteAccountByEmail,
  deleteAccounts,
  dish,
  generateAndWait,
  httpServer,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient,
  SEEDED
} from './harness.js';

import type { Account } from './harness.js';
import type { AiRequest, AiResponse } from '../src/modules/ai/clients/AiClient.js';
import type { Env } from '../src/config/index.js';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The owner is told by mail, unasked (`0071`, project 008 phase 6).
 *
 * Three applications share one database, and only the environment tells them apart:
 *
 * - `silent`: the default of this suite, with `OWNER_EMAIL` and every `SMTP_*` blank. The
 *   month's text spend is over its cap and three generations in a row have failed, so
 *   *every* condition for a mail is true, and nothing is written or sent.
 * - `mailed`: SMTP and `OWNER_EMAIL` set, and the real `EmailService` with its transporter
 *   replaced by a stand-in that keeps the message (or refuses it). No mail leaves, and
 *   the `mail_sent` row is the real one.
 * - `capped`: `mailed`, and the text cap below what this month has spent.
 *
 * What is not proved here, and where it is: the wording and the "no address, no free text"
 * rule of the mails (`OwnerMail.spec.ts`), "only when something is non-zero" — the answer
 * depends on what the shared database holds (`OwnerAlerts.spec.ts`, `AdminAlertController.test.ts`)
 * — and a digest that *throws* (`Cron.controller.spec.ts`).
 *
 * The shared database also holds the rows a real day left. The few that would block a
 * claim (`digest` today, `generation-streak` in the last 6 h, `spend-text-*` this month) are
 * moved sixty days back for the run and put back at the end; every row the run makes is
 * removed.
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

const OWNER = `owner-alerts-e2e-${randomBytes(3).toString('hex')}@example.invalid`;
const TAG = 'owner-alerts-e2e';
const BLOCKING_KINDS = ['digest', 'generation-streak', 'spend-text-80', 'spend-text-100'];
/** The sweep with its switch off, which is how the run holds it. */
const ZERO_RUN = { considered: 0, failed: 0, pushed: 0, sent: 0 };

/** Every dish carries an allergen, whichever of them an account declares. */
const ALLERGENIC = ['breakfast', 'lunch', 'dinner'].map(slot =>
  dish(
    `Huevos y merluza ${slot}`,
    [slot],
    [
      { grams: 150, slug: SEEDED.huevo },
      { grams: 150, slug: SEEDED.merluza }
    ]
  )
);

/**
 * The model answers with dishes an account that declared every allergen cannot be
 * served while `allergenic` is on, and with the ordinary pool otherwise.
 */
class SwitchedAiClient extends ScriptedAiClient {
  public allergenic = false;
  private readonly unsafe = new ScriptedAiClient(ALLERGENIC);

  generate<T>(aiRequest: AiRequest<T>): Promise<AiResponse<T>> {
    return this.allergenic ? this.unsafe.generate(aiRequest) : super.generate(aiRequest);
  }
}

/** Free-text allergens for the staples a vegan account free of the fourteen could still eat. */
const STAPLES = [
  'arroz',
  'patata',
  'lentejas',
  'tomate',
  'garbanzos',
  'judías',
  'calabacín',
  'zanahoria',
  'cebolla',
  'espinacas',
  'plátano',
  'manzana'
];

type Sent = { readonly html: string; readonly subject: string; readonly text: string; readonly to: string };
type Shelved = { readonly id: string; readonly createdAt: string };
type MailRow = { readonly ok: boolean };

describe('the owner is told by mail (0071, phase 6)', () => {
  const cronSecret = randomBytes(24).toString('hex');
  const stamp = Date.now();
  const made: string[] = [];
  const shelved: Shelved[] = [];
  const outbox: Sent[] = [];
  const bad: Account[] = [];
  const good: Account[] = [];
  let refuse = false;
  let ai: SwitchedAiClient;
  let silent: INestApplication;
  let mailed: INestApplication;
  let capped: INestApplication;
  let started = '';
  let waiting: Account;
  let switchWas = true;
  let allergens: readonly string[] = [];
  let cap = 0;

  const envFor = (extra: Record<string, string>): Env =>
    validateEnv({ ...process.env, AI_IMAGE_MONTHLY_CAP_USD: '1000', AI_REWRITE_STEPS: 'true', CRON_SECRET: cronSecret, ...extra });

  const settle = () => new Promise(resolve => setTimeout(resolve, 2500));

  const cron = (app: INestApplication, path: string) =>
    request(httpServer(app)).get(`/${PREFIX}/cron/${path}`).set('Authorization', `Bearer ${cronSecret}`);

  const alerted = (kind: string) =>
    sql()<{ properties: Record<string, unknown>; userId: string | null }>`
      select properties, user_id as "userId" from analytics_events
      where event = 'owner_alerted' and properties ->> 'kind' = ${kind} and created_at >= ${started}`;

  const alertedAny = () =>
    sql()<{ kind: string }>`
      select properties ->> 'kind' as kind from analytics_events where event = 'owner_alerted' and created_at >= ${started}`;

  const mails = (kind: string) =>
    sql()<MailRow>`
      select (properties ->> 'ok')::boolean as ok from analytics_events
      where event = 'mail_sent' and properties ->> 'kind' = ${kind} and created_at >= ${started}`;

  const ownerMails = () => outbox.filter(mail => mail.to === OWNER);

  async function until(check: () => Promise<boolean>): Promise<void> {
    const deadline = Date.now() + 15_000;

    while (Date.now() < deadline) {
      if (await check()) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 250));
    }

    throw new Error('The condition did not hold within 15 s');
  }

  async function account(prefix: string, allergenIds: readonly string[]): Promise<Account> {
    const who = await register(silent, `${prefix}-${stamp}-${String(made.length)}@e2e.invalid`);

    made.push(who.cookie);
    await completeOnboarding(
      silent,
      who,
      allergenIds,
      allergenIds.length > 0 ? STAPLES : [],
      allergenIds.length > 0,
      allergenIds.length > 0 ? ['vegan'] : []
    );

    return who;
  }

  /** A generation in the application under test, and the account's plan goes with the account. */
  const generate = (app: INestApplication, who: Account) => generateAndWait(app, who);

  /** A job that fails on purpose: every allergen declared leaves no dish for the plan. */
  async function fails(app: INestApplication, who: Account): Promise<void> {
    ai.allergenic = true;

    const job = await generate(app, who).finally(() => {
      ai.allergenic = false;
    });

    expect(job).toMatchObject({ error: 'GENERATION_POOL_TOO_SMALL', planId: null, status: 'failed' });
  }

  function fakeTransport(app: INestApplication): void {
    const mailer = app.get(EmailService, { strict: false }) as unknown as { transporter: unknown };

    mailer.transporter = {
      sendMail: (message: Sent): Promise<void> => {
        if (refuse) {
          return Promise.reject(new Error('smtp is down'));
        }

        outbox.push(message);

        return Promise.resolve();
      }
    };
  }

  async function forget(kinds: readonly string[]): Promise<void> {
    await sql()`delete from analytics_events where event = 'owner_alerted' and properties ->> 'kind' = any(${kinds as string[]}) and created_at >= ${started}`;
  }

  beforeAll(async () => {
    // What this suite is about is what the default environment does not do.
    for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'OWNER_EMAIL']) {
      expect(process.env[name] ?? '').toBe('');
    }

    const [clock] = await sql()<{ now: string }>`select now()::text as now`;

    started = clock?.now ?? '';

    const [spent] = await sql()<{ spent: string | null }>`
      select sum((properties ->> 'costUsd')::numeric) filter (where jsonb_typeof(properties -> 'costUsd') = 'number') as spent
      from analytics_events where event = 'ai_call' and created_at >= date_trunc('month', now() at time zone 'UTC')`;

    // One dollar over what the month holds, and two dollars seeded: the gauge is past 100 % whatever the database holds.
    cap = Math.ceil(Number(spent?.spent ?? 0)) + 1;

    if (cap > 1000) {
      throw new Error('This database’s month is too large for a cap the environment accepts');
    }

    const mailEnv = {
      EMAIL_FROM: 'nutria@e2e.invalid',
      OWNER_EMAIL: OWNER,
      SMTP_HOST: 'smtp.e2e.invalid',
      SMTP_PASS: 'not-a-password',
      SMTP_USER: 'not-a-user'
    };
    ai = new SwitchedAiClient(POOL);

    silent = await createApp(ai, builder =>
      builder
        .overrideProvider(ENV)
        .useValue(envFor({ AI_TEXT_MONTHLY_CAP_USD: String(cap) }))
        .overrideProvider(AI_REWRITE_CLIENT)
        .useValue(ai)
    );
    mailed = await createApp(ai, builder => builder.overrideProvider(ENV).useValue(envFor(mailEnv)).overrideProvider(AI_REWRITE_CLIENT).useValue(ai));
    capped = await createApp(ai, builder =>
      builder
        .overrideProvider(ENV)
        .useValue(envFor({ ...mailEnv, AI_TEXT_MONTHLY_CAP_USD: String(cap) }))
        .overrideProvider(AI_REWRITE_CLIENT)
        .useValue(ai)
    );
    fakeTransport(mailed);
    fakeTransport(capped);

    // The reminders switch is off for the run: the digest must not depend on it, and the sweep must send no reminder to a real account through the stand-in.
    switchWas = await SettingsController.checkInReminders();
    await SettingsController.setFlag('checkInReminders', false, UNAUDITED);

    const rows = await sql()<Shelved>`
      select id::text as id, created_at::text as "createdAt" from analytics_events
      where event = 'owner_alerted' and properties ->> 'kind' = any(${BLOCKING_KINDS}) and created_at > now() - interval '40 days'`;

    shelved.push(...rows);
    await sql()`update analytics_events set created_at = created_at - interval '60 days' where id::text = any(${rows.map(row => row.id)})`;

    // An account waiting to be activated: something in the digest that is non-zero whatever else the database holds.
    waiting = await register(silent, `owner-alerts-waiting-${stamp}@e2e.invalid`);
    made.push(waiting.cookie);
    await sql()`update "user" set activated_at = null where id = ${waiting.id}`;

    // The spend that puts the text gauge past its cap.
    await sql()`
      insert into analytics_events (event, user_id, properties, created_at)
      values ('ai_call', null, ${JSON.stringify({ costUsd: 2, feature: 'plan', model: TAG })}::jsonb, now())`;

    const list: Response = await request(httpServer(silent)).get(`/${PREFIX}/safety/allergens`).expect(200);

    allergens = (list.body as readonly { id: string }[]).map(allergen => allergen.id);
    expect(allergens.length).toBeGreaterThan(5);

    for (let index = 0; index < 5; index += 1) {
      bad.push(await account('owner-alerts-bad', allergens));
    }

    for (let index = 0; index < 2; index += 1) {
      good.push(await account('owner-alerts-good', []));
    }
  }, 300_000);

  afterAll(async () => {
    await sql()`update "user" set activated_at = now() where id = ${waiting?.id ?? ''} and activated_at is null`;
    await deleteAccounts(silent, made);

    // Whoever was still being made when a hook timed out, and what an interrupted run left.
    const stragglers = await sql()<{ email: string }>`select email from "user" where email like 'owner-alerts-%@e2e.invalid'`;

    for (const { email } of stragglers) {
      await deleteAccountByEmail(silent, email);
    }

    await sql()`delete from analytics_events where event = 'owner_alerted' and created_at >= ${started}`;
    await sql()`delete from analytics_events where event = 'mail_sent' and properties ->> 'kind' like 'owner-%' and created_at >= ${started}`;
    await sql()`delete from analytics_events where event = 'cron_run' and created_at >= ${started}`;
    await sql()`delete from analytics_events where event = 'ai_call' and properties ->> 'model' = ${TAG}`;

    for (const row of shelved) {
      await sql()`update analytics_events set created_at = ${row.createdAt} where id::text = ${row.id}`;
    }

    await SettingsController.setFlag('checkInReminders', switchWas, UNAUDITED);

    const [left] = await sql()<{ accounts: number; alerts: number; calls: number; crons: number; mails: number }>`
      select (select count(*)::int from "user" where email like ${`owner-alerts-%-${String(stamp)}-%@e2e.invalid`}) as accounts,
             (select count(*)::int from analytics_events where event = 'owner_alerted' and created_at >= ${started}) as alerts,
             (select count(*)::int from analytics_events where event = 'ai_call' and properties ->> 'model' = ${TAG}) as calls,
             (select count(*)::int from analytics_events where event = 'cron_run' and created_at >= ${started}) as crons,
             (select count(*)::int from analytics_events where event = 'mail_sent' and properties ->> 'kind' like 'owner-%' and created_at >= ${started}) as mails`;

    expect(left).toEqual({ accounts: 0, alerts: 0, calls: 0, crons: 0, mails: 0 });

    await Promise.all([silent?.close(), mailed?.close(), capped?.close()]);
  });

  describe('without OWNER_EMAIL and SMTP', () => {
    it('leaves no trace and answers as before: the reminders run, the nightly rewrite, and three failed generations in a row', async () => {
      const reminders = await cron(silent, 'reminders').expect(200);

      expect(reminders.body).toEqual(ZERO_RUN);

      // The rewrite is held by the cap, which is over: the case in which the spend alert would fire.
      const rewrite = await cron(silent, 'rewrite-steps').expect(200);

      expect(rewrite.body).toEqual({ heldBy: 'cap', pending: 0, rewritten: 0, skipped: 0, unreached: 0 });

      for (const who of bad.slice(0, 3)) {
        await fails(silent, who);
      }

      await settle();
      expect(await alertedAny()).toEqual([]);
      expect(await mails('owner-alert')).toEqual([]);
      expect(await mails('owner-digest')).toEqual([]);
      expect(outbox).toEqual([]);
    }, 240_000);
  });

  describe('the daily digest', () => {
    it('is sent before the reminders switch is read, once, and a mail that fails leaves no claim', async () => {
      const silentBody = (await cron(silent, 'reminders').expect(200)).body as object;

      refuse = true;

      const failedRun = await cron(mailed, 'reminders').expect(200);

      // A mail that did not leave: same answer, the claim given back, the failure counted.
      expect(failedRun.body).toEqual(silentBody);
      expect(await alerted('digest')).toEqual([]);
      expect(await mails('owner-digest')).toEqual([{ ok: false }]);
      expect(ownerMails()).toEqual([]);

      refuse = false;

      const first = await cron(mailed, 'reminders').expect(200);

      expect(first.body).toEqual(silentBody);

      const rows = await alerted('digest');

      expect(rows).toHaveLength(1);
      // The row carries the kind and nothing else, and no user.
      expect(rows[0]?.userId).toBeNull();
      expect(Object.keys(rows[0]?.properties ?? {})).toEqual(['kind']);
      expect(await mails('owner-digest')).toEqual([{ ok: false }, { ok: true }]);
      expect(ownerMails()).toHaveLength(1);

      const mail = ownerMails()[0];

      expect(mail?.subject).toBeTruthy();

      // No address in what was sent: the owner's own, nor the account that is waiting.
      for (const body of [mail?.html, mail?.text]) {
        expect(body).not.toContain(OWNER);
        expect(body).not.toContain(waiting.email);
        expect(body).not.toContain(waiting.id);
      }

      // The same Madrid day: no second row, no second mail.
      await cron(mailed, 'reminders').expect(200);
      expect(await alerted('digest')).toHaveLength(1);
      expect(await mails('owner-digest')).toEqual([{ ok: false }, { ok: true }]);
      expect(ownerMails()).toHaveLength(1);
    }, 60_000);
  });

  describe('three generations in a row that failed', () => {
    it('are told once, and a fourth within 6 h adds nothing', async () => {
      await forget(['digest']);

      const mailsBefore = ownerMails().length;

      // A success first: whatever the database ended with, the streak starts from here.
      expect((await generate(mailed, good[0] as Account)).status).toBe('succeeded');
      await settle();
      expect(await alerted('generation-streak')).toEqual([]);

      await fails(mailed, bad[3] as Account);
      await fails(mailed, bad[4] as Account);
      await settle();
      // Two failures after a success are not a streak.
      expect(await alerted('generation-streak')).toEqual([]);

      await fails(mailed, bad[0] as Account);
      await until(async () => (await alerted('generation-streak')).length === 1);
      await until(async () => (await mails('owner-alert')).length === 1);

      const [row] = await alerted('generation-streak');

      expect(row?.userId).toBeNull();
      expect(Object.keys(row?.properties ?? {})).toEqual(['kind']);
      expect(await mails('owner-alert')).toEqual([{ ok: true }]);
      expect(ownerMails()).toHaveLength(mailsBefore + 1);

      // The fourth, seconds later: still one.
      await fails(mailed, bad[1] as Account);
      await settle();
      expect(await alerted('generation-streak')).toHaveLength(1);
      expect(await mails('owner-alert')).toHaveLength(1);
    }, 300_000);

    it('are counted again after a success in between', async () => {
      await forget(['generation-streak']);

      expect((await generate(mailed, good[1] as Account)).status).toBe('succeeded');
      await fails(mailed, bad[2] as Account);
      await fails(mailed, bad[3] as Account);
      await settle();
      expect(await alerted('generation-streak')).toEqual([]);

      await fails(mailed, bad[4] as Account);
      await until(async () => (await alerted('generation-streak')).length === 1);
    }, 300_000);

    it('never change the job’s final status when the mail cannot leave, and give the claim back', async () => {
      await forget(['generation-streak']);
      refuse = true;

      const before = (await mails('owner-alert')).length;

      await fails(mailed, bad[0] as Account);
      await until(async () => (await mails('owner-alert')).length === before + 1);

      expect((await mails('owner-alert')).slice(before)).toEqual([{ ok: false }]);
      expect(await alerted('generation-streak')).toEqual([]);

      refuse = false;
    }, 120_000);
  });

  describe('the text spend past its cap', () => {
    it('is told once when the nightly rewrite ends, without also telling the 80 %', async () => {
      const before = ownerMails().length;
      const run = await cron(capped, 'rewrite-steps').expect(200);

      expect(run.body).toEqual({ heldBy: 'cap', pending: 0, rewritten: 0, skipped: 0, unreached: 0 });

      const rows = await alerted('spend-text-100');

      expect(rows).toHaveLength(1);
      expect(rows[0]?.userId).toBeNull();
      expect(Object.keys(rows[0]?.properties ?? {})).toEqual(['kind']);
      expect(ownerMails()).toHaveLength(before + 1);

      await cron(capped, 'rewrite-steps').expect(200);
      expect(await alerted('spend-text-100')).toHaveLength(1);
      expect(ownerMails()).toHaveLength(before + 1);
    });

    it('leaves nothing but rows that carry a kind', async () => {
      const kinds = (await alertedAny()).map(row => row.kind);

      for (const kind of kinds) {
        expect(['digest', 'generation-streak', 'spend-text-80', 'spend-text-100']).toContain(kind);
      }
    });
  });

  describe('what was sent', () => {
    it('holds no address, no account id and no user- reference, in any part of any mail', () => {
      expect(ownerMails().length).toBeGreaterThan(0);

      for (const mail of ownerMails()) {
        for (const part of [mail.subject, mail.text, mail.html]) {
          expect(part).not.toContain('@');
          expect(part).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
          expect(part).not.toContain('usr-');
        }
      }
    });
  });

  describe('a digest that throws', () => {
    it('does not change what /cron/reminders answers', async () => {
      const broken = await createApp(ai, builder =>
        builder
          .overrideProvider(ENV)
          .useValue(envFor({}))
          .overrideProvider(OwnerAlertsService)
          .useValue({ afterJob: () => Promise.resolve(), checkSpend: () => Promise.resolve(), digest: () => Promise.reject(new Error('boom')) })
      );

      try {
        const run = await cron(broken, 'reminders').expect(200);

        expect(run.body).toEqual(ZERO_RUN);
      } finally {
        await broken.close();
      }
    });
  });
});
