import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { completeOnboarding, createApp, deleteAccounts, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { FixedMealsView } from 'core/controllers/FixedMeal';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';
import type { Response } from 'supertest';

/**
 * A meal fixed to one day of the week, for ever (`0098`, `0099`).
 *
 * The assertions that matter are the ones no unit test can make: that the dish
 * the route offers is one the *database's* own pool holds, that the limit and
 * the one-rule-per-weekday constraint refuse what they should at the HTTP
 * boundary, and that a plan generated afterwards really serves that dish on
 * that day.
 *
 * **The free tier's numbers are hard-coded here**, as `events-premium`
 * hard-codes premium's: a change to what a tier allows is a change to this file
 * too. Both of the screen's allowances are read here, because `GET /fixed-meals`
 * answers with both (`0011` § 4 a) — a free account may fix one meal and ask for
 * no dish at all, and it has to be told the second before it types a name.
 * `dish-request.e2e-spec.ts` is where asking for one is proved.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
const FIXED_MEALS_FREE = 1;
const DISH_REQUESTS_FREE = 0;
/** What a free account's dish requests always read: none, none left, not allowed. */
const NO_DISH_REQUESTS = { allowed: false, limit: DISH_REQUESTS_FREE, remaining: DISH_REQUESTS_FREE, used: 0 };

/** 0 is Monday, as `weekdayOf` counts (`core/entities/FixedMeal`). */
function weekdayOf(isoDate: string): number {
  return (new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7;
}

describe('fixed meals', () => {
  let app: INestApplication;
  let account: Account;
  let stranger: Account;
  const made: string[] = [];

  const standing = async (who: Account): Promise<FixedMealsView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/fixed-meals`).set('Cookie', who.cookie).expect(200);

    return response.body as FixedMealsView;
  };

  const fixable = async (who: Account, weekday: number, slot: string): Promise<readonly { readonly name: string; readonly slug: string }[]> => {
    const response: Response = await request(httpServer(app))
      .get(`/${PREFIX}/fixed-meals/fixable?weekday=${weekday}&slot=${slot}`)
      .set('Cookie', who.cookie)
      .expect(200);

    return response.body as readonly { readonly name: string; readonly slug: string }[];
  };

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));

    const stamp = Date.now();

    account = await register(app, `fixed-meal-${stamp}@e2e.invalid`);
    made.push(account.cookie);
    stranger = await register(app, `fixed-meal-other-${stamp}@e2e.invalid`);
    made.push(stranger.cookie);
    await completeOnboarding(app, account);
    await completeOnboarding(app, stranger);
  });

  afterAll(async () => {
    await deleteAccounts(app, made);
    await app?.close();
  });

  it('starts with no rules and the free tier’s allowances', async () => {
    expect(await standing(account)).toEqual({
      dishRequests: NO_DISH_REQUESTS,
      rules: [],
      standing: { allowed: true, limit: FIXED_MEALS_FREE, remaining: FIXED_MEALS_FREE, used: 0 }
    });
  });

  it('offers only dishes the pool really holds, and refuses one it does not', async () => {
    const offered = await fixable(account, 4, 'dinner');

    expect(offered.length).toBeGreaterThan(0);
    // A name, not a slug: the profile prints this at somebody.
    expect(offered[0]?.name).not.toBe(offered[0]?.slug);

    await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals`)
      .set('Cookie', account.cookie)
      .send({ dishSlug: 'no-existe-este-plato', slot: 'dinner', weekday: 4 })
      .expect(422);

    expect((await standing(account)).rules).toEqual([]);
  });

  it('fixes a meal, counts it, and refuses the next one on the free tier', async () => {
    const [dish] = await fixable(account, 4, 'dinner');
    const created: Response = await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals`)
      .set('Cookie', account.cookie)
      .send({ dishSlug: dish?.slug, slot: 'dinner', weekday: 4 })
      .expect(201);

    expect(created.body).toMatchObject({ dishName: dish?.name, dishSlug: dish?.slug, slot: 'dinner', weekday: 4 });

    const after = await standing(account);

    expect(after.standing).toEqual({ allowed: false, limit: FIXED_MEALS_FREE, remaining: 0, used: FIXED_MEALS_FREE });

    // The allowance, not the weekday: a different day, and still refused.
    const [other] = await fixable(account, 1, 'lunch');

    await request(httpServer(app))
      .post(`/${PREFIX}/fixed-meals`)
      .set('Cookie', account.cookie)
      .send({ dishSlug: other?.slug, slot: 'lunch', weekday: 1 })
      .expect(429);
  });

  it('is nobody else’s to see or to remove (0019)', async () => {
    const [rule] = (await standing(account)).rules;

    expect((await standing(stranger)).rules).toEqual([]);
    // The same answer as an id that never existed: a 404 must not say that
    // another account's rule is there.
    await request(httpServer(app)).delete(`/${PREFIX}/fixed-meals/${rule?.id}`).set('Cookie', stranger.cookie).expect(404);
    expect((await standing(account)).rules).toHaveLength(1);
  });

  it('serves the fixed dish on its day, in a plan generated afterwards', async () => {
    const [rule] = (await standing(account)).rules;
    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');

    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const plan = response.body as PlanView;
    const fridays = plan.days.filter(day => weekdayOf(day.date) === rule?.weekday);

    // A fortnight holds two of any weekday, and the rule lands on both.
    expect(fridays.length).toBeGreaterThan(0);

    for (const day of fridays) {
      const dinner = day.meals.find(meal => meal.slot === 'dinner');

      expect({ day: day.date, name: dinner?.name }).toEqual({ day: day.date, name: rule?.dishName });
    }

    // And nowhere else: a pin is a rule for its own day, not a dish the plan now prefers.
    const elsewhere = plan.days.filter(day => weekdayOf(day.date) !== rule?.weekday);

    expect(elsewhere.every(day => day.meals.every(meal => meal.name !== rule?.dishName))).toBe(true);
  });

  it('serves it again next fortnight, when the rotation would have held it back (0098)', async () => {
    // The case the first generation cannot reach: `rotatePool` holds back
    // everything served last fortnight, and the pinned dish was served. Without
    // the pool carrying its pins the scheduler would refuse the rule for want of
    // the dish rather than for want of room — the rule doing nothing, silently,
    // from the second fortnight onwards.
    const [rule] = (await standing(account)).rules;
    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');

    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const plan = response.body as PlanView;
    const its = plan.days.filter(day => weekdayOf(day.date) === rule?.weekday);

    expect(its.length).toBeGreaterThan(0);

    for (const day of its) {
      expect({ day: day.date, name: day.meals.find(meal => meal.slot === 'dinner')?.name }).toEqual({ day: day.date, name: rule?.dishName });
    }
  });

  it('removes the rule, and the plan already generated keeps the dish it was built with', async () => {
    const [rule] = (await standing(account)).rules;

    await request(httpServer(app)).delete(`/${PREFIX}/fixed-meals/${rule?.id}`).set('Cookie', account.cookie).expect(204);

    expect(await standing(account)).toEqual({
      dishRequests: NO_DISH_REQUESTS,
      rules: [],
      standing: { allowed: true, limit: FIXED_MEALS_FREE, remaining: FIXED_MEALS_FREE, used: 0 }
    });

    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const plan = response.body as PlanView;
    const fridays = plan.days.filter(day => weekdayOf(day.date) === rule?.weekday);

    expect(fridays.every(day => day.meals.find(meal => meal.slot === 'dinner')?.name === rule?.dishName)).toBe(true);
  });
});
