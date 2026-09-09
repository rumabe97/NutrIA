import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { completeOnboarding, createApp, generateAndWait, httpServer, POOL, PREFIX, register, ScriptedAiClient } from './harness.js';

import type { Account } from './harness.js';
import type { CheckInStatusView } from 'core/controllers/CheckIn';
import type { FullProfileView } from 'core/controllers/Profile';
import type { INestApplication } from '@nestjs/common';
import type { NotificationSettingsView } from 'core/controllers/Notification';
import type { PlanView } from 'core/controllers/Plan';
import type { Response } from 'supertest';

/**
 * The rest of what somebody does with a fortnight: ticking the shopping list,
 * saying what they thought of a dish, closing the cycle with a check-in, and
 * the two settings that are theirs to change (`0014`, `0018`, `0027`).
 *
 * The routes here were the last ones with no end-to-end cover. None of them is
 * dramatic on its own, which is exactly why they were the ones left.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
describe('living the fortnight', () => {
  let app: INestApplication;
  let account: Account;
  let stranger: Account;
  let plan: PlanView;

  const activePlan = async (): Promise<PlanView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);

    return response.body as PlanView;
  };

  beforeAll(async () => {
    app = await createApp(new ScriptedAiClient(POOL));

    const stamp = Date.now();

    account = await register(app, `fortnight-${stamp}@e2e.invalid`);
    stranger = await register(app, `fortnight-other-${stamp}@e2e.invalid`);
    await completeOnboarding(app, account);
    await completeOnboarding(app, stranger);

    const job = await generateAndWait(app, account);

    expect(job.status).toBe('succeeded');
    plan = await activePlan();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('ticks an item off the shopping list and remembers it', async () => {
    const server = httpServer(app);
    const list: Response = await request(server).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', account.cookie).expect(200);
    const [item] = (list.body as { items: { id: string; checked: boolean }[] }).items;

    await request(server).patch(`/${PREFIX}/shopping-lists/items/${item.id}`).set('Cookie', account.cookie).send({ checked: true }).expect(204);

    const after: Response = await request(server).get(`/${PREFIX}/shopping-lists/active`).set('Cookie', account.cookie).expect(200);

    expect((after.body as { items: { id: string; checked: boolean }[] }).items.find(row => row.id === item.id)?.checked).toBe(true);
    // Somebody else's list is not a list they can tick.
    await request(server).patch(`/${PREFIX}/shopping-lists/items/${item.id}`).set('Cookie', stranger.cookie).send({ checked: false }).expect(404);
  });

  it('keeps a verdict on a dish, and takes it back', async () => {
    const server = httpServer(app);
    const meal = plan.days[0].meals[0];
    const detail: Response = await request(server).get(`/${PREFIX}/meal-plans/meals/${meal.id}`).set('Cookie', account.cookie).expect(200);
    const recipeId = (detail.body as { recipeId: string }).recipeId;

    await request(server).put(`/${PREFIX}/recipes/${recipeId}/verdict`).set('Cookie', account.cookie).send({ verdict: 'disliked' }).expect(200);
    await request(server).put(`/${PREFIX}/recipes/${recipeId}/verdict`).set('Cookie', account.cookie).send({ verdict: 'none' }).expect(200);

    // One verdict per person per recipe (`0014`): saying it twice is a change of
    // mind, not a second opinion.
    await request(server).put(`/${PREFIX}/recipes/${recipeId}/verdict`).set('Cookie', account.cookie).send({ verdict: 'liked' }).expect(200);
  });

  it('says the check-in is not due while the fortnight is still being lived', async () => {
    const status: Response = await request(httpServer(app)).get(`/${PREFIX}/check-ins/status`).set('Cookie', account.cookie).expect(200);

    expect(status.body).toMatchObject({ done: false, due: false });
    expect((status.body as CheckInStatusView).plan?.id).toBe(plan.id);
  });

  it('accepts a check-in, records the weight with it, and will not take a second', async () => {
    const server = httpServer(app);
    const answers = { difficulty: 'ok', hunger: 'right', planId: plan.id, satisfaction: 4, weightKg: 70.4 };

    const first: Response = await request(server).post(`/${PREFIX}/check-ins`).set('Cookie', account.cookie).send(answers).expect(201);

    expect(first.body).toMatchObject({ weightLogged: true });

    const status: Response = await request(server).get(`/${PREFIX}/check-ins/status`).set('Cookie', account.cookie).expect(200);

    expect(status.body).toMatchObject({ done: true });

    // The fortnight is answered once. A second is a conflict, not a silent overwrite.
    await request(server).post(`/${PREFIX}/check-ins`).set('Cookie', account.cookie).send(answers).expect(409);
  });

  it('will not take a check-in for a plan that is not the caller own', async () => {
    await request(httpServer(app))
      .post(`/${PREFIX}/check-ins`)
      .set('Cookie', stranger.cookie)
      .send({ difficulty: 'ok', hunger: 'right', planId: plan.id, satisfaction: 3 })
      .expect(404);
  });

  it('turns the reminder mail off and on, and the setting is the caller own', async () => {
    const server = httpServer(app);

    await request(server).patch(`/${PREFIX}/notifications/settings`).set('Cookie', account.cookie).send({ checkInEmail: false }).expect(200);

    const off: Response = await request(server).get(`/${PREFIX}/notifications/settings`).set('Cookie', account.cookie).expect(200);

    expect((off.body as NotificationSettingsView).checkInEmail).toBe(false);

    const theirs: Response = await request(server).get(`/${PREFIX}/notifications/settings`).set('Cookie', stranger.cookie).expect(200);

    expect((theirs.body as NotificationSettingsView).checkInEmail).toBe(true);

    await request(server).patch(`/${PREFIX}/notifications/settings`).set('Cookie', account.cookie).send({ checkInEmail: true }).expect(200);
  });

  it('changes a restriction outside onboarding, and the profile agrees', async () => {
    const server = httpServer(app);
    const allergens: Response = await request(server).get(`/${PREFIX}/safety/allergens`).set('Cookie', account.cookie).expect(200);
    const gluten = (allergens.body as { id: string; key: string }[]).find(row => row.key === 'gluten');

    await request(server)
      .put(`/${PREFIX}/safety/restrictions`)
      .set('Cookie', account.cookie)
      .send({ allergies: [{ allergenId: gluten?.id, crossContaminationSensitive: false, severity: 'moderate' }], customAllergens: [], intolerances: [] })
      .expect(204);

    const profile: Response = await request(server).get(`/${PREFIX}/profile`).set('Cookie', account.cookie).expect(200);

    expect((profile.body as FullProfileView).allergies.map(allergy => allergy.allergenId)).toContain(gluten?.id);
  });
});
