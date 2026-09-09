import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { activeShoppingList, completeOnboarding, createApp, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { AllowancesView, PlanView } from 'core/controllers/Plan';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * Replacing one meal of a plan (`0015`, `0022`).
 *
 * Three promises, and the suite is one test each: the replacement is a
 * different dish in the same slot, the shopping list is rebuilt so it still
 * matches the plan it belongs to, and the fortnight's allowance is finite and
 * says so with a 429 rather than by quietly refusing.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
const SWAPS_PER_PLAN = 5;

describe('meal swaps', () => {
  let app: INestApplication;
  let account: Account;
  let stranger: Account;
  let plan: PlanView;

  const activePlan = async (who: Account): Promise<PlanView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', who.cookie).expect(200);

    return response.body as PlanView;
  };

  const allowances = async (): Promise<AllowancesView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/allowances`).set('Cookie', account.cookie).expect(200);

    return response.body as AllowancesView;
  };

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));

    const stamp = Date.now();

    account = await register(app, `swap-${stamp}@e2e.invalid`);
    stranger = await register(app, `swap-other-${stamp}@e2e.invalid`);
    await completeOnboarding(app, account);
    // Finished too, so the refusal below is about ownership rather than about a
    // half-filled profile.
    await completeOnboarding(app, stranger);

    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');
    plan = await activePlan(account);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('replaces the meal with a different dish in the same slot, and rebuilds the list', async () => {
    const target = plan.days[0].meals[0];
    const before = await activeShoppingList(app, account);

    await request(httpServer(app)).post(`/${PREFIX}/meal-plans/meals/${target.id}/swap`).set('Cookie', account.cookie).send({}).expect(201);

    const after = await activePlan(account);
    const replacement = after.days[0].meals.find(meal => meal.slot === target.slot);

    // The dish changes; the meal keeps its identity, which is what lets the swap
    // stay auditable through `replacedFromMealId`.
    expect(replacement?.name).not.toBe(target.name);
    expect(replacement?.slot).toBe(target.slot);

    /*
     * The list is not patched, it is rebuilt from the plan — so what it must
     * still be is *reconciled*: nothing in it that the plan does not ask for.
     * Not "different from before": a replacement made of the same ingredients
     * in different amounts is a perfectly good swap, and asserting the names
     * changed would fail on it while proving nothing.
     */
    const list = await activeShoppingList(app, account);
    const planned = new Set(after.days.flatMap(day => day.meals.flatMap(meal => meal.ingredients.map(ingredient => ingredient.name))));

    expect(list.items.length).toBeGreaterThan(0);
    expect(before.items.length).toBeGreaterThan(0);

    for (const item of list.items) {
      expect(planned.has(item.name)).toBe(true);
    }
  });

  it('spends one allowance per swap and refuses the sixth with 429, not silence', async () => {
    const server = httpServer(app);
    const start = await allowances();

    expect(start.mealSwaps.used).toBe(1);
    expect(start.mealSwaps.limit).toBe(SWAPS_PER_PLAN);

    for (let spent = start.mealSwaps.used; spent < SWAPS_PER_PLAN; spent += 1) {
      const current = await activePlan(account);
      const meal = current.days[spent].meals[0];

      await request(server).post(`/${PREFIX}/meal-plans/meals/${meal.id}/swap`).set('Cookie', account.cookie).send({}).expect(201);
    }

    const spent = await allowances();

    expect(spent.mealSwaps).toMatchObject({ allowed: false, used: SWAPS_PER_PLAN });

    const current = await activePlan(account);
    const refused: Response = await request(server)
      .post(`/${PREFIX}/meal-plans/meals/${current.days[6].meals[0].id}/swap`)
      .set('Cookie', account.cookie)
      .send({})
      .expect(429);

    expect((refused.body as { code: string }).code).toBe('QUOTA_EXCEEDED');
  });

  it('will not swap a meal that belongs to somebody else', async () => {
    const target = (await activePlan(account)).days[0].meals[0];

    // A 404, like every denial: a 403 would confirm the meal exists.
    await request(httpServer(app)).post(`/${PREFIX}/meal-plans/meals/${target.id}/swap`).set('Cookie', stranger.cookie).send({}).expect(404);
  });
});
