import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { addDays } from 'core/domain/Vacation';
import { loadedTargets } from 'core/domain/Event';

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
 * event carry its name and exactly the targets `core/domain/Event` derives from
 * the plan's own strategy, and every other day carries neither. Then the two
 * refusals, and that a stranger's event is a 404.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
describe('events', () => {
  let app: INestApplication;
  let account: Account;
  let stranger: Account;
  let today: string;

  /** The shape the person chooses. Its size is the code's, which is what the plan test checks. */
  const shape = { carbs: 'up', daysBefore: 2, fat: 'down', protein: 'same' } as const;

  const refusal = (response: Response): { code?: string; fieldErrors?: Record<string, string[]> } =>
    response.body as { code?: string; fieldErrors?: Record<string, string[]> };

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
      .send({ ...shape, name: 'Media maratón', on })
      .expect(201);

    // The two days before it, not the day itself; and nothing has begun yet.
    expect(response.body as EventView).toMatchObject({
      ...shape,
      loadedDates: [addDays(on, -2), addDays(on, -1)],
      loading: false,
      name: 'Media maratón',
      on
    });
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
      // Not merely up and down: exactly the step the domain chose, from the
      // plan's own strategy. The person picks the direction, the code the size.
      expect(day.targets).toEqual(loadedTargets(strategy, shape));
    }

    // The event day itself and every ordinary day are built to the plan's targets.
    for (const day of plan.days.filter(candidate => candidate.loadedFor === null)) {
      expect(day.targets).toEqual(strategy);
    }
  });

  it('refuses a day that would eat for two events, with 409', async () => {
    const refused: Response = await request(httpServer(app))
      .post(`/${PREFIX}/events`)
      .set('Cookie', account.cookie)
      .send({ carbs: 'up', daysBefore: 1, fat: 'same', name: 'Partido', on: addDays(today, 4), protein: 'same' })
      .expect(409);

    // A 409 for this reason, not the account's or the plan's.
    expect(refusal(refused).code).toBe('CONFLICT');
  });

  it('refuses a load that has already begun, with 422', async () => {
    const refused: Response = await request(httpServer(app))
      .post(`/${PREFIX}/events`)
      .set('Cookie', account.cookie)
      .send({ carbs: 'up', daysBefore: 3, fat: 'same', name: 'Ayer', on: addDays(today, 1), protein: 'same' })
      .expect(422);

    // The past is the problem, and the refusal names the date field.
    expect(refusal(refused).code).toBe('INVALID_INPUT');
    expect(refusal(refused).fieldErrors?.on).toBeDefined();
  });

  it('refuses an event where nothing moves, with 422', async () => {
    const refused: Response = await request(httpServer(app))
      .post(`/${PREFIX}/events`)
      .set('Cookie', account.cookie)
      .send({ carbs: 'same', daysBefore: 1, fat: 'same', name: 'Nada', on: addDays(today, 20), protein: 'same' })
      .expect(422);

    expect(refusal(refused).code).toBe('INVALID_INPUT');
    expect(refusal(refused).fieldErrors?.carbs).toBeDefined();
  });

  it("answers 404 to a stranger removing somebody else's event", async () => {
    const server = httpServer(app);
    const mine: Response = await request(server).get(`/${PREFIX}/events`).set('Cookie', account.cookie).expect(200);
    const events = mine.body as EventView[];

    // Only the one that was accepted exists; the refused ones left no row.
    expect(events).toHaveLength(1);

    const [event] = events;
    const theirs: Response = await request(server).get(`/${PREFIX}/events`).set('Cookie', stranger.cookie).expect(200);

    expect(theirs.body).toEqual([]);

    await request(server).delete(`/${PREFIX}/events/${event.id}`).set('Cookie', stranger.cookie).expect(404);
    await request(server).delete(`/${PREFIX}/events/${event.id}`).set('Cookie', account.cookie).expect(204);

    const after: Response = await request(server).get(`/${PREFIX}/events`).set('Cookie', account.cookie).expect(200);

    expect(after.body).toEqual([]);
  });
});
