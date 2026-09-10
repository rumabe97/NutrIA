import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { completeOnboarding, createApp, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { AllowancesView, PlanSummaryView, PlanView } from 'core/controllers/Plan';
import type { INestApplication } from '@nestjs/common';
import type { ProgressSummaryView, WeightView } from 'core/controllers/Progress';
import type { Response } from 'supertest';

/**
 * Living inside a plan: marking meals, logging a weight, reading the fortnight
 * back, and the two limits that make a plan a plan (`0016`, `0020`, `0021`).
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
describe('plan lifecycle', () => {
  let app: INestApplication;
  let account: Account;
  let stranger: Account;
  let plan: PlanView;

  const activePlan = async (who: Account): Promise<PlanView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', who.cookie).expect(200);

    return response.body as PlanView;
  };

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));

    const stamp = Date.now();

    account = await register(app, `lifecycle-${stamp}@e2e.invalid`);
    stranger = await register(app, `lifecycle-other-${stamp}@e2e.invalid`);
    await completeOnboarding(app, account);
    // Finished too, so a refusal below is about ownership and not about a
    // half-filled profile — those are different guards and different codes.
    await completeOnboarding(app, stranger);

    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');
    plan = await activePlan(account);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('remembers a meal marked eaten, and one marked skipped', async () => {
    const server = httpServer(app);
    const [eaten, skipped] = plan.days[0].meals;

    await request(server).patch(`/${PREFIX}/meal-plans/meals/${eaten.id}/status`).set('Cookie', account.cookie).send({ status: 'completed' }).expect(200);
    await request(server).patch(`/${PREFIX}/meal-plans/meals/${skipped.id}/status`).set('Cookie', account.cookie).send({ status: 'skipped' }).expect(200);

    const after = await activePlan(account);
    const marks = new Map(after.days[0].meals.map(meal => [meal.id, meal.status]));

    expect(marks.get(eaten.id)).toBe('completed');
    expect(marks.get(skipped.id)).toBe('skipped');
  });

  it('will not mark a meal whose day has not come', async () => {
    const server = httpServer(app);
    // Day one is today, so day two is tomorrow whatever the clock says.
    const tomorrow = plan.days[1].meals[0];
    const refused: Response = await request(server).patch(`/${PREFIX}/meal-plans/meals/${tomorrow.id}/status`).set('Cookie', account.cookie).send({ status: 'completed' }).expect(409);

    expect((refused.body as { code: string }).code).toBe('MEAL_IN_FUTURE');

    // Today's is fine, and so is yesterday's would be: catching up is ordinary,
    // predicting is not.
    await request(server).patch(`/${PREFIX}/meal-plans/meals/${plan.days[0].meals[0].id}/status`).set('Cookie', account.cookie).send({ status: 'completed' }).expect(200);
  });

  it('will not let one account mark another account meal', async () => {
    await request(httpServer(app)).patch(`/${PREFIX}/meal-plans/meals/${plan.days[1].meals[0].id}/status`).set('Cookie', stranger.cookie).send({ status: 'completed' }).expect(404);
  });

  it('shows one plan and one only as active, and lists the fortnight in the history', async () => {
    const server = httpServer(app);
    const history: Response = await request(server).get(`/${PREFIX}/meal-plans`).set('Cookie', account.cookie).expect(200);
    const plans = history.body as PlanSummaryView[];

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ id: plan.id, replaced: false });

    const read: Response = await request(server).get(`/${PREFIX}/meal-plans/${plan.id}`).set('Cookie', account.cookie).expect(200);

    expect((read.body as PlanView).days).toHaveLength(plan.days.length);
  });

  it('does not show one account plan to another, by id or by list', async () => {
    const server = httpServer(app);

    await request(server).get(`/${PREFIX}/meal-plans/${plan.id}`).set('Cookie', stranger.cookie).expect(404);
    await request(server).get(`/${PREFIX}/meal-plans/${plan.id}/days/1`).set('Cookie', stranger.cookie).expect(404);

    const theirs: Response = await request(server).get(`/${PREFIX}/meal-plans`).set('Cookie', stranger.cookie).expect(200);

    expect(theirs.body).toEqual([]);
  });

  it('spends the fortnight redo, then refuses a second generation with 429', async () => {
    const server = httpServer(app);
    const before: Response = await request(server).get(`/${PREFIX}/meal-plans/allowances`).set('Cookie', account.cookie).expect(200);

    expect((before.body as AllowancesView).planRedo).toMatchObject({ allowed: true, kind: 'redo', used: 0 });

    const redone = await generateAndWait(app, account);

    expect(redone.status).toBe('succeeded');

    const after: Response = await request(server).get(`/${PREFIX}/meal-plans/allowances`).set('Cookie', account.cookie).expect(200);

    expect((after.body as AllowancesView).planRedo).toMatchObject({ allowed: false, used: 1 });
    // A spent allowance is a 429 with a date, never a silent refusal.
    await request(server).post(`/${PREFIX}/meal-plans/generate`).set('Cookie', account.cookie).expect(429);
  });

  it('keeps the replaced plan in the history, and it is still readable as it was', async () => {
    const history: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans`).set('Cookie', account.cookie).expect(200);
    const plans = history.body as PlanSummaryView[];

    expect(plans.length).toBeGreaterThan(1);

    const old = plans.find(row => row.id === plan.id);

    // The past is read-only, not deleted (`0021`).
    expect(old).toBeDefined();
    await request(httpServer(app)).get(`/${PREFIX}/meal-plans/${plan.id}`).set('Cookie', account.cookie).expect(200);
  });

  it('logs a weight, replaces it on the same day, and reads it back on the progress line', async () => {
    const server = httpServer(app);

    await request(server).post(`/${PREFIX}/progress/weight`).set('Cookie', account.cookie).send({ weightKg: 71.5 }).expect(201);

    const corrected: Response = await request(server).post(`/${PREFIX}/progress/weight`).set('Cookie', account.cookie).send({ weightKg: 71.2 }).expect(201);
    const weight = corrected.body as WeightView;

    // Two readings on one day are a correction, not a trend.
    expect(weight.entries.filter(entry => entry.loggedOn === weight.entries[0].loggedOn)).toHaveLength(1);
    expect(weight.latestKg).toBe(71.2);

    const summary: Response = await request(server).get(`/${PREFIX}/progress/summary`).set('Cookie', account.cookie).expect(200);

    expect((summary.body as ProgressSummaryView).fortnights.length).toBeGreaterThan(0);
  });
});
