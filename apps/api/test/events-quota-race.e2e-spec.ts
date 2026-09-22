import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { addDays } from 'core/domain/Vacation';

import { completeOnboarding, createApp, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { AllowancesView } from 'core/controllers/Plan';
import type { EventView } from 'core/controllers/Event';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The race a security scan found (`0044` follow-up, 2026-09-22): reading the
 * fortnight's standing and inserting the event were two statements against
 * two snapshots. Fired together, several requests could each read a count
 * that still had room and each insert — a cap of three ending with five.
 *
 * `EventRepository.createWithinQuota` closes it with a transaction-scoped
 * advisory lock, the same shape as `PlanJobRepository.claim` and
 * `PlanRepository.swapMeal`'s contested-swap test this mirrors. This suite is
 * the same proof against the real database, not a mock: more requests than
 * the cap allows, fired together, and never more than the cap lands.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
const EVENTS_PER_PLAN = 3;

describe('events — the fortnight cap under concurrency', () => {
  let app: INestApplication;
  let account: Account;
  let today: string;

  const allowances = async (): Promise<AllowancesView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/allowances`).set('Cookie', account.cookie).expect(200);

    return response.body as AllowancesView;
  };

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));
    account = await register(app, `event-race-${Date.now()}@e2e.invalid`);
    await completeOnboarding(app, account);
    today = new Date().toISOString().slice(0, 10);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('gives a contested cap to exactly as many requests as it has room for, never more', async () => {
    const server = httpServer(app);
    const shape = { carbs: 'up', daysBefore: 1, fat: 'down', protein: 'same' } as const;
    const declare = (name: string, on: string) =>
      request(server)
        .post(`/${PREFIX}/events`)
        .set('Cookie', account.cookie)
        .send({ ...shape, name, on });

    expect((await allowances()).events).toEqual({ limit: EVENTS_PER_PLAN, midPlan: null, remaining: EVENTS_PER_PLAN });

    // More contenders than the cap has room for, each on its own day so none
    // is refused as an overlap, fired together against the account's one
    // remaining-events allowance.
    const contenders = Array.from({ length: EVENTS_PER_PLAN + 2 }, (_none, index) => addDays(today, 4 + index * 2));
    const raced: Response[] = await Promise.all(contenders.map((on, index) => declare(`Contendiente ${index}`, on)));
    const accepted = raced.filter(response => response.status === 201);
    const refused = raced.filter(response => response.status === 429);

    expect(accepted).toHaveLength(EVENTS_PER_PLAN);
    expect(refused).toHaveLength(contenders.length - EVENTS_PER_PLAN);

    for (const response of refused) {
      expect((response.body as { code: string }).code).toBe('QUOTA_EXCEEDED');
    }

    // The database agrees with the responses: exactly the cap, not one more.
    expect((await allowances()).events).toEqual({ limit: EVENTS_PER_PLAN, midPlan: null, remaining: 0 });

    const listed: Response = await request(server).get(`/${PREFIX}/events`).set('Cookie', account.cookie).expect(200);

    expect(listed.body as EventView[]).toHaveLength(EVENTS_PER_PLAN);
  });
});
