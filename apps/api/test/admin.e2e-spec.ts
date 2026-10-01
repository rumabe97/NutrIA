import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { SettingsController } from 'core/controllers/Settings';
import { PRODUCT_EVENTS } from 'core/entities/Analytics';
import { TERMS_VERSION } from 'core/entities/User';
import { UserController } from 'core/controllers/User';
import { database } from 'database';

import { activationToken } from '../src/modules/auth/services/ActivationLink.js';

import {
  auditCount,
  completeOnboarding,
  createApp,
  deleteAccountByEmail,
  deleteAccounts,
  generateAndWait,
  httpServer,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient,
  SEEDED
} from './harness.js';

import type { Account } from './harness.js';
import type { AccountView, Paged } from 'core/controllers/User';
import type {
  AdminAiView,
  AdminAnalyticsView,
  AdminCatalogueQualityView,
  AdminConsentsView,
  AdminGenerationStatsView,
  AdminGenerationsView,
  AdminGenerationView,
  AdminIngredientsView,
  AdminNotificationsView,
  AdminPeopleView,
  AdminPicturesPeriodView,
  AdminPlanQualityView,
  AdminPlansView,
  AdminProductView,
  AdminRecipesView,
  AdminRetentionView,
  AdminSummaryView,
  AdminSystemView,
  CatalogueRecipeView,
  DaySeries
} from 'core/controllers/Admin';
import type { FeedbackView } from 'core/controllers/Feedback';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The owner's own window on the service (`0028`, `0031`).
 *
 * Two things are worth an end-to-end test here and they pull in opposite
 * directions: an ordinary account must not be able to tell that any of these
 * routes exist, and the owner must be able to open an account from them. The
 * first is the one that matters — an admin surface reachable by a signed-in user
 * is a way to read the whole service.
 *
 * Requires a real database — see ./README.md.
 */
const ROUTES = ['accounts', 'settings', 'analytics', 'ai', 'feedback', 'audit'];

/** Gone in phase 9 step 1 (`0068` § Removed): no route answers them at all, admin session or not. */
const REMOVED_ROUTES = ['overview', 'failures'];

/** The console's reads over a period (`0068`, project 007 phases 3 and 5). */
const PERIOD_ROUTES = ['summary', 'product', 'plans', 'people'] as const;

/**
 * Every key the four period reads may carry, at any depth. Exhaustive, so a
 * new field is a decision — and so nothing about a person, a plan's days, a
 * meal or an allergy can ride along.
 */
const PERIOD_KEYS = new Set([
  // every read
  'period',
  'window',
  'from',
  'previousFrom',
  'to',
  'days',
  'values',
  'series',
  'key',
  // summary
  'tiles',
  'totalAccounts',
  'newAccounts',
  'current',
  'previous',
  'sparkline',
  'waitingAccounts',
  'activePeople',
  'plansGenerated',
  'successRate',
  'unreadMessages',
  'pictures',
  'spentUsd',
  'textAi',
  'month',
  'share',
  'sweepPaused',
  'monthSpentUsd',
  'monthStart',
  'capUsd',
  'charts',
  'signUps',
  'generations',
  'needsYou',
  'failedGenerations',
  // product
  'funnel',
  'signedUp',
  'activated',
  'onboarded',
  'planned',
  'confirmed',
  'checkedIn',
  'lived',
  'returned',
  'events',
  // plans
  'byState',
  'status',
  'n',
  'created',
  // people
  'messages',
  'weeks'
]);

/**
 * The only words a period read may say besides days and instants: job states,
 * plan states and the events the console charts. An address, an id, an
 * allergen key, a meal slot or a dish name is none of these.
 */
const PERIOD_WORDS = new Set([
  'queued',
  'running',
  'succeeded',
  'failed',
  'draft',
  'generating',
  'active',
  'completed',
  'archived',
  'pending_review',
  // A system event (`ai_call`, `cron_run`, `mail_sent`, `owner_alerted`) never
  // reaches this page's words: it is not something a person did (`0071`).
  ...PRODUCT_EVENTS
]);

const ALLERGEN_KEYS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
  'lactose',
  'fructose',
  'histamine'
];
const MEAL_SLOTS = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * Every key an account row may carry (`0028`, `0068`), sorted. A snapshot on
 * purpose: a twelfth key — a profile field, a plan, anything about a body or
 * food — fails the suite until somebody decides it belongs here.
 */
const ACCOUNT_KEYS = [
  'activated',
  'createdAt',
  'email',
  'emailVerified',
  'id',
  'lastActiveAt',
  'onboardedAt',
  'plans',
  'professional',
  'role',
  'tier'
];

/** Every key an inbox row carries — unchanged by phase 5. */
const FEEDBACK_KEYS = ['createdAt', 'email', 'handled', 'id', 'kind', 'message'];

/** The calendar day `n` days after `day` (negative for before), on the day's own key. */
function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** The Monday of the ISO week a day belongs to. */
function mondayOf(day: string): string {
  return shiftDay(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
}

/** The Mondays of the weeks the last `period` Madrid days touch, ending on `lastDay`, oldest first — worked out here, not read from the API. */
function expectedWeeks(period: number, lastDay: string): string[] {
  const days = Array.from({ length: period }, (_, i) => shiftDay(lastDay, i - period + 1));

  return [...new Set(days.map(mondayOf))];
}

/**
 * Removes every product event of one account this suite made, so it reads as
 * an account with no recorded activity — which is what an account from before
 * the counting (`0033`) is. Sign-up signs a person in, so no route can make
 * one: written on the table, like `openPractice` in the harness, and only for
 * an `@e2e.invalid` address.
 */
async function forgetActivity(email: string): Promise<void> {
  if (!email.endsWith('@e2e.invalid')) {
    throw new Error(`Refusing to touch a real account's events: ${email}`);
  }

  const sql = (database() as unknown as { readonly $client: <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]> })
    .$client;

  await sql`delete from analytics_events where user_id = (select id from "user" where email = ${email})`;
}

/** The Madrid calendar day of an instant, as the console keys it. */
function madridDay(instant: string): string {
  return new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Madrid', year: 'numeric' }).format(new Date(instant));
}

/** Every key and every string in a body, at any depth. */
function walk(value: unknown, keys: Set<string>, words: Set<string>): void {
  if (typeof value === 'string') {
    words.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, keys, words);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      walk(child, keys, words);
    }
  }
}

/** One day per day of the period, oldest first, consecutive, the Madrid day of the answer last — and, for a series, a count for each. */
function expectDays(series: { readonly days: readonly string[]; readonly values?: readonly number[] }, period: number, to: string): void {
  expect(series.days).toHaveLength(period);
  expect(series.days.at(-1)).toBe(madridDay(to));

  for (let i = 1; i < series.days.length; i++) {
    expect(Date.parse(`${series.days[i]}T12:00:00Z`) - Date.parse(`${series.days[i - 1]}T12:00:00Z`)).toBe(24 * 60 * 60 * 1000);
  }

  if (series.values !== undefined) {
    expect(series.values).toHaveLength(period);
    expect(series.values.every(n => Number.isInteger(n) && n >= 0)).toBe(true);
  }
}

