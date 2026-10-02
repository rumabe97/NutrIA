import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { PlanJobController } from 'core/controllers/Plan';
import { QuotaExceededError } from 'core/entities/Error';

import { database } from 'database';

import {
  activeShoppingList,
  completeOnboarding,
  createApp,
  deleteAccounts,
  generateAndWait,
  httpServer,
  planRow,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient,
  shiftPlansBack
} from './harness.js';

import type { Account, JobResult } from './harness.js';
import type { AllowancesView, PlanView } from 'core/controllers/Plan';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * A plan waits for its day (project 015, PRD criteria 2–6).
 *
 * - while a plan runs, the next fortnight can be started on a later day: it is
 *   `scheduled`, costs nothing, leaves the running plan as it was, and has its
 *   own shopping list and its meals can be swapped;
 * - on its day it becomes the active plan and the one before it is completed with
 *   `completedAt` = the day before — by the cron, and by the first read of the
 *   active plan, whichever comes first;
 * - a start inside the running plan cuts it short and counts a redo;
 * - replacing a scheduled plan counts a redo too;
 * - a start outside today..today+7 is a 422 `INVALID_INPUT` and starts nothing.
 *
 * There is no fake clock. "Today" is read off the first plan the account makes
 * (the server's own, in the person's timezone), and a later day is reached by
 * moving the account's plan dates back in the database (`shiftPlansBack`).
 *
 * Requires DATABASE_URL and a seeded catalogue. See ./README.md.
 */

const DAY_MS = 86_400_000;

