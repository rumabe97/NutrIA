import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { DEFAULT_WEB_LOCALE, webUrl } from 'core/domain/WebUrl';
import { database } from 'database';
import { SettingsController } from 'core/controllers/Settings';
import { UNAUDITED } from 'core/entities/Audit';
import { UserController } from 'core/controllers/User';

import { ENV, validateEnv } from '../src/config/index.js';
import { EmailService } from '../src/modules/email/services/Email.service.js';
import { OwnerAlertsService } from '../src/modules/owner-alerts/index.js';
import { PictureCallError } from '../src/modules/ai/clients/pictureTransport.js';
import { PictureImageClient } from '../src/modules/ai/clients/PictureImageClient.js';
import { PictureJudgeClient } from '../src/modules/ai/clients/PictureJudgeClient.js';
import { PictureStore } from '../src/modules/ai/clients/PictureStore.js';
import { StubPictureImageClient, StubPictureJudgeClient, StubPictureStore } from '../src/modules/ai/clients/StubPictureClients.js';

import { completeOnboarding, createApp, deleteAccounts, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { DrawnPicture } from '../src/modules/ai/clients/PictureImageClient.js';
import type { Env } from '../src/config/index.js';
import type { INestApplication } from '@nestjs/common';
import type { TestingModuleBuilder } from '@nestjs/testing';

/**
 * The owner is told by mail that dish pictures failed (`0072`, project 009 phase 1).
 *
 * Two applications share one database, and only the environment tells them apart:
 *
 * - `silent`: `OWNER_EMAIL` and every `SMTP_*` blank, the default of the suite.
 * - `mailed`: SMTP and `OWNER_EMAIL` set, and the real `EmailService` with its transporter
 *   swapped for a stand-in that keeps the message. No mail leaves, and the `mail_sent`
 *   row is the real one.
 *
 * The drawing, the judge and the store are the product's own stubs; the drawing is made
 * to fail with a `PictureCallError` (a 500 fails the dish, a 402 gives the claim back).
 * The mail is reached by its real path — the owner's retry route ends a drawing, and the
 * drawing tells the mail — and, where time matters, by calling
 * `OwnerAlertsService.pictureFailures(now)` with the clock in the test's hand and rows
 * whose `last_attempt_at` the test dates. The claim of a mail is dated with the `now` it was
 * given, so "an hour later" needs no waiting.
 *
 * What is counted is "since the last mail of that kind, or 24 h", so the shared database
 * would leak into the numbers. Isolation, here, is a *dated claim first*: a `picture-failed`
 * and a `picture-payment-refused` claim seven hours back, made by the suite (older than the
 * six hours the longer of the two claims lasts — a nearer one would itself be "already told" —
 * and newer than anything else), and any failed picture the database already held from
 * the last eight hours moved sixty days back and put back at the end.
 * Claims of every other kind that would block (`digest` today, `generation-streak`,
 * `spend-*`, `cron-silent-reminders`) are moved sixty days back for the run, as
 * `owner-alerts.e2e-spec.ts` does. Every row the run makes is removed.
 *
 * Not proved here, and where: the mail's wording, and that it holds no address, uuid or
 * dish-name sentinel (`OwnerMail.spec.ts`); the counts by reason (`AdminAlertController.test.ts`);
 * that the drawing survives a listener that throws (`DishPicture.spec.ts`).
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */

type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;

function sql(): Sql {
  return (database() as unknown as { readonly $client: Sql }).$client;
}

/** Draws the stub file, unless the suite has set an error for it to fail with. */
class FailingImages extends StubPictureImageClient {
  error: Error | null = new PictureCallError('upstream fell over', 500);

  async draw(): Promise<DrawnPicture> {
    if (this.error) {
      throw this.error;
    }

    return super.draw();
  }
}

type Dish = { id: string; name: string; slug: string };
type Sent = { readonly html: string; readonly subject: string; readonly text: string; readonly to: string };
type Shelved = { readonly id: string; readonly createdAt: string };
type ShelvedPicture = { readonly lastAttemptAt: string; readonly recipeId: string };

const OWNER = `picture-alerts-e2e-${randomBytes(3).toString('hex')}@example.invalid`;
const FAILED = 'picture-failed';
const REFUSED = 'picture-payment-refused';
const PICTURE_KINDS = [FAILED, REFUSED];
/** The kinds that would stop a claim, or spend one, while a cron runs. */
const BLOCKING_KINDS = [
  'digest',
  'generation-streak',
  'spend-text-80',
  'spend-text-100',
  'spend-pictures-80',
  'spend-pictures-100',
  'cron-silent-reminders'
];
const FAILED_SUBJECT = 'NutrIA — imágenes de platos fallidas: ';
const REFUSED_SUBJECT = 'NutrIA — el proveedor de imágenes rechaza las peticiones';
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe('the owner is told that dish pictures failed (0072, phase 1)', () => {
  const cronSecret = randomBytes(24).toString('hex');
  const stamp = Date.now();
  const made: string[] = [];
  const outbox: Sent[] = [];
  const shelved: Shelved[] = [];
  const shelvedPictures: ShelvedPicture[] = [];
  const touched = new Set<string>();
  const images = new FailingImages();
  let silent: INestApplication;
  let mailed: INestApplication;
  let admin: Account;
  let dishes: Dish[] = [];
  let started = '';
  let baseline = '';
  let flagBefore = false;
  let remindersBefore = true;
  let appUrl = '';

  // `AI_REWRITE_STEPS` off whatever the machine's environment says: `/cron/rewrite-steps` is called here
  // for its mail, and its sweep's client is the real one — it must claim no recipe and pay no model.
  const envFor = (extra: Record<string, string>): Env =>
    validateEnv({ ...process.env, AI_IMAGE_MONTHLY_CAP_USD: '1000', AI_REWRITE_STEPS: 'false', CRON_SECRET: cronSecret, ...extra });

  const link = (path: string) => webUrl(appUrl, path, DEFAULT_WEB_LOCALE);

  const stubbed = (builder: TestingModuleBuilder, env: Env): TestingModuleBuilder =>
    builder
      .overrideProvider(ENV)
      .useValue(env)
      .overrideProvider(PictureImageClient)
      .useValue(images)
      .overrideProvider(PictureJudgeClient)
      .useValue(new StubPictureJudgeClient())
      .overrideProvider(PictureStore)
      .useValue(new StubPictureStore());

  const pictureMails = () =>
    outbox.filter(mail => mail.to === OWNER && (mail.subject.startsWith(FAILED_SUBJECT) || mail.subject === REFUSED_SUBJECT));

  const claims = (kind: string) =>
    sql()<{ at: string; properties: Record<string, unknown>; userId: string | null }>`
      select created_at::text as at, properties, user_id as "userId" from analytics_events
      where event = 'owner_alerted' and properties ->> 'kind' = ${kind} and created_at > ${baseline}
      order by created_at`;

  const sentRows = () =>
    sql()<{ ok: boolean }>`
      select (properties ->> 'ok')::boolean as ok from analytics_events
      where event = 'mail_sent' and properties ->> 'kind' = 'owner-picture-alert' and created_at >= ${started}
      order by created_at, id`;

  const cron = (path: string) => request(httpServer(mailed)).get(`/${PREFIX}/cron/${path}`).set('Authorization', `Bearer ${cronSecret}`);

  const retry = (app: INestApplication, recipeId: string) =>
    request(httpServer(app)).post(`/${PREFIX}/admin/catalogue/recipes/${recipeId}/picture/retry`).set('Cookie', admin.cookie);

  const dish = (index: number): Dish => {
    const found = dishes[index];

    if (!found) {
      throw new Error(`The library has only ${dishes.length} dishes without a picture row`);
    }

    touched.add(found.id);

    return found;
  };

  /** A failed row as a drawing leaves it; a `released` one is the claim given back, as `releasePicture` writes it. */
  async function seed(recipeId: string, at: Date, reason: string, released = false): Promise<void> {
    touched.add(recipeId);
    await sql()`delete from recipe_images where recipe_id = ${recipeId}`;
    await sql()`
      insert into recipe_images (recipe_id, status, attempts, last_attempt_at, provenance)
      values (${recipeId}, 'failed', ${released ? 0 : 3}, ${at.toISOString()}::timestamptz,
              ${JSON.stringify(released ? { reason, released: 'e2e' } : { notes: ['1:failed:e2e'], reason })}::text::jsonb)`;
  }

  async function status(recipeId: string): Promise<string | undefined> {
    return (await sql()<{ status: string }>`select status from recipe_images where recipe_id = ${recipeId}`)[0]?.status;
  }

  /** Waits for the drawing an accepted retry scheduled to leave `drawing`. */
  async function drawn(recipeId: string): Promise<void> {
    await until(async () => (await status(recipeId)) !== 'drawing');
  }

  async function until(check: () => boolean | Promise<boolean>): Promise<void> {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      if (await check()) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('The condition did not hold within 30 s');
  }

  /** Nothing of a previous case: its rows, its claims, its mails. The two baseline claims stay. */
  async function reset(): Promise<void> {
    for (const recipeId of touched) {
      await sql()`delete from recipe_image_calls where recipe_id = ${recipeId}`;
      await sql()`delete from recipe_images where recipe_id = ${recipeId}`;
    }

    await sql()`delete from analytics_events where event = 'owner_alerted' and properties ->> 'kind' = any(${PICTURE_KINDS}) and created_at > ${baseline}`;
    await sql()`delete from analytics_events where event = 'mail_sent' and properties ->> 'kind' = 'owner-picture-alert' and created_at >= ${started}`;
    outbox.length = 0;
    images.error = new PictureCallError('upstream fell over', 500);
  }

  const service = (app: INestApplication) => app.get(OwnerAlertsService, { strict: false });

  function fakeTransport(app: INestApplication): void {
    const mailer = app.get(EmailService, { strict: false }) as unknown as { transporter: unknown };

    mailer.transporter = {
      sendMail: (message: Sent): Promise<void> => {
        outbox.push(message);

        return Promise.resolve();
      }
    };
  }

  /** Nothing an owner must not read: no address, no uuid, and none of the dishes' names. */
  function expectClean(mail: Sent): void {
    for (const part of [mail.subject, mail.text, mail.html]) {
      expect(part).not.toContain('@');
      expect(part).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

      for (const found of dishes) {
        expect(part).not.toContain(found.name);
        expect(part).not.toContain(found.slug);
      }
    }
  }

  beforeAll(async () => {
    for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'OWNER_EMAIL']) {
      expect(process.env[name] ?? '').toBe('');
    }

    const [clock] = await sql()<{ baseline: string; now: string }>`select now()::text as now, (now() - interval '7 hours')::text as baseline`;

    started = clock?.now ?? '';
    baseline = clock?.baseline ?? '';

    const mailEnv = {
      EMAIL_FROM: 'nutria@e2e.invalid',
      OWNER_EMAIL: OWNER,
      SMTP_HOST: 'smtp.e2e.invalid',
      SMTP_PASS: 'not-a-password',
      SMTP_USER: 'not-a-user'
    };
    const ai = new ScriptedAiClient(POOL);

    appUrl = envFor({}).APP_URL;
    silent = await createApp(ai, builder => stubbed(builder, envFor({})));
    mailed = await createApp(ai, builder => stubbed(builder, envFor(mailEnv)));
    fakeTransport(mailed);

    // The sweep must send no reminder to a real account, even through the stand-in.
    remindersBefore = await SettingsController.checkInReminders();
    await SettingsController.setFlag('checkInReminders', false, UNAUDITED);
    flagBefore = await SettingsController.dishPictures();
    await SettingsController.setFlag('dishPictures', true, UNAUDITED);

    const blocking = await sql()<Shelved>`
      select id::text as id, created_at::text as "createdAt" from analytics_events
      where event = 'owner_alerted' and properties ->> 'kind' = any(${[...BLOCKING_KINDS, ...PICTURE_KINDS]}) and created_at > now() - interval '40 days'`;

    shelved.push(...blocking);
    await sql()`update analytics_events set created_at = created_at - interval '60 days' where id::text = any(${blocking.map(row => row.id)})`;

    // The dated claims: what the counts start from, newer than any shelved claim and older than the 6 h a refusal's mail waits.
    for (const kind of PICTURE_KINDS) {
      await sql()`
        insert into analytics_events (event, user_id, properties, created_at)
        values ('owner_alerted', null, ${JSON.stringify({ kind })}::jsonb, ${baseline}::timestamptz)`;
    }

    const failedLately = await sql()<ShelvedPicture>`
      select recipe_id::text as "recipeId", last_attempt_at::text as "lastAttemptAt" from recipe_images
      where status = 'failed' and last_attempt_at > now() - interval '8 hours'`;

    shelvedPictures.push(...failedLately);
    await sql()`
      update recipe_images set last_attempt_at = last_attempt_at - interval '60 days'
      where recipe_id::text = any(${failedLately.map(row => row.recipeId)})`;

    admin = await register(silent, `picture-alerts-admin-${stamp}@e2e.invalid`);
    made.push(admin.cookie);
    await UserController.grantAdmin(admin.email);

    // One generation, so the library holds recipes even on a database seeded without any.
    const planner = await register(silent, `picture-alerts-planner-${stamp}@e2e.invalid`);

    made.push(planner.cookie);
    await completeOnboarding(silent, planner);
    expect((await generateAndWait(silent, planner)).status).toBe('succeeded');

    dishes = await sql()<Dish>`
      select r.id, r.name, r.slug
      from recipes r
      where not exists (select 1 from recipe_images i where i.recipe_id = r.id)
        and not exists (select 1 from recipe_image_calls c where c.recipe_id = r.id)
        and r.name is not null
      order by r.id
      limit 6`;
    expect(dishes.length).toBeGreaterThanOrEqual(5);
  }, 300_000);

  beforeEach(reset);

  afterAll(async () => {
    let left: { accounts: number; alerts: number; images: number; mails: number } | undefined;

    // What the run moved goes back whatever the clean-up meets — a refused statement included.
    try {
      left = await clean();
    } finally {
      for (const row of shelved) {
        await sql()`update analytics_events set created_at = ${row.createdAt} where id::text = ${row.id}`.catch(() => undefined);
      }

      for (const row of shelvedPictures) {
        await sql()`update recipe_images set last_attempt_at = ${row.lastAttemptAt}::timestamptz where recipe_id = ${row.recipeId}`.catch(
          () => undefined
        );
      }

      await SettingsController.setFlag('dishPictures', flagBefore, UNAUDITED).catch(() => undefined);
      await SettingsController.setFlag('checkInReminders', remindersBefore, UNAUDITED).catch(() => undefined);
      await Promise.all([silent?.close(), mailed?.close()]);
    }

    expect(left).toEqual({ accounts: 0, alerts: 0, images: 0, mails: 0 });
  });

  /** Removes every row the run made, and counts what is left of them. */
  async function clean(): Promise<{ accounts: number; alerts: number; images: number; mails: number } | undefined> {
    await reset();
    await deleteAccounts(silent, made);
    await sql()`delete from analytics_events where event = 'owner_alerted' and created_at >= ${started}`;
    await sql()`delete from analytics_events where event = 'owner_alerted' and properties ->> 'kind' = any(${PICTURE_KINDS}) and created_at >= ${baseline}`;
    await sql()`delete from analytics_events where event = 'mail_sent' and properties ->> 'kind' like 'owner-%' and created_at >= ${started}`;
    await sql()`delete from analytics_events where event = 'cron_run' and created_at >= ${started}`;

    for (const recipeId of touched) {
      await sql()`delete from audit_logs where action = 'picture.retried' and entity_id = ${recipeId}`;
    }

    const [left] = await sql()<{ accounts: number; alerts: number; images: number; mails: number }>`
      select (select count(*)::int from "user" where email like ${`picture-alerts-%-${String(stamp)}@e2e.invalid`}) as accounts,
             (select count(*)::int from analytics_events where event = 'owner_alerted' and properties ->> 'kind' = any(${PICTURE_KINDS}) and created_at >= ${baseline}) as alerts,
             (select count(*)::int from recipe_images where recipe_id::text = any(${[...touched]})) as images,
             (select count(*)::int from analytics_events where event = 'mail_sent' and properties ->> 'kind' like 'owner-%' and created_at >= ${started}) as mails`;

    return left;
  }

  describe('one failed drawing', () => {
    it('sends one mail, through the real path: the retry route, a drawing that fails, and the mail after it', async () => {
      const target = dish(0);

      // Failed a week ago, before the counts start: this row is not what the mail counts.
      await seed(target.id, new Date(Date.now() - 8 * 24 * HOUR), 'call_failed');
      await retry(mailed, target.id).expect(202);
      await drawn(target.id);
      await until(() => pictureMails().length === 1);

      expect(await status(target.id)).toBe('failed');

      const [mail] = pictureMails();

      expect(mail?.subject).toBe(`${FAILED_SUBJECT}1`);
      // A reason from the closed list, in words, and the count.
      expect(mail?.text).toContain('Por motivo: La llamada falló: 1.');
      expect(mail?.text).toContain(link('/admin/catalogo?picture=failed'));
      expect(mail?.html).toContain(link('/admin/catalogo?picture=failed'));
      expect(mail).toBeDefined();
      expectClean(mail as Sent);

      // The claim carries the kind and nothing else, and no user; the mail is recorded as its own kind.
      const rows = await claims(FAILED);

      expect(rows).toHaveLength(1);
      expect(rows[0]?.userId).toBeNull();
      expect(Object.keys(rows[0]?.properties ?? {})).toEqual(['kind']);
      expect(await claims(REFUSED)).toEqual([]);
      expect(await sentRows()).toEqual([{ ok: true }]);
    }, 60_000);
  });

  describe('three failures inside the hour', () => {
    it('send one mail, and the next call past the hour carries the other two', async () => {
      const [first, second, third] = [dish(0), dish(1), dish(2)];
      const t0 = new Date();
      const alerts = service(mailed);

      await seed(first.id, new Date(t0.getTime() - 30 * MINUTE), 'call_failed');
      await alerts.pictureFailures(t0);
      expect(pictureMails()).toHaveLength(1);
      expect(pictureMails()[0]?.subject).toBe(`${FAILED_SUBJECT}1`);

      // Two more fail after that mail, with the hour not over.
      await seed(second.id, new Date(t0.getTime() + 10 * MINUTE), 'judge_rejected');
      await seed(third.id, new Date(t0.getTime() + 20 * MINUTE), 'call_failed');
      await alerts.pictureFailures(new Date(t0.getTime() + 30 * MINUTE));
      expect(pictureMails()).toHaveLength(1);
      expect(await claims(FAILED)).toHaveLength(1);

      // Past the hour: the two that waited, and not the one already told.
      await alerts.pictureFailures(new Date(t0.getTime() + 61 * MINUTE));
      expect(pictureMails()).toHaveLength(2);

      const mail = pictureMails()[1];

      expect(mail?.subject).toBe(`${FAILED_SUBJECT}2`);
      expect(mail?.text).toContain('La llamada falló: 1');
      expect(mail?.text).toContain('El revisor la rechazó: 1');
      expectClean(mail as Sent);

      // Told, and nothing new since: no third mail.
      await alerts.pictureFailures(new Date(t0.getTime() + 62 * MINUTE));
      expect(pictureMails()).toHaveLength(2);
      expect(await claims(FAILED)).toHaveLength(2);
      expect(await sentRows()).toEqual([{ ok: true }, { ok: true }]);
    });
  });

  describe('a drawing given back', () => {
    it('for the month’s cap mails nothing: the spend alert says it', async () => {
      const target = dish(0);
      const now = new Date();

      await seed(target.id, new Date(now.getTime() - 10 * MINUTE), 'cap_reached', true);
      await service(mailed).pictureFailures(now);

      expect(pictureMails()).toEqual([]);
      expect(await claims(FAILED)).toEqual([]);
      expect(await claims(REFUSED)).toEqual([]);
      expect(await sentRows()).toEqual([]);
    });

    it('for a refused payment or a rate limit mails once — through the real path, a 402 — and not again inside 6 h', async () => {
      const [drawing, second, third] = [dish(0), dish(1), dish(2)];
      const alerts = service(mailed);

      images.error = new PictureCallError('Key limit exceeded', 402);
      await seed(drawing.id, new Date(Date.now() - 8 * 24 * HOUR), 'call_failed');
      await retry(mailed, drawing.id).expect(202);
      await drawn(drawing.id);
      await until(() => pictureMails().length === 1);

      const [mail] = pictureMails();

      expect(mail?.subject).toBe(REFUSED_SUBJECT);
      expect(mail?.text).toContain(link('/admin/catalogo/imagenes'));
      expect(mail?.text).toContain('desde el aviso anterior: 1.');
      expectClean(mail as Sent);

      // A given-back drawing is not a failed dish: only the payment claim is taken.
      const [claim] = await claims(REFUSED);

      expect(claim).toBeDefined();
      expect(await claims(FAILED)).toEqual([]);
      expect(await sentRows()).toEqual([{ ok: true }]);

      const told = new Date(claim?.at ?? '');

      // Two hours later a drawing is refused again, and at 3 h the check runs: still one mail.
      await seed(second.id, new Date(told.getTime() + 2 * HOUR), 'payment_refused', true);
      await alerts.pictureFailures(new Date(told.getTime() + 3 * HOUR));
      expect(pictureMails()).toHaveLength(1);
      expect(await claims(REFUSED)).toHaveLength(1);

      // Past the 6 h, with one more, the two given back since the mail go in one.
      // A rate limit (a 429) is given back too, as `model_refused`, and goes in the same mail.
      await seed(third.id, new Date(told.getTime() + 6.5 * HOUR), 'model_refused', true);
      await alerts.pictureFailures(new Date(told.getTime() + 7 * HOUR));
      expect(pictureMails()).toHaveLength(2);
      expect(pictureMails()[1]?.subject).toBe(REFUSED_SUBJECT);
      expect(pictureMails()[1]?.text).toContain('desde el aviso anterior: 2.');
      expect(pictureMails()[1]?.text).toContain('El proveedor no puede cobrar: 1');
      expect(pictureMails()[1]?.text).toContain('El modelo rechazó la petición: 1');
      expect(await claims(REFUSED)).toHaveLength(2);
      expect(await claims(FAILED)).toEqual([]);
    }, 60_000);
  });

  describe('without OWNER_EMAIL and SMTP', () => {
    it('sends and claims nothing — by the retry route, by the service, and by the cron — while the same rows mail on the other application', async () => {
      const [failing, refused] = [dish(0), dish(1)];

      await seed(failing.id, new Date(Date.now() - 8 * 24 * HOUR), 'call_failed');
      await retry(silent, failing.id).expect(202);
      await drawn(failing.id);
      // A refused payment already on the books, given back a moment ago.
      await seed(refused.id, new Date(Date.now() - MINUTE), 'payment_refused', true);

      await service(silent).pictureFailures();
      await request(httpServer(silent)).get(`/${PREFIX}/cron/reminders`).set('Authorization', `Bearer ${cronSecret}`).expect(200);

      expect(await status(failing.id)).toBe('failed');
      expect(pictureMails()).toEqual([]);
      expect(await claims(FAILED)).toEqual([]);
      expect(await claims(REFUSED)).toEqual([]);
      expect(await sentRows()).toEqual([]);

      // The silence was the environment's: the same rows, asked of the application that may send, go out.
      await service(mailed).pictureFailures();
      expect(pictureMails().map(mail => mail.subject)).toEqual([`${FAILED_SUBJECT}1`, REFUSED_SUBJECT]);
    }, 60_000);
  });

  describe('the crons', () => {
    it.each(['reminders', 'rewrite-steps'])(
      '/cron/%s sends a failure that was waiting, once',
      async path => {
        const target = dish(0);

        // Failed ten minutes ago, with nobody having opened a dish since: nothing but a cron will tell the owner.
        await seed(target.id, new Date(Date.now() - 10 * MINUTE), 'call_failed');
        await cron(path).expect(200);

        expect(pictureMails().map(mail => mail.subject)).toEqual([`${FAILED_SUBJECT}1`]);
        expect(await claims(FAILED)).toHaveLength(1);

        // The next run, the same hour: told already.
        await cron(path).expect(200);
        expect(pictureMails()).toHaveLength(1);
        expect(await claims(FAILED)).toHaveLength(1);
      },
      60_000
    );
  });
});
