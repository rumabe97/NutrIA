import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { SettingsController } from 'core/controllers/Settings';
import { ANALYTICS_EVENTS } from 'core/entities/Analytics';
import { UserController } from 'core/controllers/User';
import { database } from 'database';

import { activationToken } from '../src/modules/auth/services/ActivationLink.js';

import {
  completeOnboarding,
  createApp,
  deleteAccountByEmail,
  deleteAccounts,
  generateAndWait,
  httpServer,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient
} from './harness.js';

import type { Account } from './harness.js';
import type { AccountView, Paged } from 'core/controllers/User';
import type {
  AdminAnalyticsView,
  AdminPeopleView,
  AdminPlansView,
  AdminProductView,
  AdminSummaryView,
  AiUsageView,
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
const ROUTES = ['overview', 'failures', 'accounts', 'settings', 'analytics', 'ai', 'feedback'];

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
  ...ANALYTICS_EVENTS.filter(event => event !== 'ai_call')
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
  let owner: Account;
  let ordinary: Account;
  let waiting: string;
  /** Every account this suite registered and kept a cookie for; `waiting` and the link test's account never signed in, so `afterAll` deletes those by email instead. */
  const made: string[] = [];
  const byEmail: string[] = [];

  beforeAll(async () => {
    // The pool is for the people tables' one generated plan (the `plans` column); nothing else here asks the model.
    app = await createApp(new ScriptedAiClient(POOL));

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

  it('counts what the provider was asked for today, and says whose number the limit is', async () => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/admin/ai`).set('Cookie', owner.cookie).expect(200);
    const usage = response.body as AiUsageView;

    // The suites script the model, so nothing reaches a provider and the count
    // is zero — which is the assertion: it counts real requests, not scripted
    // ones. `limits` is null unless an operator configured it (`0035`).
    expect(usage).toMatchObject({ calls: 0, refused: 0 });
    expect(usage.limits).toEqual({ requestsPerDay: null, tokensPerMinute: null });
    expect(Date.parse(usage.resetsAt)).toBeGreaterThan(Date.now());
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

  it('refuses an account id that is not an account', async () => {
    await request(httpServer(app)).post(`/${PREFIX}/admin/accounts/not-an-account/activate`).set('Cookie', owner.cookie).expect(404);
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
        expectDays(product.activePeople, period, product.window.to);
        expectDays(product.events, period, product.window.to);
        expectDays(plans.created, period, plans.window.to);

        // Every key present, zeros included, so a legend does not change with what happened.
        expect(summary.charts.generations.series.map(row => row.key)).toEqual(['queued', 'running', 'succeeded', 'failed']);
        expect(plans.byState.map(row => row.status)).toEqual(['draft', 'generating', 'active', 'completed', 'archived', 'failed', 'pending_review']);

        for (const row of [...summary.charts.generations.series, ...product.events.series]) {
          expect(row.values).toHaveLength(period);
        }

        // Sessions and swaps are charted; a provider request is not something a person did.
        const events = product.events.series.map(row => row.key);

        expect(events).toEqual(expect.arrayContaining(['session_started', 'swap_requested']));
        expect(events).not.toContain('ai_call');
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
    const TABLE_ROUTES = ['accounts', 'feedback', 'professionals', 'people'] as const;
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
      const refusable = ['accounts?sort=nonsense', 'accounts?q=a%00b', 'feedback?state=x', 'professionals?sort=x', 'people?period=14'];

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
});