/** `date` plus `days`, as `YYYY-MM-DD`. Pure date arithmetic in UTC, so no timezone can move it. */
function plus(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

describe('a plan waits for its day, end to end', () => {
  let app: INestApplication;
  const made: string[] = [];
  const cronSecret = randomBytes(24).toString('hex');
  const previousCronSecret = process.env['CRON_SECRET'];

  const server = (): ReturnType<typeof httpServer> => httpServer(app);
  const get = (account: Account, path: string): request.Test => request(server()).get(`/${PREFIX}${path}`).set('Cookie', account.cookie);
  const view = async (account: Account, path: string): Promise<PlanView> => (await get(account, path).expect(200)).body as PlanView;
  const allowances = async (account: Account): Promise<AllowancesView> => (await get(account, '/meal-plans/allowances').expect(200)).body as AllowancesView;

  const person = async (label: string): Promise<Account> => {
    const account = await register(app, `scheduled-${label}-${Date.now()}@e2e.invalid`);

    made.push(account.cookie);
    await completeOnboarding(app, account);

    return account;
  };

  /** Starts a generation from `startDate`, waits for it, and returns the job. */
  const generateFrom = async (account: Account, startDate: string): Promise<JobResult> => {
    const started: Response = await request(server()).post(`/${PREFIX}/meal-plans/generate`).set('Cookie', account.cookie).send({ startDate }).expect(201);
    const jobId = (started.body as { id: string }).id;

    for (let waited = 0; waited < 120_000; waited += 250) {
      await new Promise(resolve => setTimeout(resolve, 250));

      const job = (await get(account, `/meal-plans/jobs/${jobId}`).expect(200)).body as JobResult;

      if (job.status === 'succeeded' || job.status === 'failed') {
        return job;
      }
    }

    throw new Error('Generation did not finish within the timeout');
  };

  /**
   * An account with a running plan that has `daysLeft` days to go, and the
   * person's today. The plan is generated today and moved back, so it ends
   * `daysLeft - 1` days from now.
   */
  const withRunningPlan = async (label: string, shiftBack: number): Promise<{ account: Account; running: PlanView; today: string }> => {
    const account = await person(label);

    expect((await generateAndWait(app, account, 120_000)).status).toBe('succeeded');

    const fresh = await view(account, '/meal-plans/active');
    const today = fresh.startDate;

    if (shiftBack > 0) {
      await shiftPlansBack(account.id, shiftBack);
    }

    return { account, running: await view(account, '/meal-plans/active'), today };
  };

  beforeAll(async () => {
    process.env['CRON_SECRET'] = cronSecret;
    app = await createApp(new ScriptedAiClient(POOL));
  }, 180_000);

  afterAll(async () => {
    await deleteAccounts(app, made);

    if (previousCronSecret === undefined) {
      delete process.env['CRON_SECRET'];
    } else {
      process.env['CRON_SECRET'] = previousCronSecret;
    }

    await app?.close();
  });

  describe('the next fortnight, while the running plan is still running', () => {
    let owner: Account;
    let stranger: Account;
    let running: PlanView;
    let today: string;
    let scheduled: PlanView;

    beforeAll(async () => {
      // Eight days in: the running plan ends today + 5, so today + 6 is the first day after it.
      ({ account: owner, running, today } = await withRunningPlan('next', 8));
      stranger = await person('next-other');
      expect(running.endDate).toBe(plus(today, 5));
    }, 240_000);

    it('offers the days, and defaults to the day after the running plan', async () => {
      const offered = await allowances(owner);

      expect(offered.defaultStart).toBe(plus(running.endDate, 1));
      expect(Array.isArray(offered.startOptions)).toBe(true);
      expect(offered.startOptions.length).toBeGreaterThan(0);
      expect(JSON.stringify(offered.startOptions)).toContain(offered.defaultStart);
    });

    it('schedules it for free, and leaves the running plan exactly as it was', async () => {
      const before = await allowances(owner);

      expect(before.planRedo).toMatchObject({ allowed: true, used: 0 });

      const job = await generateFrom(owner, plus(today, 6));

      expect(job.status).toBe('succeeded');

      scheduled = await view(owner, '/meal-plans/scheduled');

      expect(scheduled.id).toBe(job.planId);
      expect(scheduled.status).toBe('scheduled');
      expect(scheduled.startDate).toBe(plus(today, 6));
      expect(scheduled.endDate).toBe(plus(today, 19));
      expect(scheduled.days).toHaveLength(14);
      expect([...scheduled.days].sort((a, b) => a.dayIndex - b.dayIndex)[0]?.date).toBe(plus(today, 6));

      // Free: no redo was spent.
      expect((await allowances(owner)).planRedo).toMatchObject({ used: 0 });

      // The running plan is the active one, with every day it had and the end it had.
      const stillRunning = await view(owner, '/meal-plans/active');

      expect(stillRunning.id).toBe(running.id);
      expect(stillRunning.status).toBe('active');
      expect(stillRunning.endDate).toBe(running.endDate);
      expect(stillRunning.days).toHaveLength(running.days.length);
      expect(await planRow(running.id)).toMatchObject({ completedAt: null, status: 'active' });
    }, 200_000);

    it('has a shopping list of its own', async () => {
      const list = (await get(owner, '/meal-plans/scheduled/shopping-list').expect(200)).body as { items: { name: string }[] };

      expect(list.items.length).toBeGreaterThan(0);
    });

    it('lets a meal of it be swapped, and not marked eaten before its day', async () => {
      const target = scheduled.days.find(day => day.dayIndex === 1)!.meals[0]!;

      await request(server()).post(`/${PREFIX}/meal-plans/meals/${target.id}/swap`).set('Cookie', owner.cookie).send({}).expect(201);

      const after = await view(owner, '/meal-plans/scheduled');
      const replacement = after.days.find(day => day.dayIndex === 1)!.meals.find(meal => meal.slot === target.slot);

      expect(replacement?.name).not.toBe(target.name);

      const marked = await request(server())
        .patch(`/${PREFIX}/meal-plans/meals/${target.id}/status`)
        .set('Cookie', owner.cookie)
        .send({ status: 'completed' });

      expect(marked.status).toBeGreaterThanOrEqual(400);
    });

    it('is nobody else’s to read, list or swap: a 404, and a 404 when there is none', async () => {
      const target = scheduled.days[0]!.meals[0]!;

      await get(stranger, '/meal-plans/scheduled').expect(404);
      await get(stranger, '/meal-plans/scheduled/shopping-list').expect(404);
      await get(stranger, `/meal-plans/${scheduled.id}`).expect(404);
      await request(server()).post(`/${PREFIX}/meal-plans/meals/${target.id}/swap`).set('Cookie', stranger.cookie).send({}).expect(404);
      // The refusal says the same as a meal that does not exist: nothing tells them it is somebody's.
      const unknown: Response = await request(server())
        .post(`/${PREFIX}/meal-plans/meals/00000000-0000-4000-8000-000000000000/swap`)
        .set('Cookie', stranger.cookie)
        .send({});
      const foreign: Response = await request(server()).post(`/${PREFIX}/meal-plans/meals/${target.id}/swap`).set('Cookie', stranger.cookie).send({});

      expect(foreign.status).toBe(unknown.status);
      expect(foreign.body).toEqual(unknown.body);
      expect(((await get(stranger, '/meal-plans').expect(200)).body as unknown[]).map(plan => (plan as { id: string }).id)).not.toContain(scheduled.id);
    });

    it('is replaced, not stacked, by a second one — and that counts a redo', async () => {
      // today + 7 is the last day the window allows.
      const job = await generateFrom(owner, plus(today, 7));

      expect(job.status).toBe('succeeded');

      const now = await view(owner, '/meal-plans/scheduled');

      expect(now.id).toBe(job.planId);
      expect(now.startDate).toBe(plus(today, 7));
      // The replaced plan is gone, not left behind: one scheduled plan per account.
      expect(await planRow(scheduled.id)).toBeNull();
      expect((await allowances(owner)).planRedo).toMatchObject({ allowed: false, used: 1 });

      /*
       * The free redo is spent: another replacement is refused as a spent allowance
       * and changes nothing. Through the controller, not the route: generating is
       * limited to three requests an hour per account, and this account has made
       * three, so over HTTP the refusal would be the rate limiter's 429, not the
       * allowance's.
       */
      await expect(PlanJobController.start(owner.id, undefined, plus(today, 6))).rejects.toBeInstanceOf(QuotaExceededError);
      expect((await view(owner, '/meal-plans/scheduled')).id).toBe(now.id);
      expect((await view(owner, '/meal-plans/active')).id).toBe(running.id);
    }, 300_000);
  });

  describe('its day comes', () => {
    it('the cron completes the running plan the day before and activates the next one', async () => {
      const { account, running, today } = await withRunningPlan('cron', 8);
      const start = plus(today, 6);

      expect((await generateFrom(account, start)).status).toBe('succeeded');

      const next = await view(account, '/meal-plans/scheduled');

      // Six days on, the scheduled plan's first day is today. Nothing reads the plan before the cron runs.
      await shiftPlansBack(account.id, 6);

      await request(server()).get(`/${PREFIX}/cron/activate-plans`).expect(404);
      await request(server()).get(`/${PREFIX}/cron/activate-plans`).set('Authorization', 'Bearer wrong').expect(404);
      expect(await planRow(next.id)).toMatchObject({ status: 'scheduled' });

      await request(server()).get(`/${PREFIX}/cron/activate-plans`).set('Authorization', `Bearer ${cronSecret}`).expect(200);

      expect(await planRow(running.id)).toMatchObject({ completedAt: plus(today, -1), status: 'completed' });
      expect(await planRow(next.id)).toMatchObject({ startDate: today, status: 'active' });
      expect((await view(account, '/meal-plans/active')).id).toBe(next.id);
      await get(account, '/meal-plans/scheduled').expect(404);

      // Running it again changes nothing.
      await request(server()).get(`/${PREFIX}/cron/activate-plans`).set('Authorization', `Bearer ${cronSecret}`).expect(200);
      expect(await planRow(running.id)).toMatchObject({ completedAt: plus(today, -1), status: 'completed' });
      expect(await planRow(next.id)).toMatchObject({ status: 'active' });
      expect((await view(account, '/meal-plans/active')).id).toBe(next.id);
    }, 300_000);

    it('a scheduled plan older than the active one is deleted on activation, never activated', async () => {
      const { account, running, today } = await withRunningPlan('rolled', 8);

      expect((await generateFrom(account, plus(today, 6))).status).toBe('succeeded');

      const next = await view(account, '/meal-plans/scheduled');
      const sql = (database() as unknown as { readonly $client: <Row>(strings: TemplateStringsArray, ...values: readonly unknown[]) => Promise<Row[]> })
        .$client;

      // What an API rolled back and forth could leave: the scheduled plan numbered below the running one.
      await sql`update meal_plans set version = 50 where id = ${running.id}`;
      await sql`update meal_plans set version = 40 where id = ${next.id}`;
      await shiftPlansBack(account.id, 6);

      const active = await view(account, '/meal-plans/active');

      expect(active.id).toBe(running.id);
      expect(await planRow(next.id)).toBeNull();
      expect(await planRow(running.id)).toMatchObject({ completedAt: null, status: 'active' });
      await get(account, '/meal-plans/scheduled').expect(404);
    }, 300_000);

    it('is run at 23:05 UTC, so that the person’s midnight has passed in Madrid in summer and in winter', () => {
      const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { crons: { path: string; schedule: string }[] };

      expect(config.crons.find(cron => cron.path === '/api/v1/cron/activate-plans')?.schedule).toBe('5 23 * * *');
    });

    it('a plan that is not yet due is left alone by the cron', async () => {
      const { account, running, today } = await withRunningPlan('early', 8);

      expect((await generateFrom(account, plus(today, 7))).status).toBe('succeeded');

      const next = await view(account, '/meal-plans/scheduled');

      // Only one day on: the scheduled plan starts tomorrow.
      await shiftPlansBack(account.id, 6);
      await request(server()).get(`/${PREFIX}/cron/activate-plans`).set('Authorization', `Bearer ${cronSecret}`).expect(200);

      expect(await planRow(next.id)).toMatchObject({ status: 'scheduled' });
      expect(await planRow(running.id)).toMatchObject({ status: 'active' });
    }, 300_000);
  });

  describe('cutting the running plan short', () => {
    it('counts a redo, ends it the day before, and the next plan takes over on its day when the active plan is read', async () => {
      const { account, running, today } = await withRunningPlan('cut', 0);
      const start = plus(today, 3);

      expect((await allowances(account)).planRedo).toMatchObject({ allowed: true, used: 0 });

      const listBefore = await activeShoppingList(app, account);
      const job = await generateFrom(account, start);

      expect(job.status).toBe('succeeded');

      // A redo was spent.
      expect((await allowances(account)).planRedo).toMatchObject({ allowed: false, used: 1 });

      // A is still the active plan, three days long now: its days after the cut are gone.
      const cut = await view(account, '/meal-plans/active');

      expect(cut.id).toBe(running.id);
      expect(cut.status).toBe('active');
      expect(cut.endDate).toBe(plus(today, 2));
      expect(cut.days.map(day => day.date).sort()).toEqual([today, plus(today, 1), plus(today, 2)]);
      expect(await planRow(running.id)).toMatchObject({ endDate: plus(today, 2), status: 'active' });
      expect((await view(account, '/meal-plans/scheduled')).startDate).toBe(start);

      // The list is rebuilt for the days that are kept: it cannot be longer than it was.
      const listAfter = await activeShoppingList(app, account);

      expect(listAfter.items.length).toBeGreaterThan(0);
      expect(listAfter.items.length).toBeLessThanOrEqual(listBefore.items.length);

      // No redo left: another start is refused as a spent allowance, and the first is untouched.
      // Through the controller: the route's own limit is three generations an hour.
      // Whatever the day: a later one (replacing the scheduled plan), the same one, or an earlier one (cutting again).
      for (const day of [1, 2, 3, 4, 7]) {
        await expect(PlanJobController.start(account.id, undefined, plus(today, day))).rejects.toBeInstanceOf(QuotaExceededError);
      }

      expect((await view(account, '/meal-plans/scheduled')).startDate).toBe(start);

      // Three days on, no cron: the first read of the active plan does the switch.
      await shiftPlansBack(account.id, 3);

      const switched = await view(account, '/meal-plans/active');

      expect(switched.id).toBe(job.planId);
      expect(switched.status).toBe('active');
      expect(await planRow(running.id)).toMatchObject({ completedAt: plus(today, 2 - 3), status: 'completed' });
      await get(account, '/meal-plans/scheduled').expect(404);
    }, 300_000);
  });

  describe('a start the window does not allow', () => {
    it('is a 422 INVALID_INPUT, before any job exists', async () => {
      const utcToday = new Date().toISOString().slice(0, 10);
      // Generating is limited to three requests an hour per account, so the refusals
      // are spread over two accounts, and each keeps one request for a plain generation.
      const first = await person('window');
      const second = await person('window-b');
      const attempts: [Account, string][] = [
        [first, plus(utcToday, 10)],
        [first, plus(utcToday, -3)],
        [second, '2026-13-45'],
        [second, 'tomorrow']
      ];

      for (const [account, startDate] of attempts) {
        const answer: Response = await request(server()).post(`/${PREFIX}/meal-plans/generate`).set('Cookie', account.cookie).send({ startDate });

        expect({ code: (answer.body as { code?: string }).code, startDate, status: answer.status }).toEqual({
          code: 'INVALID_INPUT',
          startDate,
          status: 422
        });
      }

      // Nothing was started: no plan, nothing spent, and a plain generation still works.
      for (const account of [first, second]) {
        await get(account, '/meal-plans/active').expect(res => expect([200, 404]).toContain(res.status));
        expect((await allowances(account)).planRedo).toMatchObject({ allowed: true, used: 0 });
        expect((await generateAndWait(app, account, 120_000)).status).toBe('succeeded');
      }
    }, 300_000);
  });
});
