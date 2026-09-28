import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { SettingsController } from 'core/controllers/Settings';
import { ANALYTICS_EVENTS } from 'core/entities/Analytics';
import { UserController } from 'core/controllers/User';

import { activationToken } from '../src/modules/auth/services/ActivationLink.js';

import { createApp, deleteAccountByEmail, deleteAccounts, httpServer, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { AccountView, Paged } from 'core/controllers/User';
import type { AdminAnalyticsView, AdminPlansView, AdminProductView, AdminSummaryView, AiUsageView, DaySeries } from 'core/controllers/Admin';
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

/** The console's reads over a period (`0068`, project 007 phase 3). */
const PERIOD_ROUTES = ['summary', 'product', 'plans'] as const;

/**
 * Every key the three period reads may carry, at any depth. Exhaustive, so a
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
  'created'
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
    app = await createApp(new ScriptedAiClient([]));

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
    expect(Object.keys(queued ?? {}).sort()).toEqual(['activated', 'createdAt', 'email', 'emailVerified', 'id', 'role', 'tier']);
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
});
