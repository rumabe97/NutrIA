import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { addDays } from 'core/domain/Vacation';

import { completeOnboarding, createApp, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { EventView } from 'core/controllers/Event';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';
import type { Response } from 'supertest';

/**
 * A day that asks more of the body, and the days before it that eat for it
 * (`0043`).
 *
 * The assertion that matters is on real plan rows: the days that eat for the
 * event carry its name and higher carbohydrate targets than the plan's, and
 * every other day carries neither. Then the two refusals, and that a
 * stranger's event is a 404.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
describe('events', () => {
  let app: INestApplication;
  let account: Account;
  let stranger: Account;
  let today: string;

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));

    const stamp = Date.now();

    account = await register(app, `event-${stamp}@e2e.invalid`);
    stranger = await register(app, `event-stranger-${stamp}@e2e.invalid`);
    await completeOnboarding(app, account);
    today = new Date().toISOString().slice(0, 10);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('declares an event and says which days will eat for it', async () => {
    const on = addDays(today, 5);
    const response: Response = await request(httpServer(app))
      .post(`/${PREFIX}/events`)
      .set('Cookie', account.cookie)
      .send({ carbs: 'up', daysBefore: 2, fat: 'down', name: 'Media maratón', on, protein: 'same' })
      .expect(201);

    expect(response.body as EventView).toMatchObject({ loadedDates: [addDays(on, -2), addDays(on, -1)], loading: false, name: 'Media maratón', on });
  });

  it('builds the days before it to their own targets, and stamps the name on them', async () => {
    const generated = await generateAndWait(app, account);

    expect(generated.status).toBe('succeeded');

    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
    const plan = response.body as PlanView;
    const { strategy } = plan;

    if (!strategy) {
      throw new Error('a generated plan carries its strategy');
    }

    const on = addDays(today, 5);
    const loaded = plan.days.filter(day => day.loadedFor !== null);

    expect(loaded.map(day => day.date)).toEqual([addDays(on, -2), addDays(on, -1)]);

    for (const day of loaded) {
      expect(day.loadedFor).toBe('Media maratón');
      expect(day.targets?.carbsG).toBeGreaterThan(strategy.carbsG);
      expect(day.targets?.fatG).toBeLessThan(strategy.fatG);
    }

    // The event day itself and every ordinary day are built to the plan's targets.
    for (const day of plan.days.filter(candidate => candidate.loadedFor === null)) {
      expect(day.targets).toEqual(strategy);
    }
  });

  it('refuses a day that would eat for two events, with 409', async () => {
    await request(httpServer(app))
      .post(`/${PREFIX}/events`)
      .set('Cookie', account.cookie)
      .send({ carbs: 'up', daysBefore: 1, fat: 'same', name: 'Partido', on: addDays(today, 4), protein: 'same' })
      .expect(409);
  });

  it('refuses a load that has already begun, with 422', async () => {
    await request(httpServer(app))
      .post(`/${PREFIX}/events`)
      .set('Cookie', account.cookie)
      .send({ carbs: 'up', daysBefore: 3, fat: 'same', name: 'Ayer', on: addDays(today, 1), protein: 'same' })
      .expect(422);
  });

  it('refuses an event where nothing moves, with 422', async () => {
    await request(httpServer(app))
      .post(`/${PREFIX}/events`)
      .set('Cookie', account.cookie)
      .send({ carbs: 'same', daysBefore: 1, fat: 'same', name: 'Nada', on: addDays(today, 20), protein: 'same' })
      .expect(422);
  });

  it("answers 404 to a stranger removing somebody else's event", async () => {
    const mine: Response = await request(httpServer(app)).get(`/${PREFIX}/events`).set('Cookie', account.cookie).expect(200);
    const [event] = mine.body as EventView[];

    await request(httpServer(app)).delete(`/${PREFIX}/events/${event?.id ?? 'none'}`).set('Cookie', stranger.cookie).expect(404);
    await request(httpServer(app)).delete(`/${PREFIX}/events/${event?.id ?? 'none'}`).set('Cookie', account.cookie).expect(204);
  });
});
