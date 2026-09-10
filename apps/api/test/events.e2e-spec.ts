import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { addDays } from 'core/domain/Vacation';
import { loadedTargets } from 'core/domain/Event';

import { completeOnboarding, createApp, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { AddedEventDto } from '../src/modules/events/dto/out/index.js';
import type { AllowancesView, PlanView } from 'core/controllers/Plan';
import type { EventView } from 'core/controllers/Event';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * A day that asks more of the body, and the days before it that eat for it
 * (`0043`) — on the free tier, where an event is read at the next generation
 * and the fortnight holds three of them (`0044`).
 *
 * The assertion that matters is on real plan rows: the days that eat for the
 * event carry its name and exactly the targets `core/domain/Event` derives from
 * the plan's own strategy, and every other day carries neither. Then the two
 * refusals, a stranger's 404, and the cap: an event into the fortnight under
 * way changes nothing about it, the fourth is a 429, and one the week after
 * next is counted against that week. The paid half — the fortnight rebuilt on
 * the spot — is `events-premium.e2e-spec.ts`.
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

  const refusal = (response: Response): { code?: string; fieldErrors?: Record<string, string[]>; message?: string } =>
    response.body as { code?: string; fieldErrors?: Record<string, string[]>; message?: string };

  const activePlan = async (): Promise<PlanView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);

    return response.body as PlanView;
  };

  const allowances = async (): Promise<AllowancesView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/allowances`).set('Cookie', account.cookie).expect(200);

    return response.body as AllowancesView;
  };

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
    // Nothing rebuilt either: there is no plan, and on this tier there would
    // not be — the answer is a list, empty, not an error (`0044`).
    expect(response.body as AddedEventDto).toMatchObject({
      ...shape,
      loadedDates: [addDays(on, -2), addDays(on, -1)],
      loading: false,
      name: 'Media maratón',
      on,
      rebuiltDates: []
    });
  });

  it('builds the days before it to their own targets, and stamps the name on them', async () => {
    const generated = await generateAndWait(app, account);

    expect(generated.status).toBe('succeeded');

    const plan = await activePlan();
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

  it('answers 400 to an event id that is not an id', async () => {
    // Malformed is a client error, where a missing event is a 404: the pipe
    // refuses it before anything is looked up, so a bad id is never a database
    // error with a Sentry report — and never a hint about what exists.
    const refused: Response = await request(httpServer(app)).delete(`/${PREFIX}/events/not-a-uuid`).set('Cookie', account.cookie).expect(400);

    expect(refusal(refused).code).toBe('REQUEST_ERROR');
  });

  it('on the free tier, the fortnight holds three events and none may rebuild it', async () => {
    // Three, exactly, over the plan's own window — and `midPlan` null rather
    // than a zero limit: null is what tells the screen to show no control at
    // all, where a zero would be a disabled one with an upsell (`0044`).
    expect((await allowances()).events).toEqual({ limit: 3, midPlan: null, remaining: 3 });
  });

  it('accepts an event into the fortnight under way without touching it, on the free tier', async () => {
    const before = await activePlan();
    const response: Response = await request(httpServer(app))
      .post(`/${PREFIX}/events`)
      .set('Cookie', account.cookie)
      .send({ ...shape, daysBefore: 1, name: 'Partido', on: addDays(today, 7) })
      .expect(201);

    // Nothing rebuilt: a free account's event is read at the next generation,
    // exactly as `0043` shipped it, and the answer says so with an empty list
    // rather than with an error — it is a state, not a failure (`0044`).
    expect((response.body as AddedEventDto).rebuiltDates).toEqual([]);
    // And the plan is the plan it was: not a day, not a meal, not a target.
    expect((await activePlan()).days).toEqual(before.days);
  });

  it('refuses the fourth event of the fortnight with 429: an allowance spent, not a mistake', async () => {
    const server = httpServer(app);
    const declare = (name: string, on: string) =>
      request(server)
        .post(`/${PREFIX}/events`)
        .set('Cookie', account.cookie)
        .send({ ...shape, daysBefore: 1, name, on });

    // Two more, each on its own days, so the refusal below cannot be the overlap one.
    await declare('Tirada larga', addDays(today, 9)).expect(201);
    await declare('Series', addDays(today, 11)).expect(201);

    expect((await allowances()).events).toEqual({ limit: 3, midPlan: null, remaining: 0 });

    const refused: Response = await declare('Cuarto', addDays(today, 13)).expect(429);

    // The same answer a sixth swap gets; the message is the kind, so the
    // client can say which allowance is gone.
    expect(refusal(refused).code).toBe('QUOTA_EXCEEDED');
    expect(refusal(refused).message).toBe('event');

    // Refused means no row: the list holds the three that were accepted, soonest first.
    const listed: Response = await request(server).get(`/${PREFIX}/events`).set('Cookie', account.cookie).expect(200);

    expect((listed.body as EventView[]).map(event => event.name)).toEqual(['Partido', 'Tirada larga', 'Series']);
  });

  it('counts an event the week after next against that fortnight, not this one', async () => {
    // The fortnight under way is full. An event whose load lands after it
    // belongs to the fortnight that will cover it — tiled forward from this
    // one — and is held to that fortnight's number, still untouched (`0044`).
    const response: Response = await request(httpServer(app))
      .post(`/${PREFIX}/events`)
      .set('Cookie', account.cookie)
      .send({ ...shape, daysBefore: 1, name: 'Dentro de tres semanas', on: addDays(today, 20) })
      .expect(201);

    expect((response.body as AddedEventDto).rebuiltDates).toEqual([]);
  });
});
