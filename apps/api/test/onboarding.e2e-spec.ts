import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import {
  completeOnboarding,
  createApp,
  deleteAccounts,
  generateAndWait,
  httpServer,
  markCustomGoal,
  markLegacyOnboarding,
  POOL,
  PREFIX,
  register,
  ScriptedAiClient
} from './harness.js';

import { shapeFor } from 'core/domain/MealShape';

import type { Account } from './harness.js';
import type { OnboardingView } from 'core/controllers/Onboarding';
import type { FullProfileView } from 'core/controllers/Profile';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

/**
 * The onboarding cleanup: `'lifestyle'` gone from `ONBOARDING_STEPS`, seven
 * required steps instead of eight, `about-you` gaining `country`, and a
 * handful of fields dropped from the preferences and goal wire bodies.
 *
 * None of this is optional to prove: an account that finished onboarding
 * under the old ten-step flow must keep reading as complete, the removed
 * step must refuse rather than silently succeed, and a removed field sent
 * anyway must be stripped rather than stored or rejected.
 *
 * Requires a real database and a seeded catalogue — see ./README.md.
 */
describe('onboarding', () => {
  let app: INestApplication;
  /** Every account this suite registered, so `afterAll` can delete each one. */
  const made: string[] = [];

  const code = (response: Response) => (response.body as { code?: string }).code;

  const onboardingView = async (account: Account): Promise<OnboardingView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/onboarding`).set('Cookie', account.cookie).expect(200);

    return response.body as OnboardingView;
  };

  const profileView = async (account: Account): Promise<FullProfileView> => {
    const response: Response = await request(httpServer(app)).get(`/${PREFIX}/profile`).set('Cookie', account.cookie).expect(200);

    return response.body as FullProfileView;
  };

  beforeAll(async () => {
    // The shared pool: one legacy account below generates a plan.
    app = await createApp(new ScriptedAiClient(POOL));
  });

  afterAll(async () => {
    await deleteAccounts(app, made);
    await app?.close();
  });

  it("refuses step 'lifestyle' — the schema no longer knows it — and stores nothing", async () => {
    const account = await register(app, `removed-step-${Date.now()}@e2e.invalid`);

    made.push(account.cookie);

    const before = await onboardingView(account);
    const refused: Response = await request(httpServer(app))
      .patch(`/${PREFIX}/onboarding`)
      .set('Cookie', account.cookie)
      .send({ data: { trainingDaysPerWeek: 3 }, step: 'lifestyle' })
      .expect(422);

    expect(code(refused)).toBe('INVALID_INPUT');
    expect((await onboardingView(account)).completedSteps).toEqual(before.completedSteps);

    // The same answer as any step name the schema never knew: 'lifestyle' is not special-cased.
    const unknown: Response = await request(httpServer(app))
      .patch(`/${PREFIX}/onboarding`)
      .set('Cookie', account.cookie)
      .send({ data: {}, step: 'no-such-step' })
      .expect(422);

    expect(code(unknown)).toBe('INVALID_INPUT');
  });

  it('reads an account that finished the old ten-step flow as complete, not as broken', async () => {
    const account = await register(app, `legacy-onboarding-${Date.now()}@e2e.invalid`);

    made.push(account.cookie);
    await completeOnboarding(app, account);
    // What the old flow could have left behind: 'lifestyle' among the
    // completed steps, currentStep at its old ceiling — a shape no route
    // can write any more, since the step is gone from ONBOARDING_STEPS.
    await markLegacyOnboarding(account.id);

    const state = await onboardingView(account);

    expect(state.isComplete).toBe(true);
    expect(state.missingSteps).toEqual([]);

    // A guarded route that needs no plan: this is about the guard reading the
    // legacy row without tripping, not about generation.
    await request(httpServer(app)).get(`/${PREFIX}/check-ins/status`).set('Cookie', account.cookie).expect(200);
  });

  it('lets an account that finished the old ten-step flow generate a plan', async () => {
    const account = await register(app, `legacy-generation-${Date.now()}@e2e.invalid`);

    made.push(account.cookie);
    await completeOnboarding(app, account);
    await markLegacyOnboarding(account.id);

    // Generation reads the onboarding row twice — the guard, then the job's own
    // completeness check — and neither may trip on 'lifestyle' or step 10.
    const job = await generateAndWait(app, account);

    expect(job).toMatchObject({ error: null, status: 'succeeded' });
    await request(httpServer(app)).get(`/${PREFIX}/meal-plans/active`).set('Cookie', account.cookie).expect(200);
  });

  it('persists a country given in about-you', async () => {
    const account = await register(app, `about-you-country-${Date.now()}@e2e.invalid`);

    made.push(account.cookie);
    await completeOnboarding(app, account);

    expect((await profileView(account)).profile?.country).toBe('ES');
  });

  it("refuses goal type 'custom' — GOAL_TYPES no longer offers it — on both routes that set a goal", async () => {
    const account = await register(app, `goal-type-custom-${Date.now()}@e2e.invalid`);

    made.push(account.cookie);
    await completeOnboarding(app, account);

    const server = httpServer(app);
    const onStep: Response = await request(server)
      .patch(`/${PREFIX}/onboarding`)
      .set('Cookie', account.cookie)
      .send({ data: { paceKgPerWeek: null, targetWeightKg: 65, type: 'custom' }, step: 'goal' })
      .expect(422);

    expect(code(onStep)).toBe('INVALID_INPUT');

    const onProfile: Response = await request(server)
      .patch(`/${PREFIX}/profile/goal`)
      .set('Cookie', account.cookie)
      .send({ paceKgPerWeek: null, targetWeightKg: 65, type: 'custom' })
      .expect(422);

    expect(code(onProfile)).toBe('INVALID_INPUT');
  });

  it("reads a goal stored as type 'custom' back as 'maintenance', a deploy-window row the enum still permits", async () => {
    const account = await register(app, `goal-type-legacy-${Date.now()}@e2e.invalid`);

    made.push(account.cookie);
    await completeOnboarding(app, account);
    // What the old API could still write during migration 0043's deploy
    // window: a value the Postgres enum still permits, but GOAL_TYPES no
    // longer does.
    await markCustomGoal(account.id);

    expect((await profileView(account)).goal?.type).toBe('maintenance');
  });

  it('accepts every field the cleanup removed, and stores none of them', async () => {
    const account = await register(app, `removed-fields-${Date.now()}@e2e.invalid`);

    made.push(account.cookie);
    await completeOnboarding(app, account);

    const server = httpServer(app);

    // Each removed field sent on the onboarding step it used to belong to —
    // wire compatibility for a client that has not redeployed yet.
    await request(server)
      .patch(`/${PREFIX}/onboarding`)
      .set('Cookie', account.cookie)
      .send({ data: { budget: 'high', cookingFrequency: 'daily', cookingTimeMinutes: 45 }, step: 'cooking' })
      .expect(200);
    await request(server)
      .patch(`/${PREFIX}/onboarding`)
      .set('Cookie', account.cookie)
      .send({ data: { customGoal: 'Correr una maratón', paceKgPerWeek: 0.3, targetWeightKg: 65, type: 'maintenance' }, step: 'goal' })
      .expect(200);
    await request(server)
      .patch(`/${PREFIX}/onboarding`)
      .set('Cookie', account.cookie)
      .send({ data: { breakfastStyle: 'dulce', mealShape: shapeFor(3, false), portionPreference: 'grande' }, step: 'how-you-eat' })
      .expect(200);
    // And on the general profile route, which the onboarding steps never
    // covered for these — sleep and the training schedule were only ever set
    // here.
    await request(server)
      .patch(`/${PREFIX}/profile/preferences`)
      .set('Cookie', account.cookie)
      .send({
        budget: 'low',
        cookingFrequency: 'rarely',
        sleepEnd: '07:00',
        sleepStart: '23:00',
        trainingDaysPerWeek: 5,
        trainingTime: '18:00',
        workScheduleNotes: 'turnos'
      })
      .expect(200);

    const profile = await profileView(account);
    // The fields are gone from the view, not merely unset — checked as plain
    // records because the current view types no longer declare them at all.
    const goal = profile.goal as unknown as Record<string, unknown>;
    const preferences = profile.preferences as unknown as Record<string, unknown>;

    expect(goal).not.toHaveProperty('customGoal');

    // `PATCH /profile/goal` strips it too, and does not answer with it.
    const updated: Response = await request(server)
      .patch(`/${PREFIX}/profile/goal`)
      .set('Cookie', account.cookie)
      .send({ customGoal: 'Subir el Everest', paceKgPerWeek: null, targetWeightKg: 66, type: 'maintenance' })
      .expect(200);

    expect(updated.body as Record<string, unknown>).not.toHaveProperty('customGoal');
    expect((await profileView(account)).goal as unknown as Record<string, unknown>).not.toHaveProperty('customGoal');

    for (const key of [
      'breakfastStyle',
      'portionPreference',
      'workScheduleNotes',
      'sleepStart',
      'sleepEnd',
      'trainingDaysPerWeek',
      'trainingTime',
      'budget',
      'cookingFrequency'
    ]) {
      expect(preferences).not.toHaveProperty(key);
    }
  });
});
