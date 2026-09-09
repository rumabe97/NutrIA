import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { completeOnboarding, createApp, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { INestApplication } from '@nestjs/common';
import type { PlanView } from 'core/controllers/Plan';
import type { Response } from 'supertest';
import type { VacationView } from 'core/controllers/Vacation';

/**
 * Being away pauses the plan; it does not skip it (`0032`).
 *
 * The assertion that matters is arithmetic on real rows: the days after a trip
 * move by exactly its length, the days before it do not move at all, and the
 * dates of the trip itself hold no plan day — which is what makes nothing count
 * as skipped without anything having been taught about holidays.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

describe('vacations', () => {
  let app: INestApplication;
  let account: Account;
  let stranger: Account;
  let before: PlanView;

  const activePlan = async (who: Account): Promise<PlanView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', who.cookie).expect(200);

    return response.body as PlanView;
  };

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));

    const stamp = Date.now();

    account = await register(app, `vacation-${stamp}@e2e.invalid`);
    stranger = await register(app, `vacation-other-${stamp}@e2e.invalid`);
    await completeOnboarding(app, account);

    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');
    before = await activePlan(account);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('moves the days after the trip and leaves the days before it alone', async () => {
    const startsOn = before.days[3].date;
    const endsOn = addDays(startsOn, 4);

    const declared: Response = await request(httpServer(app))
      .post(`/${PREFIX}/vacations`)
      .set('Cookie', account.cookie)
      .send({ endsOn, startsOn })
      .expect(201);

    expect(declared.body).toMatchObject({ away: false, days: 5, endsOn, startsOn });

    const after = await activePlan(account);

    // Days 1–3 are untouched; every day from the fourth on is five days later,
    // and the plan itself ends five days later.
    expect(after.days.slice(0, 3).map(day => day.date)).toEqual(before.days.slice(0, 3).map(day => day.date));
    expect(after.days.slice(3).map(day => day.date)).toEqual(before.days.slice(3).map(day => addDays(day.date, 5)));
    expect(after.endDate).toBe(addDays(before.endDate, 5));
  });

  it('leaves no plan day at all on the days somebody is away', async () => {
    const trips: Response = await request(httpServer(app)).get(`/${PREFIX}/vacations`).set('Cookie', account.cookie).expect(200);
    const [trip] = trips.body as VacationView[];
    const plan = await activePlan(account);
    const dates = new Set(plan.days.map(day => day.date));

    for (let date = trip.startsOn; date <= trip.endsOn; date = addDays(date, 1)) {
      expect(dates.has(date)).toBe(false);
    }
  });

  it('refuses a trip that would move a day somebody has already eaten', async () => {
    const yesterday = addDays(new Date().toISOString().slice(0, 10), -1);

    await request(httpServer(app)).post(`/${PREFIX}/vacations`).set('Cookie', account.cookie).send({ endsOn: addDays(yesterday, 3), startsOn: yesterday }).expect(422);
  });

  it('refuses a second trip over the same days — two shifts for one absence', async () => {
    const trips: Response = await request(httpServer(app)).get(`/${PREFIX}/vacations`).set('Cookie', account.cookie).expect(200);
    const [trip] = trips.body as VacationView[];

    await request(httpServer(app)).post(`/${PREFIX}/vacations`).set('Cookie', account.cookie).send({ endsOn: addDays(trip.endsOn, 2), startsOn: trip.endsOn }).expect(409);
  });

  it('refuses one that ends before it starts, and one longer than a season', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const server = httpServer(app);

    await request(server).post(`/${PREFIX}/vacations`).set('Cookie', account.cookie).send({ endsOn: addDays(today, 30), startsOn: addDays(today, 40) }).expect(422);
    await request(server).post(`/${PREFIX}/vacations`).set('Cookie', account.cookie).send({ endsOn: addDays(today, 400), startsOn: addDays(today, 300) }).expect(422);
  });

  it('gives the plan its days back when the trip is cancelled', async () => {
    const server = httpServer(app);
    const trips: Response = await request(server).get(`/${PREFIX}/vacations`).set('Cookie', account.cookie).expect(200);
    const [trip] = trips.body as VacationView[];

    await request(server).delete(`/${PREFIX}/vacations/${trip.id}`).set('Cookie', account.cookie).expect(204);

    const restored = await activePlan(account);

    expect(restored.days.map(day => day.date)).toEqual(before.days.map(day => day.date));
    expect(restored.endDate).toBe(before.endDate);
  });

  it('will not let one account cancel another account trip', async () => {
    const server = httpServer(app);
    const today = new Date().toISOString().slice(0, 10);
    const mine: Response = await request(server).post(`/${PREFIX}/vacations`).set('Cookie', account.cookie).send({ endsOn: addDays(today, 22), startsOn: addDays(today, 20) }).expect(201);
    const id = (mine.body as VacationView).id;

    await request(server).delete(`/${PREFIX}/vacations/${id}`).set('Cookie', stranger.cookie).expect(404);
    await request(server).get(`/${PREFIX}/vacations`).set('Cookie', stranger.cookie).expect(200).expect(response => {
      expect(response.body).toEqual([]);
    });

    await request(server).delete(`/${PREFIX}/vacations/${id}`).set('Cookie', account.cookie).expect(204);
  });

  it('applies a trip declared before the plan existed, when the plan is made', async () => {
    const stamp = Date.now();
    const traveller = await register(app, `vacation-first-${stamp}@e2e.invalid`);
    const today = new Date().toISOString().slice(0, 10);
    const startsOn = addDays(today, 2);

    await completeOnboarding(app, traveller);
    await request(httpServer(app)).post(`/${PREFIX}/vacations`).set('Cookie', traveller.cookie).send({ endsOn: addDays(startsOn, 2), startsOn }).expect(201);

    const job = await generateAndWait(app, traveller);

    expect(job.status).toBe('succeeded');

    const plan = await activePlan(traveller);
    const dates = new Set(plan.days.map(day => day.date));

    // Generation lays a fortnight out from today and knows nothing about a trip
    // declared last week; the days are pushed apart afterwards.
    expect(dates.has(startsOn)).toBe(false);
    expect(plan.days).toHaveLength(before.days.length);
  });
});