describe('admin', () => {
  let app: INestApplication;
  /** Kept so the catalogue case can prove the model was asked, and so that a dish with a `created_by` exists to leak. */
  let ai: ScriptedAiClient;
  let owner: Account;
  let ordinary: Account;
  let waiting: string;
  /** Every account this suite registered and kept a cookie for; `waiting` and the link test's account never signed in, so `afterAll` deletes those by email instead. */
  const made: string[] = [];
  const byEmail: string[] = [];

  beforeAll(async () => {
    // The pool is for the two generated plans: the people tables' (the `plans` column) and the generation log's.
    ai = new ScriptedAiClient(POOL);
    app = await createApp(ai);

    const stamp = Date.now();

    owner = await register(app, `admin-owner-${stamp}@e2e.invalid`);
    made.push(owner.cookie);
    ordinary = await register(app, `admin-user-${stamp}@e2e.invalid`);
    made.push(ordinary.cookie);
    waiting = `admin-waiting-${stamp}@e2e.invalid`;
    byEmail.push(waiting);

    await request(httpServer(app))
      .post(`/${PREFIX}/auth/sign-up/email`)
      .send({ email: waiting, name: 'Waiting', password: 'correct-horse-battery-staple-9' })
      .expect(200);
    await UserController.grantAdmin(owner.email);
  });

  afterAll(async () => {
    await deleteAccounts(app, made);

    for (const email of byEmail) {
      await deleteAccountByEmail(app, email);
    }

    await app?.close();
  });

  it('does not exist for an ordinary account', async () => {
    for (const route of ROUTES) {
      await request(httpServer(app)).get(`/${PREFIX}/admin/${route}`).set('Cookie', ordinary.cookie).expect(404);
    }

    await request(httpServer(app)).post(`/${PREFIX}/admin/accounts/${ordinary.id}/activate`).set('Cookie', ordinary.cookie).expect(404);
  });

  it('answers the owner', async () => {
    for (const route of ROUTES) {
      await request(httpServer(app)).get(`/${PREFIX}/admin/${route}`).set('Cookie', owner.cookie).expect(200);
    }
  });

  /**
   * `overview` (the single-page tiles) and `failures` (the old failure list)
   * are gone in phase 9 step 1: no route matches, so Nest's router answers
   * 404 before any guard runs — the owner gets exactly the same 404 an
   * ordinary account or no session does, not a 200 that used to be there.
   */
  it('no longer exist, for the owner just as for anybody else', async () => {
    for (const route of REMOVED_ROUTES) {
      await request(httpServer(app)).get(`/${PREFIX}/admin/${route}`).set('Cookie', owner.cookie).expect(404);
      await request(httpServer(app)).get(`/${PREFIX}/admin/${route}`).set('Cookie', ordinary.cookie).expect(404);
      await request(httpServer(app)).get(`/${PREFIX}/admin/${route}`).expect(404);
    }
  });

  it('sends a test notification to the owner alone, and says why when it cannot', async () => {
    await request(httpServer(app)).post(`/${PREFIX}/admin/push-test`).set('Cookie', ordinary.cookie).expect(404);

    const sent: Response = await request(httpServer(app)).post(`/${PREFIX}/admin/push-test`).set('Cookie', owner.cookie).expect(200);

    // The suite has no VAPID keys: nothing can be sent, and the answer says so rather than "sent".
    expect(sent.body).toEqual({ configured: false, delivered: 0, devices: 0 });
  });

  it('lists every account with the state of its two locks, and nothing about anybody', async () => {
    const listed: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);
    const page = listed.body as Paged<AccountView>;
    // Newest first, so the three this suite just made are on the first page
    // however many thousand accounts came before them.
    const queued = page.rows.find(account => account.email === waiting);

    expect(page.total).toBeGreaterThanOrEqual(page.rows.length);
    expect(page.rows.length).toBeLessThanOrEqual(page.size);

    expect(queued).toMatchObject({ activated: false, emailVerified: false });
    // Address, dates, role and tier. A screen that can read what somebody eats is
    // how an admin surface becomes a way to read health data — `tier` is on this
    // list because it is a fact about billing that the owner has to see to know
    // who they granted, and nothing about a person's body or their food ever
    // joins it. The assertion is exhaustive so adding a field is a decision.
    // Phase 5 of project 007 added four milestones — dates, a count and a yes/no — and nothing else (`0068`).
    expect(Object.keys(queued ?? {}).sort()).toEqual(ACCOUNT_KEYS);
  });

  it('opens a waiting account, and the account is open afterwards', async () => {
    const accounts: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);
    const queued = (accounts.body as Paged<AccountView>).rows.find(account => account.email === waiting);

    const opened: Response = await request(httpServer(app))
      .post(`/${PREFIX}/admin/accounts/${queued?.id}/activate`)
      .set('Cookie', owner.cookie)
      .expect(201);

    expect(opened.body).toMatchObject({ email: waiting });

    const after: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);

    expect((after.body as Paged<AccountView>).rows.find(account => account.email === waiting)).toMatchObject({
      activated: true,
      emailVerified: false
    });
  });

  it('throws the activation switch, and the switch is what the product reads', async () => {
    const server = httpServer(app);

    await request(server)
      .patch(`/${PREFIX}/admin/settings`)
      .set('Cookie', owner.cookie)
      .send({ enabled: false, flag: 'automaticActivation' })
      .expect(200);
    await expect(SettingsController.automaticActivation()).resolves.toBe(false);

    const read: Response = await request(server).get(`/${PREFIX}/settings`).set('Cookie', ordinary.cookie).expect(200);

    expect(read.body).toMatchObject({ flags: { automaticActivation: false } });

    await request(server)
      .patch(`/${PREFIX}/admin/settings`)
      .set('Cookie', owner.cookie)
      .send({ enabled: true, flag: 'automaticActivation' })
      .expect(200);
    await expect(SettingsController.automaticActivation()).resolves.toBe(true);
  });

  /**
   * The owner's half of the tier (`0042`): the column moves, and the list says
   * so. That the *allowances* follow is proved where an account has a plan to
   * spend them on — `plan-lifecycle`, which is also where the switch outranking
   * the column can be seen as behaviour rather than as a number.
   *
   * Granted with the `premium` switch off on purpose: that is how the owner sets
   * up who should have it before turning it on, and the grant must not depend on
   * the switch's position.
   */
  it('moves an account between tiers, and the list says which it is on', async () => {
    const server = httpServer(app);

    await request(server).patch(`/${PREFIX}/admin/accounts/${ordinary.id}/tier`).set('Cookie', owner.cookie).send({ tier: 'premium' }).expect(200);

    const listed: Response = await request(server).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);

    expect((listed.body as Paged<AccountView>).rows.find(account => account.id === ordinary.id)).toMatchObject({ tier: 'premium' });

    await request(server).patch(`/${PREFIX}/admin/accounts/${ordinary.id}/tier`).set('Cookie', owner.cookie).send({ tier: 'free' }).expect(200);
  });

  it('answers 404 when the account whose tier is being moved does not exist', async () => {
    await request(httpServer(app))
      .patch(`/${PREFIX}/admin/accounts/usr-nobody/tier`)
      .set('Cookie', owner.cookie)
      .send({ tier: 'premium' })
      .expect(404);
  });

  /*
   * The registry is what says a flag exists. A route that wrote whatever key it
   * was handed would let a typo create a row nothing ever reads, and the switch
   * would look thrown while the product carried on with the fallback.
   */
  it('refuses a flag the registry does not declare', async () => {
    await request(httpServer(app))
      .patch(`/${PREFIX}/admin/settings`)
      .set('Cookie', owner.cookie)
      .send({ enabled: true, flag: 'not_a_flag' })
      .expect(422);
  });

  it('counts the funnel from the rows, so it covers accounts older than the counting', async () => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/analytics`).set('Cookie', owner.cookie).expect(200);
    const view = response.body as AdminAnalyticsView;

    // These accounts were made by this suite, and every one of them signed up
    // and signed in — so the first stage cannot be smaller than the accounts,
    // and somebody came back, because `register` signs in.
    expect(view.funnel.signedUp).toBeGreaterThanOrEqual(3);
    expect(view.funnel.signedUp).toBeGreaterThanOrEqual(view.funnel.activated);
    expect(view.funnel.activated).toBeGreaterThanOrEqual(view.funnel.onboarded);
    expect(view.activity.events.some(row => row.event === 'session_started')).toBe(true);
    expect(view.activity.people).toBeGreaterThan(0);
  });

  it('pages the account list rather than capping it', async () => {
    const server = httpServer(app);
    const first: Response = await request(server).get(`/${PREFIX}/admin/accounts?size=2`).set('Cookie', owner.cookie).expect(200);
    const second: Response = await request(server).get(`/${PREFIX}/admin/accounts?size=2&offset=2`).set('Cookie', owner.cookie).expect(200);
    const one = first.body as Paged<AccountView>;
    const two = second.body as Paged<AccountView>;

    expect(one.rows).toHaveLength(2);
    expect(one.total).toBe(two.total);
    // A page is a different page, not the same rows with a different number on it.
    expect(one.rows.map(row => row.id)).not.toEqual(two.rows.map(row => row.id));
  });

  it('carries a message from the person who wrote it to the owner, and back again', async () => {
    const server = httpServer(app);

    await request(server)
      .post(`/${PREFIX}/feedback`)
      .set('Cookie', ordinary.cookie)
      .send({ kind: 'problem', message: 'La cena sale muy tarde' })
      .expect(204);

    const inbox: Response = await request(server).get(`/${PREFIX}/admin/feedback`).set('Cookie', owner.cookie).expect(200);
    const page = inbox.body as Paged<FeedbackView> & { waiting: number };
    const mine = page.rows.find(row => row.message === 'La cena sale muy tarde');

    // Their words as typed, and the address that makes a reply possible — the
    // one admin read that carries something about a person, because the message
    // was written to be read (`0037`).
    expect(mine).toMatchObject({ email: ordinary.email, handled: false, kind: 'problem' });
    expect(page.waiting).toBeGreaterThan(0);

    // Handled is a note the owner leaves themselves, and it can be taken back.
    await request(server).patch(`/${PREFIX}/admin/feedback/${mine?.id}`).set('Cookie', owner.cookie).send({ handled: true }).expect(204);

    const seen: Response = await request(server).get(`/${PREFIX}/admin/feedback`).set('Cookie', owner.cookie).expect(200);

    expect((seen.body as Paged<FeedbackView>).rows.find(row => row.id === mine?.id)?.handled).toBe(true);

    await request(server).patch(`/${PREFIX}/admin/feedback/${mine?.id}`).set('Cookie', owner.cookie).send({ handled: false }).expect(204);
  });

  it('will not let an ordinary account read what other people wrote', async () => {
    await request(httpServer(app)).get(`/${PREFIX}/admin/feedback`).set('Cookie', ordinary.cookie).expect(404);
  });

  it('refuses an empty message rather than filing it', async () => {
    await request(httpServer(app)).post(`/${PREFIX}/feedback`).set('Cookie', ordinary.cookie).send({ kind: 'idea', message: '   ' }).expect(422);
  });

  /*
   * The button in the owner's mail (`0030`), which nothing covered until it was
   * found dead: the handler is `@Public()` on a controller that is
   * `@Roles('admin')`, so it arrived at `AdminGuard` with no session and a role
   * list it had inherited, and 404'd every click — indistinguishable from a
   * stale token, which is why nobody noticed.
   */
  it('opens an account from the link in the owner\u2019s mail, and refuses a forged one', async () => {
    const server = httpServer(app);
    const email = `admin-link-${Date.now()}@e2e.invalid`;

    byEmail.push(email);
    await request(server).post(`/${PREFIX}/auth/sign-up/email`).send({ email, name: 'Link', password: 'correct-horse-battery-staple-9' }).expect(200);

    const listed: Response = await request(server).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);
    const queued = (listed.body as Paged<AccountView>).rows.find(account => account.email === email);

    expect(queued).toMatchObject({ activated: false });

    const token = activationToken(queued?.id ?? '', process.env.BETTER_AUTH_SECRET ?? '');

    await request(server).get(`/${PREFIX}/admin/activate`).query({ token }).expect(302);

    const after: Response = await request(server).get(`/${PREFIX}/admin/accounts`).set('Cookie', owner.cookie).expect(200);

    expect((after.body as Paged<AccountView>).rows.find(account => account.email === email)).toMatchObject({ activated: true });

    // A forged token is the same 404 as everything else this service denies.
    await request(server).get(`/${PREFIX}/admin/activate`).query({ token: 'not.a.token' }).expect(404);
    await request(server).get(`/${PREFIX}/admin/activate`).expect(404);
  });

  it('refuses an account id that is not an account, and leaves the trail untouched', async () => {
    const before = await auditCount('account.activated');

    await request(httpServer(app)).post(`/${PREFIX}/admin/accounts/not-an-account/activate`).set('Cookie', owner.cookie).expect(404);

    await expect(auditCount('account.activated')).resolves.toBe(before);
  });

  /*
   * The console's reads over a period (`0068`, project 007 phase 3, step 7):
   * counts per Madrid day, compared with the period before — and, like every
   * admin read, nothing about anybody.
   */
  describe('the period reads', () => {
    const read = (route: string, cookie?: string, query?: string) => {
      const call = request(httpServer(app)).get(`/${PREFIX}/admin/${route}${query === undefined ? '' : `?period=${query}`}`);

      return cookie === undefined ? call : call.set('Cookie', cookie);
    };

    it('do not exist for an ordinary account, nor for a caller with no session', async () => {
      for (const route of PERIOD_ROUTES) {
        await read(route, ordinary.cookie).expect(404);
        await read(route).expect(404);
        // The denial comes before the query is read: a bad period is still a
        // 404, never a 422 that tells a stranger the route is there.
        await read(route, ordinary.cookie, '14').expect(404);
        await read(route, undefined, '14').expect(404);
      }
    });

    it('refuse a period other than 7, 30 or 90 as INVALID_INPUT', async () => {
      for (const route of PERIOD_ROUTES) {
        for (const query of ['14', 'seven', '', '-30', '30.5', '7&period=30']) {
          const refused: Response = await read(route, owner.cookie, query);

          // The route and the query in the comparison, so a failure names which one.
          expect({ code: (refused.body as { code?: string }).code, query, route, status: refused.status }).toEqual({
            code: 'INVALID_INPUT',
            query,
            route,
            status: 422
          });
        }
      }
    });

    it('cover 30 days by default, and 7 or 90 when asked', async () => {
      for (const [query, period] of [
        [undefined, 30],
        ['7', 7],
        ['30', 30],
        ['90', 90]
      ] as const) {
        const summary = (await read('summary', owner.cookie, query).expect(200)).body as AdminSummaryView;
        const product = (await read('product', owner.cookie, query).expect(200)).body as AdminProductView;
        const plans = (await read('plans', owner.cookie, query).expect(200)).body as AdminPlansView;

        for (const view of [summary, product, plans]) {
          expect(view.period).toBe(period);
          expect(Date.parse(view.window.previousFrom)).toBeLessThan(Date.parse(view.window.from));
          expect(Date.parse(view.window.from)).toBeLessThan(Date.parse(view.window.to));
        }

        expectDays(summary.charts.signUps, period, summary.window.to);
        expectDays(summary.charts.generations, period, summary.window.to);
        expectDays(summary.tiles.newAccounts.sparkline, period, summary.window.to);
        expectDays(summary.tiles.activePeople.sparkline, period, summary.window.to);
        expectDays(summary.tiles.plansGenerated.sparkline, period, summary.window.to);
        // No text cap in this environment: the tile is the spend and its sparkline, with no month key.
        expect(Object.keys(summary.tiles.textAi).sort()).toEqual(['sparkline', 'spentUsd']);
        expectDays(product.activePeople, period, product.window.to);
        expectDays(product.events, period, product.window.to);
        expectDays(plans.created, period, plans.window.to);

        // Every key present, zeros included, so a legend does not change with what happened.
        expect(summary.charts.generations.series.map(row => row.key)).toEqual(['queued', 'running', 'succeeded', 'failed']);
        expect(plans.byState.map(row => row.status)).toEqual(['draft', 'generating', 'active', 'completed', 'archived', 'failed', 'pending_review']);

        for (const row of [...summary.charts.generations.series, ...product.events.series]) {
          expect(row.values).toHaveLength(period);
        }

        // Exactly the product events, in their own order — no system event
        // (`ai_call`, `cron_run`, `mail_sent`, `owner_alerted`) rides along (`0071`).
        const events = product.events.series.map(row => row.key);

        expect(events).toEqual([...PRODUCT_EVENTS]);
      }
    });

    it('count an account made now in the total, in the period and on today', async () => {
      const before = (await read('summary', owner.cookie).expect(200)).body as AdminSummaryView;
      const email = `admin-period-${Date.now()}@e2e.invalid`;

      byEmail.push(email);
      await request(httpServer(app))
        .post(`/${PREFIX}/auth/sign-up/email`)
        .send({ email, name: 'Period', password: 'correct-horse-battery-staple-9' })
        .expect(200);

      const after = (await read('summary', owner.cookie).expect(200)).body as AdminSummaryView;
      const sum = (series: DaySeries) => series.values.reduce((total, n) => total + n, 0);

      expect(after.tiles.totalAccounts).toBeGreaterThanOrEqual(before.tiles.totalAccounts + 1);
      expect(after.tiles.newAccounts.current).toBeGreaterThanOrEqual(before.tiles.newAccounts.current + 1);
      // Nobody opened it, so it waits — on the tile and in what needs the owner.
      expect(after.tiles.waitingAccounts).toBeGreaterThanOrEqual(before.tiles.waitingAccounts + 1);
      expect(after.needsYou.waitingAccounts).toBe(after.tiles.waitingAccounts);

      // The chart is the tile, day by day: the same window over the same rows.
      expect(sum(after.charts.signUps)).toBe(after.tiles.newAccounts.current);
      expect(after.tiles.newAccounts.sparkline).toEqual(after.charts.signUps);

      // Today is the last day. If a Madrid midnight fell between the two reads,
      // the last day is a new one and holds this account, alone or not.
      const today = after.charts.signUps.values.at(-1) ?? 0;

      if (before.charts.signUps.days.at(-1) === after.charts.signUps.days.at(-1)) {
        expect(today).toBeGreaterThanOrEqual((before.charts.signUps.values.at(-1) ?? 0) + 1);
      } else {
        expect(today).toBeGreaterThanOrEqual(1);
      }
    });

    it('carry counts, and nothing about anybody', async () => {
      for (const route of PERIOD_ROUTES) {
        const body: unknown = (await read(route, owner.cookie).expect(200)).body;
        const keys = new Set<string>();
        const words = new Set<string>();

        walk(body, keys, words);

        // No meal, no plan day, no profile field, no allergen: every key is one the console declared…
        expect({ route, stray: [...keys].filter(key => !PERIOD_KEYS.has(key)) }).toEqual({ route, stray: [] });

        // …and every string is a day, an instant, a state or a charted event — never an address, an id or an allergen.
        expect({ route, stray: [...words].filter(word => !DAY.test(word) && !INSTANT.test(word) && !PERIOD_WORDS.has(word)) }).toEqual({
          route,
          stray: []
        });

        for (const word of [...ALLERGEN_KEYS, ...MEAL_SLOTS]) {
          expect(words.has(word)).toBe(false);
        }

        const text = JSON.stringify(body);

        // And the plain substring check, case-insensitive, over keys and values
        // alike. No legitimate key or word contains any of these (`name` included:
        // checked against the real bodies), so no key-level fallback is needed.
        for (const term of ['userid', 'email', 'name', 'meal', 'recipe', 'allerg', 'profile']) {
          expect({ found: text.toLowerCase().includes(term), route, term }).toEqual({ found: false, route, term });
        }

        for (const account of [owner, ordinary]) {
          expect(text).not.toContain(account.email);
          expect(text).not.toContain(account.id);
        }
      }
    });
  });

  /*
   * The people tables (`0068`, project 007 phase 5): accounts and the inbox
   * searched, filtered, sorted and paged in SQL, and the weekly sign-ups and
   * messages behind them. The professionals table's search and sort are in
   * `professionals.e2e-spec.ts`, beside its grants.
   *
   * Every account here carries one token in its address, so each assertion is
   * scoped with `q` to what this block made and no other suite's accounts can
   * move it. Seven accounts: `busy` has every milestone, `waiting` none, and
   * the rest each differ from `plain` in one thing.
   */
  describe('the people tables', () => {
    const TABLE_ROUTES = ['accounts', 'feedback', 'professionals', 'people', 'audit'] as const;
    const token = `tbl${Date.now()}`;
    const address = (suffix: string) => `admin-${token}-${suffix}@e2e.invalid`;
    /** Registered, both locks open, nothing else. */
    let plain: Account;
    /** Every milestone: signed in, onboarded, one plan, and granted professional. */
    let busy: Account;
    /** Granted professional by the owner. */
    let pro: Account;
    /** An administrator. */
    let admin: Account;
    /** On the premium tier. */
    let premium: Account;
    /** Signed up only: no lock open, and no recorded activity (see `forgetActivity`). */
    const waitingEmail = address('waiting');
    /** Signed up and confirmed its address; the owner has not opened it; no recorded activity. */
    const confirmedEmail = address('confirmed');
    /** Every address this block made, in address order — what `sort=email&dir=asc` must give. Letters only, none a prefix of another, so any collation agrees. */
    const all = ['admin', 'busy', 'confirmed', 'plain', 'premium', 'pro', 'waiting'].map(address);

    const get = (path: string, cookie?: string) => {
      const call = request(httpServer(app)).get(`/${PREFIX}/admin/${path}`);

      return cookie === undefined ? call : call.set('Cookie', cookie);
    };

    const accounts = async (query: string): Promise<Paged<AccountView>> =>
      (await get(`accounts?${query}`, owner.cookie).expect(200)).body as Paged<AccountView>;
    const emails = (page: Paged<AccountView>) => page.rows.map(row => row.email);

    /** The query is in the comparison, so a failure names the filter that let the wrong account through. */
    const expectOnly = async (query: string, expected: readonly string[]) => {
      const page = await accounts(`q=${token}&${query}`);

      expect({ emails: [...emails(page)].sort(), query, total: page.total }).toEqual({ emails: [...expected].sort(), query, total: expected.length });
    };

    const inbox = async (query: string) =>
      (await get(`feedback?${query}`, owner.cookie).expect(200)).body as Paged<FeedbackView> & { waiting: number };

    beforeAll(async () => {
      const server = httpServer(app);

      plain = await register(app, address('plain'));
      made.push(plain.cookie);
      busy = await register(app, address('busy'));
      made.push(busy.cookie);
      pro = await register(app, address('pro'));
      made.push(pro.cookie);
      admin = await register(app, address('admin'));
      made.push(admin.cookie);
      premium = await register(app, address('premium'));
      made.push(premium.cookie);
      byEmail.push(waitingEmail, confirmedEmail);

      for (const email of [waitingEmail, confirmedEmail]) {
        await request(server)
          .post(`/${PREFIX}/auth/sign-up/email`)
          .send({ email, name: 'Table', password: 'correct-horse-battery-staple-9' })
          .expect(200);
      }

      await UserController.confirmAddress(confirmedEmail);
      await forgetActivity(waitingEmail);
      await forgetActivity(confirmedEmail);

      await completeOnboarding(app, busy);
      expect((await generateAndWait(app, busy)).status).toBe('succeeded');

      for (const who of [busy, pro]) {
        await request(server)
          .post(`/${PREFIX}/admin/accounts/${who.id}/professional`)
          .set('Cookie', owner.cookie)
          .send({ collegiateNumber: `28/${token.slice(-6)}` })
          .expect(201);
      }

      await UserController.grantAdmin(admin.email);
      await request(server).patch(`/${PREFIX}/admin/accounts/${premium.id}/tier`).set('Cookie', owner.cookie).send({ tier: 'premium' }).expect(200);
    }, 120_000);

    it('do not exist for an ordinary account, nor for a caller with no session — even with a query they would refuse', async () => {
      // The guard runs before the query is read: never a 422 that tells a stranger the route is there.
      const refusable = [
        'accounts?sort=nonsense',
        'accounts?q=a%00b',
        'feedback?state=x',
        'professionals?sort=x',
        'people?period=14',
        'audit?action=nope&size=0'
      ];

      for (const path of [...TABLE_ROUTES, ...refusable, ...TABLE_ROUTES.map(route => `${route}?sort=nope&size=0&period=14`)]) {
        const asOrdinary: Response = await get(path, ordinary.cookie);
        const asNobody: Response = await get(path);

        expect({ nobody: asNobody.status, ordinary: asOrdinary.status, path }).toEqual({ nobody: 404, ordinary: 404, path });
      }
    });

    it('find accounts by address, case-insensitively, and count only the matches', async () => {
      await expectOnly('', all);

      const shouted = await accounts(`q=${token.toUpperCase()}`);

      expect([...emails(shouted)].sort()).toEqual(all);
    });

    it('search literally: % and _ are characters, not wildcards', async () => {
      // A `-` sits between the token and the suffix in every address: as
      // wildcards, `_` would match it and `%` would match anything.
      for (const q of [`${token}_plain`, `${token}%plain`, `admin%${token}`, `${token}\\`]) {
        const page = await accounts(`q=${encodeURIComponent(q)}`);

        expect({ q, total: page.total }).toEqual({ q, total: 0 });
      }

      // The same text with the real character finds the one account.
      expect(emails(await accounts(`q=${encodeURIComponent(`${token}-plain`)}`))).toEqual([plain.email]);

      // And against Postgres with the character in the address: `a_b` finds `a_b` and not `axb`.
      const lit = `lit${Date.now()}`;
      const underscore = `admin-${lit}-a_b@e2e.invalid`;
      const lookalike = `admin-${lit}-axb@e2e.invalid`;

      byEmail.push(underscore, lookalike);

      for (const email of [underscore, lookalike]) {
        await request(httpServer(app))
          .post(`/${PREFIX}/auth/sign-up/email`)
          .send({ email, name: 'Literal', password: 'correct-horse-battery-staple-9' })
          .expect(200);
      }

      expect(emails(await accounts(`q=${encodeURIComponent(`${lit}-a_b`)}`))).toEqual([underscore]);
      expect(emails(await accounts(`q=${encodeURIComponent(`${lit}-axb`)}`))).toEqual([lookalike]);
      expect(emails(await accounts(`q=${lit}&sort=email&dir=asc`))).toEqual([underscore, lookalike]);
    });

    it('narrow by each filter, and by its opposite', async () => {
      const others = (...excluded: string[]) => all.filter(email => !excluded.includes(email));

      await expectOnly('confirmed=no', [waitingEmail]);
      await expectOnly('confirmed=yes', others(waitingEmail));
      await expectOnly('activated=no', [waitingEmail, confirmedEmail]);
      await expectOnly('activated=yes', others(waitingEmail, confirmedEmail));
      await expectOnly('onboarded=yes', [busy.email]);
      await expectOnly('onboarded=no', others(busy.email));
      await expectOnly('professional=yes', [busy.email, pro.email]);
      await expectOnly('professional=no', others(busy.email, pro.email));
      await expectOnly('role=admin', [admin.email]);
      await expectOnly('role=user', others(admin.email));
      await expectOnly('tier=premium', [premium.email]);
      await expectOnly('tier=free', others(premium.email));
      // Filters combine: confirmed but not opened is the one account that is both.
      await expectOnly('confirmed=yes&activated=no', [confirmedEmail]);
    });

    it('carry each account’s milestones, and exactly the eleven keys', async () => {
      const page = await accounts(`q=${token}`);
      const row = (email: string) => page.rows.find(account => account.email === email);

      for (const account of page.rows) {
        expect({ email: account.email, keys: Object.keys(account).sort() }).toEqual({ email: account.email, keys: ACCOUNT_KEYS });
      }

      // And on the unfiltered first page, where other suites' accounts are.
      for (const account of (await accounts('')).rows) {
        expect({ email: account.email, keys: Object.keys(account).sort() }).toEqual({ email: account.email, keys: ACCOUNT_KEYS });
      }

      // Every milestone, each on the account it belongs to: a plan, a sign-in
      // (`register` signs in, and `session_started` is what `lastActiveAt`
      // reads), the owner's grant and the day onboarding finished — today (a
      // day either side allowed, so the suite does not depend on which zone
      // the day was taken in near midnight).
      const full = row(busy.email);
      const today = madridDay(new Date().toISOString());

      expect(full).toMatchObject({ plans: 1, professional: true });
      expect(full?.lastActiveAt).toMatch(INSTANT);
      expect(full?.onboardedAt).toMatch(DAY);
      expect([shiftDay(today, -1), today, shiftDay(today, 1)]).toContain(full?.onboardedAt);
      // None: no recorded activity, never onboarded, no plan, no grant.
      expect(row(waitingEmail)).toMatchObject({
        activated: false,
        emailVerified: false,
        lastActiveAt: null,
        onboardedAt: null,
        plans: 0,
        professional: false
      });

      expect(row(plain.email)).toMatchObject({ onboardedAt: null, plans: 0, professional: false, role: 'user', tier: 'free' });
      expect(row(plain.email)?.lastActiveAt).toMatch(INSTANT);
      expect(row(pro.email)).toMatchObject({ onboardedAt: null, plans: 0, professional: true });
      expect(row(admin.email)).toMatchObject({ professional: false, role: 'admin', tier: 'free' });
      expect(row(premium.email)).toMatchObject({ role: 'user', tier: 'premium' });
      expect(row(confirmedEmail)).toMatchObject({ activated: false, emailVerified: true, lastActiveAt: null });
    });

    /*
     * `professional` is the owner's grant, not the switch (`0059`): the table
     * is about the grant its row actions change. A revoke takes it off on the
     * next read, and the filter agrees with the column every time.
     */
    it('say professional while the grant stands, whatever the switch, and not after a revoke', async () => {
      const server = httpServer(app);
      const setSwitch = (enabled: boolean) =>
        request(server).patch(`/${PREFIX}/admin/settings`).set('Cookie', owner.cookie).send({ enabled, flag: 'professional' }).expect(200);

      const expectProfessional = async (email: string, professional: boolean) => {
        const page = await accounts(`q=${encodeURIComponent(email)}`);
        const yes = emails(await accounts(`q=${token}&professional=yes`));
        const no = emails(await accounts(`q=${token}&professional=no`));

        expect({ email, inNo: no.includes(email), inYes: yes.includes(email), professional: page.rows[0]?.professional }).toEqual({
          email,
          inNo: !professional,
          inYes: professional,
          professional
        });
      };

      try {
        for (const enabled of [false, true]) {
          await setSwitch(enabled);
          await expectProfessional(pro.email, true);
        }
      } finally {
        // The switch fails off; leave it where it is on a fresh database.
        await setSwitch(false);
      }

      await request(server).delete(`/${PREFIX}/admin/accounts/${pro.id}/professional`).set('Cookie', owner.cookie).expect(204);
      await expectProfessional(pro.email, false);
      await expectProfessional(busy.email, true);
    });

    it('sort by address both ways, and newest first when asked nothing', async () => {
      expect(emails(await accounts(`q=${token}&sort=email&dir=asc`))).toEqual(all);
      expect(emails(await accounts(`q=${token}&sort=email&dir=desc`))).toEqual([...all].reverse());

      const byDefault = await accounts(`q=${token}`);
      const created = byDefault.rows.map(row => Date.parse(row.createdAt));

      expect(created).toEqual([...created].sort((a, b) => b - a));
      expect(emails(await accounts(`q=${token}&sort=createdAt&dir=asc`))).toEqual([...emails(byDefault)].reverse());
    });

    it('sort by plans, the account with one at the right end', async () => {
      const desc = await accounts(`q=${token}&sort=plans&dir=desc`);
      const asc = await accounts(`q=${token}&sort=plans&dir=asc`);

      expect(desc.rows.map(row => row.plans)).toEqual([1, 0, 0, 0, 0, 0, 0]);
      expect(desc.rows[0]?.email).toBe(busy.email);
      expect(asc.rows.at(-1)?.email).toBe(busy.email);
    });

    it('sort by last activity, the accounts never seen last either way', async () => {
      for (const dir of ['asc', 'desc'] as const) {
        const page = await accounts(`q=${token}&sort=lastActiveAt&dir=${dir}`);
        const seen = page.rows.filter(row => row.lastActiveAt !== null).map(row => Date.parse(row.lastActiveAt ?? ''));
        const firstNull = page.rows.findIndex(row => row.lastActiveAt === null);

        // The two with no recorded activity are the nulls, and they close the list whichever way it runs.
        expect({
          dir,
          firstNull,
          nulls: page.rows
            .slice(firstNull)
            .map(row => row.email)
            .sort()
        }).toEqual({ dir, firstNull: all.length - 2, nulls: [confirmedEmail, waitingEmail] });
        expect(seen).toEqual([...seen].sort((a, b) => (dir === 'asc' ? a - b : b - a)));
      }
    });

    it('page the matches: every account once, and the same total on every page', async () => {
      const pages = await Promise.all([0, 3, 6].map(offset => accounts(`q=${token}&sort=email&dir=asc&size=3&offset=${offset}`)));

      expect(pages.map(page => [page.offset, page.size, page.rows.length, page.total])).toEqual([
        [0, 3, 3, 7],
        [3, 3, 3, 7],
        [6, 3, 1, 7]
      ]);
      expect(pages.flatMap(emails)).toEqual(all);

      // `?offset=N` alone, as the console asked before phase 5, still answers with the default size.
      const alone = await accounts('offset=1');

      expect({ offset: alone.offset, size: alone.size }).toEqual({ offset: 1, size: 25 });
    });

    it('drop a key they do not know rather than read it as a filter', async () => {
      const page = await accounts(`q=${token}&colour=blue&email=${encodeURIComponent(plain.email)}`);

      expect(page.total).toBe(all.length);
    });

    it('refuse anything outside an allow-list, a repeated parameter and a NUL, as INVALID_INPUT', async () => {
      const paths = [
        ...[
          'sort=password',
          'sort=createdAt;drop',
          'dir=sideways',
          'size=0',
          'size=101',
          'size=abc',
          'offset=-1',
          'offset=1000001',
          'confirmed=maybe',
          'activated=true',
          'onboarded=1',
          'professional=si',
          'tier=gold',
          'role=owner',
          'sort=email&sort=plans',
          `q=${token}&q=plain`,
          // A NUL in the search: Postgres cannot hold one in text, so it is refused before any query.
          'q=a%00b',
          'q=%00'
        ].map(query => `accounts?${query}`),
        ...['sort=email', 'state=unread', 'dir=up', 'size=0', 'size=101', 'offset=-1', 'state=seen&state=waiting', 'q=a%00b'].map(
          query => `feedback?${query}`
        ),
        ...['sort=createdAt', 'dir=up', 'sort=email&sort=links', 'q=a&q=b', 'q=a%00b'].map(query => `professionals?${query}`),
        ...['period=14', 'period=7&period=30'].map(query => `people?${query}`)
      ];
      const answers: { code: string | undefined; path: string; status: number }[] = [];

      // Every answer collected before comparing, so one run names every path that is not refused.
      for (const path of paths) {
        const response: Response = await get(path, owner.cookie);

        answers.push({ code: (response.body as { code?: string }).code, path, status: response.status });
      }

      expect(answers).toEqual(paths.map(path => ({ code: 'INVALID_INPUT', path, status: 422 })));
    });

    it('find a message by its words or by who wrote it, filter by state, and keep waiting the whole inbox', async () => {
      const server = httpServer(app);
      const send = (account: Account, message: string) =>
        request(server).post(`/${PREFIX}/feedback`).set('Cookie', account.cookie).send({ kind: 'idea', message }).expect(204);

      await send(plain, `${token} uno`);
      await send(premium, `${token} dos`);
      // No token in the words: only the sender's address can find this one.
      await send(busy, 'Un mensaje sin sello');

      const mine = await inbox(`q=${token}`);
      const dos = mine.rows.find(row => row.message === `${token} dos`);

      expect(mine.total).toBe(3);
      expect(mine.rows.map(row => row.email).sort()).toEqual([busy.email, plain.email, premium.email].sort());

      for (const row of mine.rows) {
        expect(Object.keys(row).sort()).toEqual(FEEDBACK_KEYS);
      }

      await request(server).patch(`/${PREFIX}/admin/feedback/${dos?.id}`).set('Cookie', owner.cookie).send({ handled: true }).expect(204);

      const everything = await inbox('');
      const waiting = await inbox(`q=${token}&state=waiting`);
      const seen = await inbox(`q=${token}&state=seen`);
      const every = await inbox(`q=${token}&state=all`);

      expect({ messages: waiting.rows.map(row => row.message).sort(), total: waiting.total }).toEqual({
        messages: [`${token} uno`, 'Un mensaje sin sello'].sort(),
        total: 2
      });
      expect({ messages: seen.rows.map(row => row.message), total: seen.total }).toEqual({ messages: [`${token} dos`], total: 1 });
      expect(every.total).toBe(3);

      // `waiting` is the inbox's own count, whatever the filters narrowed the rows to.
      expect(everything.waiting).toBeGreaterThanOrEqual(2);

      for (const page of [waiting, seen, every, await inbox(`q=nobody-wrote-this-${token}`)]) {
        expect(page.waiting).toBe(everything.waiting);
      }

      // Literal here too: `_` does not match the space, and `%` matches only a `%`.
      expect((await inbox(`q=${encodeURIComponent(`${token}_uno`)}`)).total).toBe(0);
      expect((await inbox(`q=${encodeURIComponent(`${token}%dos`)}`)).total).toBe(0);

      // Newest first by default, oldest first when asked; a page of one still counts all three.
      const newest = every.rows.map(row => Date.parse(row.createdAt));

      expect(newest).toEqual([...newest].sort((a, b) => b - a));
      expect((await inbox(`q=${token}&dir=asc`)).rows.map(row => row.id)).toEqual(every.rows.map(row => row.id).reverse());

      const one = await inbox(`q=${token}&size=1&offset=1`);

      expect({ offset: one.offset, rows: one.rows.length, size: one.size, total: one.total }).toEqual({ offset: 1, rows: 1, size: 1, total: 3 });
    });

    it('count sign-ups and messages per Madrid ISO week, named by their Monday, oldest first', async () => {
      for (const [query, period] of [
        [undefined, 30],
        ['7', 7],
        ['30', 30],
        ['90', 90]
      ] as const) {
        const view = (await get(`people${query === undefined ? '' : `?period=${query}`}`, owner.cookie).expect(200)).body as AdminPeopleView;
        const weeks = expectedWeeks(period, madridDay(view.window.to));
        const whole = Math.ceil(period / 7);

        expect(Object.keys(view).sort()).toEqual(['messages', 'period', 'signUps', 'window']);
        expect(view.period).toBe(period);
        // 7 days touch one or two weeks, 30 days five or six, 90 days thirteen or fourteen.
        expect([whole, whole + 1]).toContain(weeks.length);

        for (const monday of weeks) {
          expect(new Date(`${monday}T12:00:00Z`).getUTCDay()).toBe(1);
        }

        for (const series of [view.signUps, view.messages]) {
          expect(Object.keys(series).sort()).toEqual(['values', 'weeks']);
          expect(series.weeks).toEqual(weeks);
          expect(series.values).toHaveLength(weeks.length);
          expect(series.values.every(n => Number.isInteger(n) && n >= 0)).toBe(true);
        }

        // The weeks are the summary's days, folded: the same window over the same accounts.
        const summary = (await get(`summary?period=${period}`, owner.cookie).expect(200)).body as AdminSummaryView;

        expect(view.signUps.values.reduce((total, n) => total + n, 0)).toBe(summary.tiles.newAccounts.current);
      }
    });

    it('count a sign-up and a message made now in the current week', async () => {
      const before = (await get('people?period=7', owner.cookie).expect(200)).body as AdminPeopleView;
      const email = address('weekly');

      byEmail.push(email);
      await request(httpServer(app))
        .post(`/${PREFIX}/auth/sign-up/email`)
        .send({ email, name: 'Weekly', password: 'correct-horse-battery-staple-9' })
        .expect(200);
      await request(httpServer(app))
        .post(`/${PREFIX}/feedback`)
        .set('Cookie', admin.cookie)
        .send({ kind: 'idea', message: `${token} semanal` })
        .expect(204);

      const after = (await get('people?period=7', owner.cookie).expect(200)).body as AdminPeopleView;
      const current = mondayOf(madridDay(after.window.to));

      expect(after.signUps.weeks.at(-1)).toBe(current);

      // If a Madrid Monday midnight fell between the two reads, the current week is a new one and holds these, alone or not.
      const sameWeek = before.signUps.weeks.at(-1) === current;

      for (const key of ['signUps', 'messages'] as const) {
        const was = sameWeek ? (before[key].values.at(-1) ?? 0) : 0;
        const now = after[key].values.at(-1) ?? 0;

        expect({ grew: now >= was + 1, key }).toEqual({ grew: true, key });
      }
    });
  });

  /*
   * Registro, IA, Imágenes and the catalogue (`0068`, project 007 phase 7):
   * the generation log filtered and paged in SQL with its charts, the AI and
   * pictures pages over a period, and the shared catalogue, read only.
   *
   * The log's filter cases run over rows this block controls: one generation
   * the pipeline really ran for `log` (succeeded, with its model calls), and
   * four failed jobs written on the table — a failure the pipeline cannot be
   * made to produce on demand against a seeded library, which backs a model
   * that gives up with the whole catalogue. Those four carry a code of this
   * run's own (`E2E_GEN…`) and times the block chose, so `code`, `since`,
   * `from`/`to` and the order are asserted against known rows, and `q` scopes
   * every other assertion to them. What that proves is the filters and the
   * paging over the log's real query; that the pipeline writes a failure is
   * `generation.e2e-spec.ts`'s and `care-review.e2e-spec.ts`'s.
   */
  describe('the generation log, AI, pictures and the catalogue', () => {
    const gt = `gen${Date.now()}`;
    const CODE = `E2E_${gt.toUpperCase()}`;
    const address = (suffix: string) => `admin-${gt}-${suffix}@e2e.invalid`;
    const HOUR = 60 * 60 * 1000;
    /** Signed up only; each has one failed job, and their addresses differ by `_` against `x`. */
    const underscoreEmail = address('a_b');
    const lookalikeEmail = address('axb');
    /** Registered, onboarded, one real generation. */
    let log: Account;
    /** When each written job was made, fixed before any is written. */
    const at = { lookalike: new Date(), old: new Date(), recent: new Date(), underscore: new Date() };
    /** The real job's id, from the log itself. */
    let realJobId: string;
    /** How many times the model was asked by this block's generation. */
    let asked = 0;

    /** Every key a log row carries: the job, its account, its calls and its plan (`0050`). Unchanged by phase 7. */
    const GENERATION_KEYS = ['account', 'attempts', 'calls', 'code', 'detail', 'finishedAt', 'id', 'plan', 'seconds', 'startedAt', 'status', 'step'];
    const RECIPE_KEYS = [
      'allergens',
      'carbsG',
      'fatG',
      'id',
      'kcal',
      'locale',
      'mayContain',
      'mealSlots',
      'name',
      'picture',
      'pictureAcceptedByHand',
      'pictureCandidate',
      'pictureReason',
      'proteinG',
      'retryableAt',
      'slug',
      'source'
    ];
    const INGREDIENT_KEYS = [
      'allergens',
      'carbsPer100g',
      'category',
      'countries',
      'fatPer100g',
      'kcalPer100g',
      'mayContain',
      'mealSlots',
      'name',
      'proteinPer100g',
      'slug'
    ];
    /** Words no catalogue key may be: nothing that names or points at a person. */
    const PERSON_KEYS = ['id', 'userId', 'user_id', 'createdBy', 'created_by', 'email', 'account', 'user'];

    const get = (path: string, cookie?: string) => {
      const call = request(httpServer(app)).get(`/${PREFIX}/admin/${path}`);

      return cookie === undefined ? call : call.set('Cookie', cookie);
    };

    const generations = async (query: string) => (await get(`generations?${query}`, owner.cookie).expect(200)).body as AdminGenerationsView;
    const recipes = async (query: string) => (await get(`catalogue/recipes?${query}`, owner.cookie).expect(200)).body as AdminRecipesView;
    const ingredients = async (query: string) => (await get(`catalogue/ingredients?${query}`, owner.cookie).expect(200)).body as AdminIngredientsView;

    /** A row as this block recognises it: whose, which outcome, and when it started. */
    const who = (row: AdminGenerationView) => [row.account.email, row.status, row.startedAt];

    type Sql = <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]>;
    const sql = () => (database() as unknown as { readonly $client: Sql }).$client;

    /**
     * Writes one failed generation for an `@e2e.invalid` account, made at
     * `createdAt`, started then and finished five seconds later. The account's
     * deletion takes it (`plan_generation_jobs.user_id` cascades).
     */
    async function writeFailedJob(email: string, createdAt: Date, aiCalls: readonly Record<string, unknown>[] | null = null): Promise<void> {
      if (!email.endsWith('@e2e.invalid')) {
        throw new Error(`Refusing to write a job for a real account: ${email}`);
      }

      const finishedAt = new Date(createdAt.getTime() + 5000);
      const written = await sql()<{ id: string }>`
        insert into plan_generation_jobs (user_id, status, error, attempts, step, created_at, started_at, finished_at, ai_calls)
        select id, 'failed', ${CODE}, 1, 'SCHEDULING_MEALS', ${createdAt.toISOString()}, ${createdAt.toISOString()}, ${finishedAt.toISOString()},
          ${aiCalls === null ? null : JSON.stringify(aiCalls)}::jsonb
        from "user" where email = ${email}
        returning id`;

      if (written.length !== 1) {
        throw new Error(`No account to write a job for: ${email}`);
      }
    }

    /** A model call as `AiCallRecord` stores it, that dropped dishes for the person's allergy and way of eating, and for two reasons of the model's own. */
    const REJECTING_CALL = {
      answeredModel: 'e2e/scripted',
      cache: null,
      cachedInputTokens: null,
      comboTrace: null,
      correlationId: null,
      costUsd: null,
      dishes: 10,
      error: null,
      gatewayMs: null,
      inputTokens: 100,
      kept: 0,
      model: 'e2e/scripted',
      ms: 1200,
      outputTokens: 200,
      provider: null,
      reasoningTokens: null,
      rejected: { allergen: 4, schema: 3, unwanted: 2, wrong_meal: 1 },
      requestId: null,
      round: 1,
      session: null,
      slot: 'lunch'
    };

    const WINDOW_KEYS = ['from', 'previousFrom', 'to', 'days', 'values', 'series', 'key'];
    /**
     * Every key each read may carry, at any depth. Exhaustive, like
     * `PERIOD_KEYS`: a new field is a decision. None of the three period reads
     * has a `name`, an `email`, an `id` or anything of a person.
     */
    const STATS_KEYS = new Set([
      ...WINDOW_KEYS,
      'durations',
      'failuresByCode',
      'outcomes',
      'period',
      'rejectionsByReason',
      'window',
      'p50',
      'p95',
      'code',
      'n',
      'reason'
    ]);
    /**
     * Every key `/admin/ai` may carry, at any depth — the period's fields
     * only since phase 9 step 1 (`0068` § Removed): today's quota readout
     * (`byModel`, `calls`, `inputTokens`, `lastRefusal`, `limits`, `model`,
     * `outputTokens`, `refused`, `resetsAt` and their nested `at`, `limit`,
     * `retryAfterSeconds`, `requestsPerDay`, `tokensPerMinute`) is gone.
     * `calls`, `inputTokens`, `model`, `outputTokens`, `averageMs`, `costUsd`,
     * `failed`, `provider` and `reasoningTokens` stay: they are `AiModelUsage`,
     * the shape of each row in `models` and of each key under `totals`.
     */
    const AI_KEYS = new Set([
      ...WINDOW_KEYS,
      'averageMs',
      'calls',
      'costUsd',
      'failed',
      'inputTokens',
      'model',
      'outputTokens',
      'provider',
      'reasoningTokens',
      'callsPerDay',
      // The text models' month (`0071`, phase 4); the cap's three keys only with a cap.
      'byFeature',
      'feature',
      'month',
      'monthStart',
      'share',
      'spentUsd',
      'sweepPaused',
      'uncostedCalls',
      'models',
      'period',
      'spendPerDay',
      'tokensPerDay',
      'totals',
      'window',
      'current',
      'previous'
    ]);
    const PICTURE_KEYS = new Set([
      ...WINDOW_KEYS,
      'acceptedByHand',
      'capUsd',
      'drawing',
      'enabled',
      'failed',
      'failedByReason',
      'n',
      'period',
      'ready',
      'reason',
      'released',
      'releasedByReason',
      'since',
      'spendPerDay',
      'spentUsd',
      'window'
    ]);
    /** `name` is the dish's or the ingredient's here — the catalogue is reference data, and names nobody. */
    const RECIPE_BODY_KEYS = new Set([
      'counts',
      'offset',
      'rows',
      'size',
      'total',
      'bySlot',
      'bySource',
      'withoutImage',
      'n',
      'slot',
      'source',
      // What a row's `pictureCandidate` carries when a dish holds one (`0072`): its flagged ingredients and its expiry, never where its file is.
      'expiresAt',
      'ingredients',
      ...RECIPE_KEYS
    ]);
    /** One recipe on its own (`0072`): the row, its served ingredients with their `grams`, and the public address of its picture once it is ready. */
    const RECIPE_ONE_KEYS = new Set([...RECIPE_BODY_KEYS, 'grams', 'pictureUrl']);
    const INGREDIENT_BODY_KEYS = new Set(['offset', 'rows', 'size', 'total', ...INGREDIENT_KEYS]);

    /**
     * A body says nothing about anybody: every key is one the read declares,
     * no string is an address, and neither an address nor an id of the
     * suite's accounts appears anywhere — nor `gt`, which every address and
     * every name this block made carries.
     */
    const expectNobody = (label: string, body: unknown, allowed: ReadonlySet<string>) => {
      const keys = new Set<string>();
      const words = new Set<string>();

      walk(body, keys, words);

      expect({ label, stray: [...keys].filter(key => !allowed.has(key)) }).toEqual({ label, stray: [] });
      expect({ addresses: [...words].filter(word => word.includes('@')), label }).toEqual({ addresses: [], label });

      const text = JSON.stringify(body);

      for (const account of [owner, ordinary, log]) {
        expect({ found: text.includes(account.email) || text.includes(account.id), label }).toEqual({ found: false, label });
      }

      expect({ found: text.includes(gt), label }).toEqual({ found: false, label });
    };

    beforeAll(async () => {
      const now = Date.now();

      at.recent = new Date(now - HOUR);
      at.underscore = new Date(now - 2 * HOUR);
      at.lookalike = new Date(now - 3 * HOUR);
      at.old = new Date(now - 10 * 24 * HOUR);

      log = await register(app, address('log'));
      made.push(log.cookie);
      byEmail.push(underscoreEmail, lookalikeEmail);

      for (const email of [underscoreEmail, lookalikeEmail]) {
        await request(httpServer(app))
          .post(`/${PREFIX}/auth/sign-up/email`)
          .send({ email, name: 'Log', password: 'correct-horse-battery-staple-9' })
          .expect(200);
      }

      // Allergic to milk, and fish disliked: the scripted pool proposes yogurt and hake anyway, so this generation's calls reject dishes for `allergen` and `unwanted`.
      const listed: Response = await request(httpServer(app)).get(`/${PREFIX}/safety/allergens`).expect(200);
      const milk = (listed.body as readonly { id: string; key: string }[]).find(allergen => allergen.key === 'milk')?.id;

      if (milk === undefined) {
        throw new Error('The seed has no milk allergen');
      }

      await completeOnboarding(app, log, [milk]);
      await request(httpServer(app))
        .patch(`/${PREFIX}/onboarding`)
        .set('Cookie', log.cookie)
        .send({ data: { cuisines: ['Mediterránea'], preferences: [{ label: 'pescado', sentiment: 'disliked' }] }, step: 'food-preferences' })
        .expect(200);

      const before = ai.calls;

      expect((await generateAndWait(app, log)).status).toBe('succeeded');
      asked = ai.calls - before;

      // One call in the log's own shape (`AiCallRecord`), whose dishes were dropped for four reasons — two of them this person's.
      await writeFailedJob(log.email, at.recent, [REJECTING_CALL]);
      await writeFailedJob(underscoreEmail, at.underscore);
      await writeFailedJob(lookalikeEmail, at.lookalike);
      await writeFailedJob(log.email, at.old);

      const real = (await generations(`q=${gt}&status=succeeded`)).rows[0];

      realJobId = real?.id ?? '';
    }, 120_000);

    it('do not exist for an ordinary account, nor for a caller with no session — even with a query they would refuse', async () => {
      const paths = [
        'generations',
        'generations?status=nope',
        'generations?q=a%00b',
        'generations?from=2026-09-20&to=2026-09-10',
        'generations/stats',
        'generations/stats?period=14',
        'ai',
        'ai?period=14',
        'pictures',
        'pictures?period=14',
        'pictures?period=1',
        'catalogue/recipes',
        'catalogue/recipes?sort=createdAt',
        // One recipe and the file of its rejected picture (`0072`): an id that is no recipe, and one that is no id.
        'catalogue/recipes/00000000-0000-4000-8000-000000000000',
        'catalogue/recipes/not-a-uuid',
        'catalogue/recipes/00000000-0000-4000-8000-000000000000/picture/candidate',
        'catalogue/recipes/not-a-uuid/picture/candidate',
        'catalogue/ingredients',
        'catalogue/ingredients?sort=x',
        'catalogue/ingredients?category=x'
      ];

      for (const path of paths) {
        const asOrdinary: Response = await get(path, ordinary.cookie);
        const asNobody: Response = await get(path);

        expect({ nobody: asNobody.status, ordinary: asOrdinary.status, path }).toEqual({ nobody: 404, ordinary: 404, path });
      }

      // The owner's acceptance of a rejected picture and its removal (`0072`): the same 404 before the body is read — the one the route takes, one it would refuse, or none.
      const writes: [string, unknown][] = [
        ['catalogue/recipes/00000000-0000-4000-8000-000000000000/picture/candidate/accept', { allergens: [], expiresAt: '2026-10-07T00:00:00.000Z' }],
        ['catalogue/recipes/00000000-0000-4000-8000-000000000000/picture/candidate/accept', { allergens: 'gluten', confirmed: true }],
        ['catalogue/recipes/not-a-uuid/picture/candidate/accept', undefined],
        ['catalogue/recipes/00000000-0000-4000-8000-000000000000/picture/remove', undefined],
        ['catalogue/recipes/not-a-uuid/picture/remove', undefined]
      ];

      for (const [path, body] of writes) {
        const post = (cookie?: string) => {
          const call = request(httpServer(app)).post(`/${PREFIX}/admin/${path}`);
          const signed = cookie === undefined ? call : call.set('Cookie', cookie);

          return body === undefined ? signed : signed.send(body as object);
        };

        const asOrdinary: Response = await post(ordinary.cookie);
        const asNobody: Response = await post();

        expect({ body, nobody: asNobody.status, ordinary: asOrdinary.status, path }).toEqual({ body, nobody: 404, ordinary: 404, path });
      }
    });

    it('page the log, newest first, each row exactly as the log has always shown it — calls included', async () => {
      const page = await generations(`q=${gt}`);

      expect(Object.keys(page).sort()).toEqual(['offset', 'rows', 'size', 'total']);
      expect({ offset: page.offset, size: page.size, total: page.total }).toEqual({ offset: 0, size: 25, total: 5 });

      for (const row of page.rows) {
        expect({ id: row.id, keys: Object.keys(row).sort() }).toEqual({ id: row.id, keys: GENERATION_KEYS });
        expect(Object.keys(row.account).sort()).toEqual(['email', 'name']);
        expect(Array.isArray(row.calls)).toBe(true);
      }

      // The real one first (made now), then the four written ones by when each was made.
      expect(page.rows.map(row => row.id)[0]).toBe(realJobId);
      expect(page.rows.slice(1).map(who)).toEqual([
        [log.email, 'failed', at.recent.toISOString()],
        [underscoreEmail, 'failed', at.underscore.toISOString()],
        [lookalikeEmail, 'failed', at.lookalike.toISOString()],
        [log.email, 'failed', at.old.toISOString()]
      ]);

      const real = page.rows[0];

      // The pipeline's own row: finished, a plan behind it, and — when the model was asked — its calls.
      expect(real).toMatchObject({ code: null, status: 'succeeded' });
      expect(real?.plan).not.toBeNull();
      expect(real?.seconds).toEqual(expect.any(Number));
      expect((real?.calls.length ?? 0) > 0).toBe(asked > 0);
      expect(page.rows[1]).toMatchObject({ attempts: 1, code: CODE, seconds: 5, status: 'failed', step: 'SCHEDULING_MEALS' });
    });

    it('narrow by outcome, by code, by the last 24 hours or a period, and by a range of Madrid days', async () => {
      const oldDay = madridDay(at.old.toISOString());
      const today = madridDay(new Date().toISOString());

      const expectIds = async (query: string, expected: readonly string[]) => {
        const page = await generations(query);

        expect({ ids: page.rows.map(row => row.id), query, total: page.total }).toEqual({ ids: expected, query, total: expected.length });
      };

      const all = (await generations(`q=${gt}`)).rows.map(row => row.id);
      const [real, recent, underscore, lookalike, old] = all as [string, string, string, string, string];

      await expectIds(`q=${gt}&status=succeeded`, [real]);
      await expectIds(`q=${gt}&status=failed`, [recent, underscore, lookalike, old]);
      await expectIds(`q=${gt}&status=queued`, []);
      // The code is this run's own, so it narrows the whole log to exactly these four — no `q` needed.
      await expectIds(`code=${CODE}`, [recent, underscore, lookalike, old]);
      await expectIds(`code=${CODE}&status=succeeded`, []);
      await expectIds(`code=${CODE}_X`, []);
      await expectIds(`q=${gt}&since=24h`, [real, recent, underscore, lookalike]);
      await expectIds(`q=${gt}&since=7`, [real, recent, underscore, lookalike]);
      await expectIds(`q=${gt}&since=30`, all);
      await expectIds(`q=${gt}&since=90`, all);
      // Both ends included: a range of one day is that day.
      await expectIds(`q=${gt}&from=${oldDay}&to=${oldDay}`, [old]);
      await expectIds(`q=${gt}&to=${oldDay}`, [old]);
      await expectIds(`q=${gt}&from=${shiftDay(oldDay, 1)}`, [real, recent, underscore, lookalike]);
      await expectIds(`q=${gt}&from=${shiftDay(oldDay, -1)}&to=${shiftDay(oldDay, 1)}`, [old]);
      // Every filter given applies: the narrowest wins.
      await expectIds(`q=${gt}&since=30&to=${oldDay}&status=failed`, [old]);
      await expectIds(`q=${gt}&since=7&to=${oldDay}`, []);
      await expectIds(`q=${gt}&from=${today}&status=succeeded`, [real]);
    });

    it('page the matches: every generation once, and the same total on every page', async () => {
      const all = (await generations(`q=${gt}`)).rows.map(row => row.id);
      const pages = await Promise.all([0, 2, 4].map(offset => generations(`q=${gt}&size=2&offset=${offset}`)));

      expect(pages.map(page => [page.offset, page.size, page.rows.length, page.total])).toEqual([
        [0, 2, 2, 5],
        [2, 2, 2, 5],
        [4, 2, 1, 5]
      ]);
      expect(pages.flatMap(page => page.rows.map(row => row.id))).toEqual(all);
      expect(new Set(all).size).toBe(5);
      expect((await generations(`q=${gt}&offset=5`)).rows).toEqual([]);
    });

    it('search the address literally: % and _ are characters, not wildcards', async () => {
      const emailsOf = async (q: string) => (await generations(`q=${encodeURIComponent(q)}`)).rows.map(row => row.account.email);

      expect(await emailsOf(`${gt}-a_b`)).toEqual([underscoreEmail]);
      expect(await emailsOf(`${gt}-axb`)).toEqual([lookalikeEmail]);
      // As wildcards, `_` would match the `-` and `%` anything.
      expect(await emailsOf(`${gt}_axb`)).toEqual([]);
      expect(await emailsOf(`${gt}%axb`)).toEqual([]);
      expect(await emailsOf(`admin%${gt}`)).toEqual([]);
      // And a backslash is a character too, not an escape.
      expect(await emailsOf(`${gt}\\`)).toEqual([]);
      expect(await emailsOf(`${gt}-a\\_b`)).toEqual([]);
      // Case-insensitive, like every address search in the console.
      expect(await emailsOf(`${gt.toUpperCase()}-AXB`)).toEqual([lookalikeEmail]);
    });

    it('drops legacy=1 as an unknown key, rather than answering the old array (0068 § Removed)', async () => {
      const plain = await generations(`q=${gt}&status=succeeded`);
      const withLegacy = (await get(`generations?legacy=1&q=${gt}&status=succeeded`, owner.cookie).expect(200)).body as AdminGenerationsView;

      // `legacy` is stripped like any other unknown key: the page is exactly
      // the page it would be without it, never the old array of ≤ 20.
      expect(withLegacy).toEqual(plain);
      expect(Array.isArray(withLegacy)).toBe(false);
    });

    /*
     * A dish the model wrote and the product dropped because of this person's
     * allergies or way of eating says something about their health and their
     * food. The addressed row carries the calls' other rejection reasons —
     * schema, wrong meal, unknown ingredient — but never `allergen` or
     * `unwanted` (the invariant review of phase 7). Fixed after `7a31294`: on
     * that commit this case fails, by design.
     */
    it('never say on an addressed row that a dish was dropped for an allergy or a way of eating — other reasons stay', async () => {
      // The premise, on the table: the pipeline's own job — milk declared, fish disliked, yogurt and hake proposed — did reject for both.
      const [job] = await sql()<{ calls: { rejected?: Record<string, number> }[] | null }>`
        select ai_calls as calls from plan_generation_jobs where id = ${realJobId}`;
      const reasons = new Set(
        (job?.calls ?? []).flatMap(call => Object.entries(call.rejected ?? {}).flatMap(([reason, n]) => (n > 0 ? [reason] : [])))
      );

      expect({ allergen: reasons.has('allergen'), unwanted: reasons.has('unwanted') }).toEqual({ allergen: true, unwanted: true });

      const paged = (await get(`generations?q=${gt}`, owner.cookie).expect(200)).body as AdminGenerationsView;
      const keys = new Set<string>();

      walk(paged, keys, new Set());

      expect({ allergen: keys.has('allergen'), unwanted: keys.has('unwanted') }).toEqual({ allergen: false, unwanted: false });

      // The other reasons stay, on the written call, and the call is otherwise the call: only the two keys go.
      const written = paged.rows[1];

      expect(written?.startedAt).toBe(at.recent.toISOString());
      expect(written?.calls).toEqual([{ ...REJECTING_CALL, rejected: { schema: 3, wrong_meal: 1 } }]);

      // The pipeline's own calls keep a `rejected` on every call, emptied of the two at most.
      const real = paged.rows.find(one => one.id === realJobId);

      expect((real?.calls.length ?? 0) > 0).toBe(true);
      expect(real?.calls.every(call => typeof call.rejected === 'object')).toBe(true);
    });

    /*
     * `quality` and `advisories` live in the same `generation_metadata` column
     * as the keys the log does show (`0071`, phase 1 step 8): `quality` is
     * read only summed over a period, never per plan, and `advisories` are
     * sentences with an event's name and a figure in them (`0028`). The
     * pipeline's own job — the one this block's `beforeAll` generated — has
     * both, so this proves the SQL selection (`PLAN_LOG_KEYS`), not their absence.
     */
    it('never carries quality or advisories on any row, whatever the plan recorded of itself', async () => {
      const paged = (await get(`generations?q=${gt}`, owner.cookie).expect(200)).body as AdminGenerationsView;
      const keys = new Set<string>();

      walk(paged, keys, new Set());

      expect({ advisories: keys.has('advisories'), quality: keys.has('quality') }).toEqual({ advisories: false, quality: false });
    });

    it('refuse an unknown filter value, a range that ends before it starts, a repeated parameter and a bad page, as INVALID_INPUT', async () => {
      const paths = [
        ...[
          'status=done',
          'status=FAILED',
          'status=failed&status=queued',
          'code=generation_ai_unavailable',
          'code=E2E-DASH',
          'code=_E2E',
          `code=${'A'.repeat(81)}`,
          'since=14',
          'since=24',
          'since=1d',
          'from=yesterday',
          'from=2026-13-01',
          'to=20260101',
          'from=2026-09-20&to=2026-09-10',
          'size=0',
          'size=101',
          'size=abc',
          'offset=-1',
          'q=a%00b'
        ].map(query => `generations?${query}`),
        ...['period=14', 'period=seven', 'period=', 'period=7&period=30'].flatMap(query => [
          `generations/stats?${query}`,
          `ai?${query}`,
          `pictures?${query}`
        ])
      ];
      const answers: { code: string | undefined; path: string; status: number }[] = [];

      for (const path of paths) {
        const response: Response = await get(path, owner.cookie);

        answers.push({ code: (response.body as { code?: string }).code, path, status: response.status });
      }

      expect(answers).toEqual(paths.map(path => ({ code: 'INVALID_INPUT', path, status: 422 })));
    });

    it('chart the log over a period: outcomes and durations per day, failures by code — counts only, no address', async () => {
      for (const [query, period] of [
        [undefined, 30],
        ['7', 7],
        ['30', 30],
        ['90', 90]
      ] as const) {
        const response: Response = await get(`generations/stats${query === undefined ? '' : `?period=${query}`}`, owner.cookie).expect(200);
        const stats = response.body as AdminGenerationStatsView;

        expect(Object.keys(stats).sort()).toEqual(['durations', 'failuresByCode', 'outcomes', 'period', 'rejectionsByReason', 'window']);
        expect(stats.period).toBe(period);

        // Totals by reason over everybody (0028): a reason and a count, never a job, an account or an address.
        for (const row of stats.rejectionsByReason) {
          expect(Object.keys(row).sort()).toEqual(['n', 'reason']);
          expect(typeof row.reason).toBe('string');
          expect(Number.isInteger(row.n) && row.n > 0).toBe(true);
        }

        expectDays(stats.outcomes, period, stats.window.to);
        expect(stats.outcomes.series.map(row => row.key)).toEqual(['queued', 'running', 'succeeded', 'failed']);

        for (const row of stats.outcomes.series) {
          expect(row.values).toHaveLength(period);
          expect(row.values.every(n => Number.isInteger(n) && n >= 0)).toBe(true);
        }

        expect(Object.keys(stats.durations).sort()).toEqual(['days', 'p50', 'p95']);
        expect(stats.durations.days).toEqual(stats.outcomes.days);

        for (const key of ['p50', 'p95'] as const) {
          expect(stats.durations[key]).toHaveLength(period);
          expect(stats.durations[key].every(value => value === null || (typeof value === 'number' && value >= 0))).toBe(true);
        }

        stats.durations.p50.forEach((p50, i) => {
          const p95 = stats.durations.p95[i];

          // A day has both or neither, and the 95th percentile is never under the median.
          expect(p50 === null).toBe(p95 === null);

          if (p50 !== null && p95 !== null) {
            expect(p95).toBeGreaterThanOrEqual(p50);
          }
        });
        // Today finished generations — this block's real one and its written ones — so today has a duration.
        expect(stats.durations.p50.at(-1)).not.toBeNull();

        // This run's code: three failures in the last seven days, the fourth ten days back.
        expect(stats.failuresByCode.find(row => row.code === CODE)).toEqual({ code: CODE, n: period === 7 ? 3 : 4 });

        for (const row of stats.failuresByCode) {
          expect(Object.keys(row).sort()).toEqual(['code', 'n']);
        }

        const ns = stats.failuresByCode.map(row => row.n);

        expect(ns).toEqual([...ns].sort((a, b) => b - a));
        // The failures by code are the failed series, summed: the same jobs over the same window.
        const failed = stats.outcomes.series.find(row => row.key === 'failed')?.values ?? [];

        expect(ns.reduce((total, n) => total + n, 0)).toBe(failed.reduce((total, n) => total + n, 0));

        // No address, no name, no id: counts, days and codes only.
        expectNobody(`stats ${period}`, stats, STATS_KEYS);
      }
    });

    it('count the provider over a period, and carry no address', async () => {
      for (const [query, period] of [
        [undefined, 30],
        ['7', 7],
        ['90', 90]
      ] as const) {
        const response: Response = await get(`ai${query === undefined ? '' : `?period=${query}`}`, owner.cookie).expect(200);
        const view = response.body as AdminAiView;

        // Exactly the period's keys (`0068` § Removed: today's quota readout is gone) and the month (`0071`).
        expect(Object.keys(view).sort()).toEqual(['callsPerDay', 'models', 'month', 'period', 'spendPerDay', 'tokensPerDay', 'totals', 'window']);

        // No cap in this environment: no gauge, the keys absent, not null (`text-cap.e2e-spec.ts` runs with one).
        expect(Object.keys(view.month).sort()).toEqual(['byFeature', 'monthStart', 'spentUsd', 'uncostedCalls']);
        expect(view.month.byFeature.map(entry => entry.feature)).toEqual(['plan', 'swap', 'rewrite', 'unknown']);
        expect(view.month.byFeature.reduce((total, entry) => total + entry.costUsd, 0)).toBeCloseTo(view.month.spentUsd, 5);
        expect(view.period).toBe(period);

        expectDays(view.callsPerDay, period, view.window.to);
        expectDays(view.tokensPerDay, period, view.window.to);
        expect(view.tokensPerDay.series.map(row => row.key)).toEqual(['input', 'output']);

        for (const row of view.tokensPerDay.series) {
          expect(row.values).toHaveLength(period);
        }

        expect(Object.keys(view.totals).sort()).toEqual(['averageMs', 'calls', 'costUsd', 'failed', 'inputTokens', 'outputTokens']);

        for (const key of ['averageMs', 'calls', 'costUsd', 'failed', 'inputTokens', 'outputTokens'] as const) {
          expect(Object.keys(view.totals[key]).sort()).toEqual(['current', 'previous']);
        }

        // The chart is the total, day by day, and the models are the total, split.
        const sum = (values: readonly number[]) => values.reduce((total, n) => total + n, 0);

        expect(sum(view.callsPerDay.values)).toBe(view.totals.calls.current);
        expect(sum(view.models.map(model => model.calls))).toBe(view.totals.calls.current);
        // The spend chart is the spend total, day by day (to six places, as the events carry it).
        expect(view.spendPerDay.values).toHaveLength(period);
        expect(sum(view.spendPerDay.values)).toBeCloseTo(view.totals.costUsd.current, 5);

        expectNobody(`ai ${period}`, view, AI_KEYS);
      }
    });

    it('carry the picture spend per day over the period beside this month', async () => {
      for (const [query, period] of [
        [undefined, 30],
        ['7', 7],
        ['90', 90]
      ] as const) {
        const response: Response = await get(`pictures${query === undefined ? '' : `?period=${query}`}`, owner.cookie).expect(200);
        const view = response.body as AdminPicturesPeriodView;

        expect(Object.keys(view).sort()).toEqual(
          [
            'acceptedByHand',
            'capUsd',
            'drawing',
            'enabled',
            'failed',
            'failedByReason',
            'period',
            'ready',
            'released',
            'releasedByReason',
            'since',
            'spendPerDay',
            'spentUsd',
            'window'
          ].sort()
        );
        expect(view.period).toBe(period);
        // Dollars, not counts: `expectDays` checks the days, the values are checked here.
        expectDays({ days: view.spendPerDay.days }, period, view.window.to);
        expect(view.spendPerDay.values).toHaveLength(period);
        expect(view.spendPerDay.values.every(value => typeof value === 'number' && value >= 0)).toBe(true);
        expectNobody(`pictures ${period}`, view, PICTURE_KEYS);
      }
    });

    it('list recipes with exactly their seventeen keys and the whole catalogue’s counts', async () => {
      const page = await recipes('');

      expect(Object.keys(page).sort()).toEqual(['counts', 'offset', 'rows', 'size', 'total']);
      expect({ offset: page.offset, size: page.size }).toEqual({ offset: 0, size: 25 });
      // A full page when the catalogue has one: CI's seed has no recipes, only what the scripted model wrote this run.
      expect(page.total).toBeGreaterThan(0);
      expect(page.rows).toHaveLength(Math.min(25, page.total));

      for (const row of page.rows) {
        expect({ keys: Object.keys(row).sort(), slug: row.slug }).toEqual({ keys: RECIPE_KEYS, slug: row.slug });
      }

      // Sorted by name, ascending, when asked nothing — in the database's own collation, then by slug.
      const first = await sql()<{ name: string }>`select name from recipes order by name asc nulls last, slug asc limit 25`;

      expect(page.rows.map(row => row.name)).toEqual(first.map(row => row.name));

      const { counts } = page;

      expect(Object.keys(counts).sort()).toEqual(['bySlot', 'bySource', 'total', 'withoutImage']);
      expect(counts.bySlot.map(row => row.slot)).toEqual(MEAL_SLOTS);
      expect(counts.bySource.map(row => row.source)).toEqual(['seed', 'ai', 'user']);
      expect(counts.total).toBe(page.total);
      expect(counts.bySource.reduce((total, row) => total + row.n, 0)).toBe(counts.total);
      expect(counts.withoutImage).toBeLessThanOrEqual(counts.total);

      // The counts are the whole catalogue's, whatever the table is filtered to.
      expect((await recipes('slot=supper&source=user&q=zzzz-nothing')).counts).toEqual(counts);

      // Without a ready picture is everything but the ready ones.
      expect((await recipes('picture=ready')).total + counts.withoutImage).toBe(counts.total);
    });

    it('narrow recipes by slot, allergen, source, picture, locale and name — every row satisfying the filter', async () => {
      const { counts, total } = await recipes('');

      const everyRow = async (query: string, holds: (row: CatalogueRecipeView) => boolean) => {
        const page = await recipes(`${query}&size=100`);

        expect({ query, stray: page.rows.filter(row => !holds(row)).map(row => row.slug) }).toEqual({ query, stray: [] });

        return page;
      };

      const breakfast = await everyRow('slot=breakfast', row => row.mealSlots.includes('breakfast'));

      expect(breakfast.total).toBeGreaterThan(0);
      expect(breakfast.total).toBeLessThan(total);
      expect(breakfast.total).toBe(counts.bySlot.find(row => row.slot === 'breakfast')?.n);

      const seed = await everyRow('source=seed', row => row.source === 'seed');

      // None in CI, whose seed carries no recipes; the seeded library on a developer's database. The count agrees either way.
      expect(seed.total).toBe(counts.bySource.find(row => row.source === 'seed')?.n);

      const gluten = await everyRow('allergen=gluten', row => row.allergens.includes('gluten'));

      expect(gluten.total).toBeGreaterThan(0);
      expect(gluten.total).toBeLessThan(total);

      // Filters combine.
      const both = await everyRow(
        'allergen=gluten&slot=breakfast&source=seed',
        row => row.allergens.includes('gluten') && row.mealSlots.includes('breakfast')
      );

      expect(both.total).toBeLessThanOrEqual(Math.min(gluten.total, breakfast.total, seed.total));

      // An allergen key nobody has matches nothing, rather than being refused or ignored.
      expect((await recipes('allergen=not_an_allergen')).total).toBe(0);

      for (const picture of ['ready', 'drawing', 'failed', 'none'] as const) {
        await everyRow(`picture=${picture}`, row => row.picture === picture);
      }

      // The pictures the owner accepted by hand (`0072`): ready ones and no others, and never more than the ready ones.
      const byHand = await everyRow('picture=accepted_by_hand', row => row.picture === 'ready' && row.pictureAcceptedByHand);

      expect(byHand.total).toBeLessThanOrEqual((await recipes('picture=ready')).total);

      const locale = breakfast.rows[0]?.locale ?? '';
      const inLocale = await everyRow(`locale=${locale}`, row => row.locale === locale);

      expect(inLocale.total).toBeGreaterThan(0);

      // What this run's model wrote is `ai`, and there is some: this block's generation asked it.
      const written = await everyRow('source=ai', row => row.source === 'ai');

      expect(written.total).toBeGreaterThan(0);
      expect(written.total).toBe(counts.bySource.find(row => row.source === 'ai')?.n);

      // By name, and literally.
      const word = (breakfast.rows[0]?.name ?? '').split(' ')[0] ?? '';

      expect(word.length).toBeGreaterThan(0);

      const named = await everyRow(`q=${encodeURIComponent(word)}`, row => row.name.toLowerCase().includes(word.toLowerCase()));

      expect(named.rows.map(row => row.slug)).toContain(breakfast.rows[0]?.slug);
      expect((await recipes(`q=${encodeURIComponent('%')}`)).total).toBe(0);
      expect((await recipes(`q=${encodeURIComponent(`${word}%`)}`)).total).toBe(0);
    });

    it('sort recipes by name, kcal or protein either way, the uncosted last, and page without overlap', async () => {
      const last = await sql()<{ name: string }>`select name from recipes order by name desc nulls last, slug asc limit 25`;

      expect((await recipes('dir=desc')).rows.map(row => row.name)).toEqual(last.map(row => row.name));

      for (const [sort, figure] of [
        ['kcal', 'kcal'],
        ['protein', 'proteinG']
      ] as const) {
        for (const dir of ['asc', 'desc'] as const) {
          const rows = (await recipes(`sort=${sort}&dir=${dir}&size=100`)).rows;
          const values = rows.map(row => row[figure]);
          const firstNull = values.indexOf(null);
          const costed = (firstNull === -1 ? values : values.slice(0, firstNull)) as number[];

          expect({ dir, nullsInside: firstNull === -1 ? 0 : values.slice(firstNull).filter(value => value !== null).length, sort }).toEqual({
            dir,
            nullsInside: 0,
            sort
          });
          expect(costed).toEqual([...costed].sort((a, b) => (dir === 'asc' ? a - b : b - a)));
        }
      }

      for (const sort of ['name', 'kcal']) {
        const pages = await Promise.all([0, 5, 10].map(offset => recipes(`slot=breakfast&sort=${sort}&size=5&offset=${offset}`)));
        const keys = pages.flatMap(page => page.rows.map(row => `${row.slug}/${row.locale}`));
        const total = pages[0]?.total ?? 0;

        // Two generations' breakfasts at least (the people tables' and this block's), so the first page is full.
        expect(total).toBeGreaterThanOrEqual(5);
        expect(pages.map(page => page.total)).toEqual([total, total, total]);
        expect(pages.map(page => page.rows.length)).toEqual([0, 5, 10].map(offset => Math.max(0, Math.min(5, total - offset))));
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).toEqual((await recipes(`slot=breakfast&sort=${sort}&size=15`)).rows.map(row => `${row.slug}/${row.locale}`));
      }
    });

    it('never name who made a dish: no created_by, no person’s id, not the maker’s id anywhere', async () => {
      // The premise: this block's generation asked the model, so the catalogue holds a dish `log` made.
      expect(asked).toBeGreaterThan(0);

      const [dish] = await sql()<{ locale: string; name: string }>`
        select r.name, r.locale from recipes r join "user" u on u.id = r.created_by where u.email = ${log.email} order by r.name limit 1`;

      expect(dish).toBeDefined();

      const found = await recipes(`q=${encodeURIComponent(dish?.name ?? '')}&locale=${dish?.locale ?? ''}`);

      expect(found.rows.map(row => row.name)).toContain(dish?.name);
      expect(found.rows.find(row => row.name === dish?.name)?.source).toBe('ai');

      // The same dish read on its own (`0072`): its row and its ingredients, and still nobody's.
      const alone: Response = await get(`catalogue/recipes/${found.rows.find(row => row.name === dish?.name)?.id ?? ''}`, owner.cookie).expect(200);

      expect(Object.keys(alone.body as Record<string, unknown>).sort()).toEqual([...RECIPE_KEYS, 'ingredients', 'pictureUrl'].sort());

      const bodies: [string, unknown, ReadonlySet<string>][] = [
        ['the maker’s dish', found, RECIPE_BODY_KEYS],
        ['the maker’s dish, alone', alone.body, RECIPE_ONE_KEYS],
        ['source=ai', await recipes('source=ai&size=100'), RECIPE_BODY_KEYS],
        ['every slot, by kcal', await recipes('sort=kcal&size=100'), RECIPE_BODY_KEYS],
        ['ingredients', await ingredients('size=100'), INGREDIENT_BODY_KEYS]
      ];

      for (const [label, body, allowed] of bodies) {
        const keys = new Set<string>();

        walk(body, keys, new Set());

        // A recipe row carries its own `id` (the retry route takes it): a dish's id names nobody, and
        // `expectNobody` below still refuses every account's id as a value. Ingredients carry none.
        const person = allowed === INGREDIENT_BODY_KEYS ? PERSON_KEYS : PERSON_KEYS.filter(key => key !== 'id');

        expect({ label, person: [...keys].filter(key => person.includes(key)) }).toEqual({ label, person: [] });
        expectNobody(label, body, allowed);
      }
    });

    it('list ingredients with exactly their eleven keys, narrowed by name, category and allergen, sorted and paged', async () => {
      const page = await ingredients('');

      expect(Object.keys(page).sort()).toEqual(['offset', 'rows', 'size', 'total']);
      expect(page.rows).toHaveLength(25);

      for (const row of page.rows) {
        expect({ keys: Object.keys(row).sort(), slug: row.slug }).toEqual({ keys: INGREDIENT_KEYS, slug: row.slug });
      }

      // By name or slug in any language: the seeded hake is found, and the list shrinks to the matches.
      const hake = await ingredients(`q=${SEEDED.merluza}`);

      expect(hake.rows.map(row => row.slug)).toContain(SEEDED.merluza);
      expect(hake.total).toBeLessThan(page.total);

      const milk = await ingredients('allergen=milk&size=100');

      expect(milk.total).toBeGreaterThan(0);
      expect(milk.total).toBeLessThan(page.total);
      expect(milk.rows.filter(row => !row.allergens.includes('milk')).map(row => row.slug)).toEqual([]);

      const category = page.rows[0]?.category ?? '';
      const ofCategory = await ingredients(`category=${category}&size=100`);

      expect(ofCategory.total).toBeGreaterThan(0);
      expect(ofCategory.rows.filter(row => row.category !== category).map(row => row.slug)).toEqual([]);

      for (const [sort, figure] of [
        ['kcal', 'kcalPer100g'],
        ['protein', 'proteinPer100g'],
        ['carbs', 'carbsPer100g'],
        ['fat', 'fatPer100g']
      ] as const) {
        for (const dir of ['asc', 'desc'] as const) {
          const values = (await ingredients(`sort=${sort}&dir=${dir}&size=50`)).rows.map(row => row[figure]);

          expect({ dir, sort, sorted: values.join() === [...values].sort((a, b) => (dir === 'asc' ? a - b : b - a)).join() }).toEqual({
            dir,
            sort,
            sorted: true
          });
        }
      }

      // By category: each category in one run, whatever order the enum gives them.
      const byCategory = (await ingredients('sort=category&size=100')).rows.map(row => row.category);
      const runs = byCategory.filter((category, i) => i === 0 || byCategory[i - 1] !== category);

      expect(runs).toEqual([...new Set(byCategory)]);

      const pages = await Promise.all([0, 10, 20].map(offset => ingredients(`size=10&offset=${offset}`)));
      const slugs = pages.flatMap(one => one.rows.map(row => row.slug));

      expect(new Set(pages.map(one => one.total)).size).toBe(1);
      expect(new Set(slugs).size).toBe(30);
      expect(slugs).toEqual((await ingredients('size=30')).rows.map(row => row.slug));
    });

    it('refuse a sort the catalogue does not have — createdAt included — and any value outside its lists, as INVALID_INPUT', async () => {
      const paths = [
        ...[
          'sort=createdAt',
          'sort=created_at',
          'sort=fat',
          'sort=name;drop',
          'dir=up',
          'slot=brunch',
          'source=seed_ai',
          'source=SEED',
          'picture=released',
          'picture=yes',
          'picture=accepted',
          'picture=ACCEPTED_BY_HAND',
          'allergen=GLUTEN',
          'allergen=gluten;',
          'locale=spanish',
          'locale=es_ES',
          'size=0',
          'size=101',
          'offset=-1',
          'sort=name&sort=kcal',
          'q=a%00b'
        ].map(query => `catalogue/recipes?${query}`),
        ...[
          'sort=createdAt',
          'sort=protein_desc',
          'dir=up',
          'category=meat_and_fish_and',
          'allergen=Milk',
          'size=0',
          'size=101',
          'offset=-1',
          'q=a%00b'
        ].map(query => `catalogue/ingredients?${query}`)
      ];
      const answers: { code: string | undefined; path: string; status: number }[] = [];

      for (const path of paths) {
        const response: Response = await get(path, owner.cookie);

        answers.push({ code: (response.body as { code?: string }).code, path, status: response.status });
      }

      expect(answers).toEqual(paths.map(path => ({ code: 'INVALID_INPUT', path, status: 422 })));
    });

    afterAll(async () => {
      // Deleted here as well as by the suite (a second delete is a no-op), so this block can check that none outlives it — nor any job it wrote.
      await deleteAccounts(app, log === undefined ? [] : [log.cookie]);

      for (const email of [underscoreEmail, lookalikeEmail]) {
        await deleteAccountByEmail(app, email);
      }

      const [left] = await sql()<{ accounts: number; jobs: number }>`
        select (select count(*)::int from "user" where email like ${`%${gt}%`}) as accounts,
               (select count(*)::int from plan_generation_jobs where error = ${CODE}) as jobs`;

      expect(left).toEqual({ accounts: 0, jobs: 0 });
    });
  });

  /**
   * The console's watching pages (`0071`, project 008 phase 3): the catalogue's
   * quality, the consents, the notifications and the system. Counts, versions
   * and booleans over the service — never a person, an address or a setting's
   * value. Exact key lists at every level, so a new field is a decision.
   */
  describe('the watching pages', () => {
    const get = (path: string, cookie?: string) => {
      const call = request(httpServer(app)).get(`/${PREFIX}/admin/${path}`);

      return cookie === undefined ? call : call.set('Cookie', cookie);
    };

    const keys = (value: object) => Object.keys(value).sort();
    const body = async <View>(path: string) => (await get(path, owner.cookie).expect(200)).body as View;
    /** The system view as the console reads it: mail is per-day totals, and per-template period totals. */
    type SystemBody = Omit<AdminSystemView, 'mail'> & {
      readonly mail: {
        readonly days: readonly string[];
        readonly kinds: readonly { readonly failed: number; readonly kind: string; readonly sent: number }[];
        readonly perDay: { readonly failed: readonly number[]; readonly sent: readonly number[] };
        readonly totals: { readonly failed: number; readonly sent: number };
      };
    };
    const SEMVER = /^\d+\.\d+\.\d+$/;

    const refusedAsInput = async (path: string) => {
      const refused: Response = await get(path, owner.cookie);

      expect({ code: (refused.body as { code?: string }).code, path, status: refused.status }).toEqual({ code: 'INVALID_INPUT', path, status: 422 });
    };

    const PAGES = ['catalogue/quality', 'consents', 'notifications', 'system', 'catalogue/recipes?check=over_bound'];

    it('do not exist for an ordinary account, nor for a caller with no session — even with a query they would refuse', async () => {
      const refusable = [
        'catalogue/quality?period=12',
        'catalogue/quality?period=abc',
        'notifications?period=12',
        'system?period=12',
        'consents?period=12',
        'catalogue/recipes?check=nope',
        'catalogue/recipes?check=over_bound&sort=createdAt'
      ];

      for (const path of [...PAGES, ...refusable]) {
        const asOrdinary: Response = await get(path, ordinary.cookie);
        const asNobody: Response = await get(path);

        expect({ nobody: asNobody.status, ordinary: asOrdinary.status, path }).toEqual({ nobody: 404, ordinary: 404, path });
      }
    });

    it('answer the owner', async () => {
      for (const path of PAGES) {
        await get(path, owner.cookie).expect(200);
      }
    });

    it('carry the quality of the catalogue, with exact keys, and its sweep adds up', async () => {
      const view = await body<AdminCatalogueQualityView>('catalogue/quality');

      expect(keys(view)).toEqual(['period', 'recipes', 'shouldBeZero', 'sweep', 'sweepHistory', 'toLookAt', 'window']);
      expect(keys(view.sweepHistory)).toEqual(['calls', 'costUsd', 'days', 'heldByCap', 'pending', 'rewritten', 'runs', 'skipped', 'unreached']);

      // One value per day of the period, in every array.
      for (const series of Object.values(view.sweepHistory)) {
        expect(series).toHaveLength(30);
      }

      expect(keys(view.shouldBeZero)).toEqual(['mealsOutsideServingBounds', 'overBound', 'refusalLimit', 'uncosted', 'unserved']);
      expect(keys(view.sweep)).toEqual(['attemptBound', 'current', 'givenUp', 'pending', 'stepsVersion', 'withRefusals']);
      expect(keys(view.toLookAt)).toEqual(['overCapBySource', 'oversizedRejections', 'picturesFailed']);
      expect(keys(view.window)).toEqual(['from', 'previousFrom', 'to']);
      expect(view.period).toBe(30);
      expect(view.sweep.stepsVersion).toMatch(SEMVER);
      expect(view.sweep.current + view.sweep.pending + view.sweep.givenUp).toBe(view.recipes);
      expect(view.toLookAt.overCapBySource).toHaveLength(3);

      for (const entry of view.toLookAt.overCapBySource) {
        expect(keys(entry)).toEqual(['n', 'source']);
      }

      expect(view.toLookAt.oversizedRejections.days).toHaveLength(30);

      for (const period of [7, 90]) {
        const other = await body<AdminCatalogueQualityView>(`catalogue/quality?period=${period}`);

        expect(other.toLookAt.oversizedRejections.days).toHaveLength(period);
        expect(other.recipes).toBe(view.recipes);
      }

      await refusedAsInput('catalogue/quality?period=12');
    });

    it('carry the sweep history for the period asked, one value per day', async () => {
      for (const period of [7, 90]) {
        const view = await body<AdminCatalogueQualityView>(`catalogue/quality?period=${period}`);

        for (const series of Object.values(view.sweepHistory)) {
          expect(series).toHaveLength(period);
        }
      }
    });

    it('carry the system: versions, caps, integrations as booleans and crons, with no value of a setting', async () => {
      const view = await body<SystemBody>('system');

      expect(keys(view)).toEqual(['caps', 'commit', 'crons', 'integrations', 'mail', 'period', 'versions', 'window']);
      expect(keys(view.integrations)).toEqual(['cronSecret', 'mail', 'ownerAddress', 'pictures', 'push', 'rewriteSweep', 'sentry']);

      for (const value of Object.values(view.integrations)) {
        expect(typeof value).toBe('boolean');
      }

      // The suite runs with every SMTP_* and VAPID_* blank.
      expect(view.integrations.mail).toBe(false);
      expect(view.integrations.push).toBe(false);
      expect(view.commit === null || /^[0-9a-f]{7,64}$/.test(view.commit)).toBe(true);
      expect(keys(view.caps)).toEqual(['oversizedFactor', 'pictureMonthlyUsd', 'rewriteAttemptBound', 'servingBounds', 'servingKcal']);
      expect(keys(view.caps.servingBounds)).toEqual(['max', 'min']);
      expect(keys(view.versions)).toEqual(['careConsent', 'healthConsent', 'professionalAgreement', 'profileConsent', 'prompt', 'steps', 'terms']);
      expect(view.versions.terms).toMatch(SEMVER);
      expect(view.versions.terms).toBe(TERMS_VERSION);
      expect(view.versions.steps).toMatch(SEMVER);
      expect(keys(view.mail)).toEqual(['days', 'kinds', 'perDay', 'totals']);
      expect(keys(view.mail.totals)).toEqual(['failed', 'sent']);
      expect(keys(view.mail.perDay)).toEqual(['failed', 'sent']);
      expect(view.mail.perDay.failed).toHaveLength(view.mail.days.length);
      expect(view.mail.perDay.sent).toHaveLength(view.mail.days.length);
      expect(view.mail.days).toHaveLength(30);
      expect(view.crons.map(cron => cron.job).sort()).toEqual(['reminders', 'rewrite', 'verifications']);

      for (const cron of view.crons) {
        expect(keys(cron)).toEqual(['job', 'lastRunAt', 'stale']);
      }

      // A mail row cannot be produced here (SMTP is blank): the shape is all this can prove.
      for (const kind of view.mail.kinds) {
        expect(keys(kind)).toEqual(['failed', 'kind', 'sent']);
        expect(Number.isInteger(kind.sent) && Number.isInteger(kind.failed)).toBe(true);
      }

      // No address, URL or host anywhere in the answer (the integrations are booleans, the key names aside).
      expect(JSON.stringify(view)).not.toMatch(/@|https?:|smtp|mailto/i);
      expect((await body<SystemBody>('system?period=7')).mail.days).toHaveLength(7);

      await refusedAsInput('system?period=12');
    });

    it('count the owner’s own mails by kind (owner-digest, owner-alert), sent and failed, without an address', async () => {
      const sql = (
        database() as unknown as { readonly $client: <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]> }
      ).$client;
      const count = async (kind: string) =>
        (await body<SystemBody>('system')).mail.kinds.find(row => row.kind === kind) ?? { failed: 0, kind, sent: 0 };
      const before = { alert: await count('owner-alert'), digest: await count('owner-digest') };

      // Rows with a marker no real one carries, removed at the end whatever happens.
      try {
        await sql`insert into analytics_events (event, user_id, properties) values
          ('mail_sent', null, ${JSON.stringify({ kind: 'owner-digest', marker: 'admin-e2e', ok: true })}::jsonb),
          ('mail_sent', null, ${JSON.stringify({ kind: 'owner-alert', marker: 'admin-e2e', ok: false })}::jsonb)`;

        const digest = await count('owner-digest');
        const alert = await count('owner-alert');

        expect(digest).toEqual({ failed: before.digest.failed, kind: 'owner-digest', sent: before.digest.sent + 1 });
        expect(alert).toEqual({ failed: before.alert.failed + 1, kind: 'owner-alert', sent: before.alert.sent });
        expect(JSON.stringify((await body<SystemBody>('system')).mail)).not.toMatch(/@|admin-e2e/);
      } finally {
        await sql`delete from analytics_events where event = 'mail_sent' and properties ->> 'marker' = 'admin-e2e'`;
      }
    });

    it('count who holds which version of each consent, and nothing of anybody', async () => {
      const view = await body<AdminConsentsView>('consents');

      expect(keys(view)).toEqual(['consents', 'onboarded']);
      expect(keys(view.onboarded)).toEqual(['holding', 'total']);
      expect(view.consents.map((consent: { key: string }) => consent.key)).toEqual(['profile', 'health', 'care', 'professional', 'terms']);

      for (const consent of view.consents) {
        expect(keys(consent)).toEqual(['current', 'currentVersion', 'key', 'older', 'versions']);
        expect(consent.versions.reduce((sum, version) => sum + version.n, 0)).toBeGreaterThanOrEqual(consent.current + consent.older);
      }

      expect(view.onboarded.holding).toBeLessThanOrEqual(view.onboarded.total);
    });

    it('count the terms an account was created under: the current version, the accounts from before it as their own bucket, a new sign-up as current', async () => {
      const find = (view: AdminConsentsView) => view.consents.find(consent => consent.key === 'terms');
      const before = find(await body<AdminConsentsView>('consents'));
      const sql = (
        database() as unknown as { readonly $client: <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]> }
      ).$client;
      const [{ n: unrecorded }] = await sql<{ n: number }>`select count(*)::int as n from "user" where terms_version is null`;

      expect(before?.currentVersion).toBe('2.0.0');
      expect(before?.currentVersion).toBe(TERMS_VERSION);

      const nullBucket = before?.versions.find(version => version.version === null);

      // Accounts from before the record are their own bucket, and are never "older": nobody is asked again for them.
      expect(nullBucket?.n ?? 0).toBe(unrecorded);

      const email = `admin-terms-${Date.now()}@e2e.invalid`;

      byEmail.push(email);
      await request(httpServer(app))
        .post(`/${PREFIX}/auth/sign-up/email`)
        .send({ email, name: 'Terms', password: 'correct-horse-battery-staple-9' })
        .expect(200);

      const after = find(await body<AdminConsentsView>('consents'));

      expect(after?.current).toBe((before?.current ?? 0) + 1);
      expect(after?.older).toBe(before?.older);
      expect(after?.versions.find(version => version.version === TERMS_VERSION)?.n).toBe(
        (before?.versions.find(version => version.version === TERMS_VERSION)?.n ?? 0) + 1
      );
      expect(after?.versions.find(version => version.version === null)?.n ?? 0).toBe(unrecorded);
    });

    it('never put an account’s terms on a row that names the account', async () => {
      for (const route of ['accounts', 'people', 'professionals', 'feedback', 'audit', `accounts?q=${encodeURIComponent(ordinary.email)}`]) {
        const text = JSON.stringify((await get(route, owner.cookie).expect(200)).body);

        expect({ found: /terms(Version|AcceptedAt)|terms_(version|accepted_at)/i.test(text), route }).toEqual({ found: false, route });
      }
    });

    it('count the reminders per channel and week, and who can be reached by push', async () => {
      const view = await body<AdminNotificationsView>('notifications');

      expect(keys(view)).toEqual(['checkIns', 'period', 'push', 'remindersPerWeek', 'window']);
      expect(keys(view.checkIns)).toEqual(['answered', 'reminded']);
      expect(keys(view.push)).toEqual(['people', 'subscriptions']);
      expect(keys(view.remindersPerWeek)).toEqual(['series', 'weeks']);
      expect(view.checkIns.answered).toBeLessThanOrEqual(view.checkIns.reminded);
      expect(view.remindersPerWeek.series.map((series: { channel: string }) => series.channel)).toEqual(['email', 'push']);
      expect(view.remindersPerWeek.weeks).toEqual(expectedWeeks(30, madridDay(view.window.to)));

      for (const series of view.remindersPerWeek.series) {
        expect(keys(series)).toEqual(['channel', 'values']);
        expect(series.values).toHaveLength(view.remindersPerWeek.weeks.length);
      }

      await refusedAsInput('notifications?period=12');
    });

    it('narrow Recetas to the recipes each quality count is made of, and refuse a check it does not know', async () => {
      const quality = await body<AdminCatalogueQualityView>('catalogue/quality');
      const expected: Record<string, number> = {
        over_bound: quality.shouldBeZero.overBound,
        over_cap: quality.toLookAt.overCapBySource.reduce((sum, entry) => sum + entry.n, 0),
        refusal_limit: quality.shouldBeZero.refusalLimit,
        uncosted: quality.shouldBeZero.uncosted,
        unserved: quality.shouldBeZero.unserved
      };

      for (const [check, total] of Object.entries(expected)) {
        const page = await body<AdminRecipesView>(`catalogue/recipes?check=${check}&size=100`);

        expect({ check, rows: page.rows.length, total: page.total }).toEqual({ check, rows: Math.min(total, 100), total });
      }

      await refusedAsInput('catalogue/recipes?check=nope');
    });

    /*
     * Planes › Calidad and Personas › Retención (`0071`, project 008 phase 5):
     * counts of plans and of people, never a plan, a day or a person. A
     * fresh sign-up lands in the current cohort as one more of its `size`.
     */
    describe('plan quality and retention', () => {
      const QUALITY = 'plans/quality';
      const RETENTION = 'retention';
      const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const KEEPS = ['dataStart', 'fewData', 'minPlans', 'period', 'plans', 'window', 'withoutQuality'];

      /** Every key and every string value, at any depth. */
      const words = (value: unknown): string[] => {
        if (typeof value === 'string') {
          return [value];
        }

        if (Array.isArray(value)) {
          return value.flatMap(words);
        }

        if (value !== null && typeof value === 'object') {
          return Object.entries(value).flatMap(([key, inner]) => [key, ...words(inner)]);
        }

        return [];
      };

      let subject: Account;

      beforeAll(async () => {
        subject = await register(app, `admin-retention-${Date.now()}@e2e.invalid`);
        made.push(subject.cookie);
      });

      it('do not exist for an ordinary account nor for nobody — 404 before 422 on a query they would refuse', async () => {
        for (const path of [
          QUALITY,
          `${QUALITY}?period=12`,
          `${QUALITY}?period=abc`,
          `${QUALITY}?period=7&period=30`,
          RETENTION,
          `${RETENTION}?grouping=year`,
          `${RETENTION}?grouping=week`,
          `${RETENTION}?grouping=month`,
          `${RETENTION}?grouping=month&grouping=month`
        ]) {
          const asOrdinary: Response = await get(path, ordinary.cookie);
          const asNobody: Response = await get(path);

          expect({ nobody: asNobody.status, ordinary: asOrdinary.status, path }).toEqual({ nobody: 404, ordinary: 404, path });
        }
      });

      it('refuse to the admin what they cannot read, as INVALID_INPUT', async () => {
        for (const path of [
          `${QUALITY}?period=12`,
          `${QUALITY}?period=abc`,
          `${QUALITY}?period=7&period=30`,
          `${RETENTION}?grouping=year`,
          `${RETENTION}?grouping=`,
          // Monthly only, and no query at all: even the one word it used to take is refused now.
          `${RETENTION}?grouping=week`,
          `${RETENTION}?grouping=month`,
          `${RETENTION}?grouping=month&grouping=month`,
          `${RETENTION}?grouping=month&grouping=week`,
          `${RETENTION}?period=30`
        ]) {
          await refusedAsInput(path);
        }

        for (const path of [QUALITY, `${QUALITY}?period=7`, `${QUALITY}?period=90`, RETENTION]) {
          await get(path, owner.cookie).expect(200);
        }
      });

      it('carry the quality of the plans, with exact keys at every level and a closed set of kinds', async () => {
        const view = await body<AdminPlanQualityView>(QUALITY);

        // The union on `fewData`: seven keys while there are too few plans, every key once there are enough.
        expect(keys(view)).toEqual(
          view.fewData
            ? [...KEEPS].sort()
            : [
                'advisoriesByKind',
                'dataStart',
                'days',
                'daysInBand',
                'eventDays',
                'eventDaysInBand',
                'fallbacks',
                'fewData',
                'floor',
                'loadsRefused',
                'minPlans',
                'missesByMacro',
                'period',
                'plans',
                'shares',
                'window',
                'withoutQuality'
              ].sort()
        );
        expect(view.period).toBe(30);
        expect(view.minPlans).toBe(10);
        expect(view.fewData).toBe(view.plans < view.minPlans);
        expect(keys(view.window)).toEqual(['from', 'previousFrom', 'to']);

        for (const period of [7, 90]) {
          expect((await body<AdminPlanQualityView>(`${QUALITY}?period=${period}`)).period).toBe(period);
        }
      });

      /*
       * The two branches depend on the shared database: one run proves only the
       * branch its data falls in. Whichever it is, `fewData` must agree with
       * `plans`. While fewer than 10 plans are scored the answer keeps only
       * plans, withoutQuality, dataStart, fewData, minPlans, period and window as
       * values, every other key absent (lead decision, phase 5).
       */
      it('answer with no quality figure at all while there are too few plans; exact keys and sums otherwise', async () => {
        for (const period of [7, 30, 90]) {
          const view = await body<AdminPlanQualityView>(`${QUALITY}?period=${period}`);

          expect({ fewData: view.fewData, period }).toEqual({ fewData: view.plans < 10, period });

          if (view.fewData) {
            // Exactly these seven keys, and nothing else, under `fewData`.
            expect({ keys: keys(view), period }).toEqual({ keys: [...KEEPS].sort(), period });

            // Every quality figure is absent, not zero: a zero would read as "all misses" or "none".
            for (const gone of [
              'advisoriesByKind',
              'days',
              'daysInBand',
              'eventDays',
              'eventDaysInBand',
              'fallbacks',
              'floor',
              'loadsRefused',
              'missesByMacro',
              'shares'
            ]) {
              expect({ gone, has: gone in view, period }).toEqual({ gone, has: false, period });
            }
          } else {
            expect(keys(view.floor)).toEqual(['base', 'daysNarrowed', 'daysNarrowedOutOfBand', 'since']);
            expect(keys(view.floor.base)).toEqual(['days', 'daysInBand', 'plans']);
            expect(view.fallbacks.map(entry => entry.kind)).toEqual(['full_library', 'wider_rotation']);
            expect(view.advisoriesByKind.map(entry => entry.kind).sort()).toEqual(
              ['carbs_out_of_band', 'fat_out_of_band', 'kcal_out_of_band', 'protein_above_target', 'protein_below_target', 'variety'].sort()
            );
            expect(keys(view.missesByMacro)).toEqual(['carbs', 'fat', 'kcal', 'protein']);

            for (const entry of [...view.advisoriesByKind, ...view.fallbacks]) {
              expect(keys(entry)).toEqual(['kind', 'n']);
            }

            expect(view.daysInBand).toBeLessThanOrEqual(view.days);
            expect(view.eventDaysInBand).toBeLessThanOrEqual(view.eventDays);
            expect(view.floor.daysNarrowedOutOfBand).toBeLessThanOrEqual(view.floor.daysNarrowed);
            // Never null once there are enough plans; a single figure may be, when its denominator is zero.
            expect(view.shares).not.toBeNull();
            expect(keys(view.shares)).toEqual(['eventInBand', 'floor', 'inBand', 'inBandByMacro']);
            expect(keys(view.shares.inBandByMacro)).toEqual(['carbs', 'fat', 'kcal', 'protein']);

            if (view.shares.floor) {
              expect(keys(view.shares.floor)).toEqual(['narrowedOutOfBand', 'restOutOfBand']);
            }
          }
        }
      });

      it('carry retention as cohorts of counts, with exact keys and a cell per week', async () => {
        const view = await body<AdminRetentionView>(RETENTION);

        expect(keys(view)).toEqual(['didSomething', 'eventsSince', 'minCohort', 'usedTheApp', 'weeks']);
        expect(view.minCohort).toBe(20);
        expect(view.eventsSince).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(view.weeks).toEqual([1, 2, 4]);

        for (const cohorts of [view.didSomething, view.usedTheApp]) {
          expect(cohorts).toHaveLength(6);

          for (const cohort of cohorts) {
            expect(keys(cohort)).toEqual(['cells', 'size', 'start']);
            expect(cohort.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(cohort.cells.map(cell => cell.weeks)).toEqual([1, 2, 4]);

            for (const cell of cohort.cells) {
              expect(keys(cell)).toEqual(['active', 'eligible', 'enough', 'weeks']);
              expect(cell.active ?? 0).toBeLessThanOrEqual(cell.eligible);
              expect(cell.eligible).toBeLessThanOrEqual(cohort.size);
              expect(cell.enough).toBe(cell.eligible >= view.minCohort);
              // A count of people is shown only from `minCohort` eligible people; below it, null.
              expect(cell.enough ? typeof cell.active : cell.active).toBe(cell.enough ? 'number' : null);
            }
          }

          expect(cohorts.map(cohort => cohort.start)).toEqual([...cohorts.map(cohort => cohort.start)].sort());
        }
      });

      it('put a new account in the current month’s cohort, with too few people to show a share', async () => {
        const view = await body<AdminRetentionView>(RETENTION);
        const current = view.didSomething.at(-1);

        if (!current) {
          throw new Error('Retention returned no cohort');
        }

        // The last cohort is this month; the account made in `beforeAll` is one of its people.
        // Madrid's month, as the console keys it: near midnight on the last day, UTC is still the month before.
        expect(current.start).toBe(`${madridDay(new Date().toISOString()).slice(0, 7)}-01`);
        expect(current.size).toBeGreaterThanOrEqual(1);
        expect(current.cells.map(cell => ({ active: cell.active, enough: cell.enough }))).toEqual(
          current.cells.map(() => ({ active: null, enough: false }))
        );
        expect(view.usedTheApp.at(-1)?.size).toBeGreaterThanOrEqual(1);
        expect(view.usedTheApp.at(-1)?.cells.map(cell => cell.active)).toEqual([null, null, null]);
        expect(subject.email).toContain('admin-retention-');
      });

      // The window ends at today's Madrid midnight (`windowFor`): a plan made now belongs to a day not yet over.
      it('end at today’s midnight, so a plan generated now does not raise today’s count', async () => {
        const counts = async () => {
          const both = await Promise.all([7, 30].map(period => body<AdminPlanQualityView>(`${QUALITY}?period=${period}`)));

          return both.map(view => ({ plans: view.plans, to: view.window.to, withoutQuality: view.withoutQuality }));
        };

        const before = await counts();
        const madrid = new Intl.DateTimeFormat('en-GB', { hourCycle: 'h23', timeStyle: 'medium', timeZone: 'Europe/Madrid' }).format(
          new Date(before[0]?.to ?? '')
        );

        expect(madrid).toBe('00:00:00');

        await completeOnboarding(app, subject);
        expect((await generateAndWait(app, subject)).status).toBe('succeeded');
        expect(await counts()).toEqual(before);
      });

      it('name no account: no key or value in the answers looks like a user, an address or an id', async () => {
        const bodies = [
          await body<AdminPlanQualityView>(QUALITY),
          await body<AdminRetentionView>(RETENTION),
          await body<AdminCatalogueQualityView>('catalogue/quality')
        ];
        const seeded = [owner, ordinary, subject].flatMap(account => [account.email, account.email.split('@')[0] ?? account.email, account.id]);

        for (const view of bodies) {
          const text = JSON.stringify(view);

          // No key names a user or an address, no value is an address or an id. (A recipe's `source: 'user'` is a value, not an account.)
          expect(words(view).filter(word => /email|@/i.test(word) || UUID.test(word))).toEqual([]);
          expect(Object.keys(view).filter(key => /user|email/i.test(key))).toEqual([]);

          for (const needle of seeded) {
            expect({ leaked: text.includes(needle), needle: needle.slice(0, 12) }).toEqual({ leaked: false, needle: needle.slice(0, 12) });
          }
        }
      });
    });

    /*
     * "Active" is a sign-in or a use (`0071`): `app_used` counts, on the
     * table's `lastActiveAt` and on the console's active people; a swap does
     * not. Scoped to this test's own account; the delta on the shared totals
     * is exactly one person.
     */
    describe('"active"', () => {
      let subject: Account;

      beforeAll(async () => {
        subject = await register(app, `admin-active-${Date.now()}@e2e.invalid`);
        made.push(subject.cookie);
        // Registering signs in, which is an active event: start from an account with none.
        await forgetActivity(subject.email);
      });

      const write = async (event: string) => {
        const sql = (
          database() as unknown as { readonly $client: <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]> }
        ).$client;

        await sql`insert into analytics_events (event, user_id) select ${event}, id from "user" where email = ${subject.email} and email like '%@e2e.invalid'`;
      };

      const lastActive = async () => {
        const page = (await get(`accounts?q=${encodeURIComponent(subject.email)}`, owner.cookie).expect(200)).body as Paged<AccountView>;

        return page.rows.find(row => row.email === subject.email)?.lastActiveAt;
      };

      const activePeople = async () => {
        const summary = (await get('summary?period=7', owner.cookie).expect(200)).body as AdminSummaryView;
        const product = (await get('product?period=7', owner.cookie).expect(200)).body as AdminProductView;

        return { summary: summary.tiles.activePeople.current, today: product.activePeople.values.at(-1) ?? 0 };
      };

      it('moves on a use, and not on a swap alone', async () => {
        const before = await activePeople();

        expect(await lastActive()).toBeNull();

        await write('swap_requested');

        expect(await lastActive()).toBeNull();
        expect(await activePeople()).toEqual(before);

        await write('app_used');

        expect(await lastActive()).toMatch(INSTANT);

        const after = await activePeople();

        expect(after.summary).toBe(before.summary + 1);
        expect(after.today).toBe(before.today + 1);
      });
    });
  });
});
