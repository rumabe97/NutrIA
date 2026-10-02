import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { APP_GUARD } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import { Test } from '@nestjs/testing';

import { OnboardingController } from 'core/controllers/Onboarding';
import { PlanController } from 'core/controllers/Plan';

import { AllExceptionsFilter } from '../../../shared/filters/index.js';
import { MealPlansController } from './MealPlans.controller.js';
import { DishPictureService } from '../../ai/index.js';
import { MealPlansService, MealSwapService, PlanJobRunner } from '../services/index.js';
import { OwnerAlertsService } from '../../owner-alerts/index.js';
import { RequiresOnboardingGuard } from '../../../shared/guards/index.js';

import type { INestApplication } from '@nestjs/common';
import type { SwapAxis } from 'core/entities/Plan';
import type { OnboardingView } from 'core/controllers/Onboarding';
import type { Response } from 'supertest';
import type { Server } from 'node:http';
import type { SessionUser } from '../../../shared/index.js';

const ALICE: SessionUser = {
  id: 'usr-alice',
  activated: true,
  email: 'alice@example.invalid',
  emailVerified: true,
  name: 'Alice',
  passwordChangeRequired: false,
  role: 'user'
};
const BOB_PLAN = '11111111-2222-4333-8444-555555555555';

/** Pictures that cannot be drawn — no key, no store — unless a test says otherwise. */
function pictures(available = false) {
  const schedule = jest.fn();

  return { capUsd: 10, isAvailable: available, schedule } as unknown as DishPictureService & { schedule: typeof schedule };
}

function build(picturesService = pictures()) {
  const start = jest.fn(async (_userId: string) =>
    Promise.resolve({ id: 'job-1', error: null, errorDetail: null, planId: null, status: 'queued', step: null })
  );
  const swap = jest.fn(async (_userId: string, _mealId: string, _locale: string | null, _axis?: SwapAxis) => Promise.resolve({ id: 'meal-1' }));

  const pictureFailures = jest.fn(async () => Promise.resolve());

  const plans = new MealPlansService(
    { pictureFailures } as unknown as OwnerAlertsService,
    picturesService,
    { start } as unknown as PlanJobRunner,
    { swap } as unknown as MealSwapService
  );

  return { controller: new MealPlansController(plans), pictureFailures, start, swap };
}

function onboardingState(patch: Partial<OnboardingView>): OnboardingView {
  return {
    completedAt: null,
    completedSteps: [],
    currentStep: 1,
    isComplete: false,
    missingSteps: [],
    profileConsentRequired: false,
    resumeStep: 1,
    totalSteps: 10,
    ...patch
  };
}

describe('MealPlansController', () => {
  const { controller } = build();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts generation for the session user, never an id from the request', async () => {
    const { controller, start } = build();

    await controller.generate(ALICE);

    expect(start).toHaveBeenCalledWith('usr-alice');
  });

  it('reads the allowances for the session user', async () => {
    const allowances = jest
      .spyOn(PlanController, 'allowances')
      .mockResolvedValue({
        events: { limit: 3, midPlan: null, remaining: 3 },
        mealSize: null,
        mealSwaps: { allowed: true, limit: 5, remaining: 5, used: 0 },
        planRedo: { allowed: true, kind: 'new_fortnight', limit: 1, nextAt: null, used: 0 },
        tier: 'free'
      });

    await expect(controller.allowances(ALICE)).resolves.toMatchObject({ mealSwaps: { remaining: 5 } });
    expect(allowances).toHaveBeenCalledWith('usr-alice');
  });

  it('marks a meal for the session user and echoes the status', async () => {
    const setMealStatus = jest.spyOn(PlanController, 'setMealStatus').mockResolvedValue(undefined);

    await expect(controller.setStatus(ALICE, BOB_PLAN, { status: 'completed' })).resolves.toEqual({ status: 'completed' });
    expect(setMealStatus).toHaveBeenCalledWith('usr-alice', BOB_PLAN, 'completed');
  });

  it('swaps a meal for the session user, in the language of the request, with what they asked of it', async () => {
    const { controller, swap } = build();

    await controller.swap(ALICE, BOB_PLAN, 'en-GB', { axis: 'quicker' });
    await controller.swap(ALICE, BOB_PLAN, 'en-GB', {});

    expect(swap).toHaveBeenNthCalledWith(1, 'usr-alice', BOB_PLAN, 'en-GB', 'quicker');
    expect(swap).toHaveBeenNthCalledWith(2, 'usr-alice', BOB_PLAN, 'en-GB', undefined);
  });

  it('scopes the active plan to the session user', async () => {
    const getActivePlan = jest.spyOn(PlanController, 'getActivePlan').mockResolvedValue(null);

    await controller.active(ALICE, 'en-GB');

    // The request's language travels with the id: content resolves into the
    // language the reader is looking at, not the one their profile last stored.
    expect(getActivePlan).toHaveBeenCalledWith('usr-alice', 'en-GB');
  });

  it("passes the caller's id alongside a plan id, so another account's plan is not found", async () => {
    const getPlan = jest.spyOn(PlanController, 'getPlan').mockRejectedValue(new Error('not found'));

    await expect(controller.plan(ALICE, BOB_PLAN, null)).rejects.toThrow();
    // The path id is never used alone — ownership is resolved in the same query.
    expect(getPlan).toHaveBeenCalledWith('usr-alice', BOB_PLAN, null);
  });

  it('scopes a meal to the caller', async () => {
    const getMeal = jest.spyOn(PlanController, 'getMeal').mockResolvedValue({} as never);

    await controller.meal(ALICE, BOB_PLAN, null);

    expect(getMeal).toHaveBeenCalledWith('usr-alice', BOB_PLAN, null);
  });

  /* 0066: only the meal's own page may start its dish's picture, and it never waits for one. */
  it('opens the meal with the cap when a picture could be drawn, and draws a won claim after answering', async () => {
    const service = pictures(true);
    const claim = { attempts: 0, claimedAt: new Date(), recipeId: 'rcp-1' };
    const openMeal = jest.spyOn(PlanController, 'openMeal').mockResolvedValue({ claim, meal: { pictureStatus: 'drawing' } as never });
    const { controller, pictureFailures } = build(service);

    await expect(controller.meal(ALICE, BOB_PLAN, null)).resolves.toEqual({ pictureStatus: 'drawing' });
    expect(openMeal).toHaveBeenCalledWith('usr-alice', BOB_PLAN, null, 10);
    expect(service.schedule).toHaveBeenCalledWith(claim, expect.any(Function));

    // Project 009: the owner hears of failed pictures when the drawing ends, not while the meal is answered.
    expect(pictureFailures).not.toHaveBeenCalled();
    await (service.schedule.mock.calls[0]?.[1] as () => Promise<void>)();
    expect(pictureFailures).toHaveBeenCalledTimes(1);
  });

  it('answers the meal and schedules nothing when asking for its picture failed', async () => {
    const service = pictures(true);

    jest.spyOn(PlanController, 'openMeal').mockResolvedValue({ claim: null, failure: new Error('database down'), meal: { id: 'meal-1' } as never });

    await expect(build(service).controller.meal(ALICE, BOB_PLAN, null)).resolves.toEqual({ id: 'meal-1' });
    expect(service.schedule).not.toHaveBeenCalled();
  });

  it('schedules nothing when no claim was won', async () => {
    const service = pictures(true);

    jest.spyOn(PlanController, 'openMeal').mockResolvedValue({ claim: null, meal: {} as never });
    await build(service).controller.meal(ALICE, BOB_PLAN, null);

    expect(service.schedule).not.toHaveBeenCalled();
  });

  it('only reads the meal when no picture could be drawn or kept, and claims nothing', async () => {
    const openMeal = jest.spyOn(PlanController, 'openMeal');
    const getMeal = jest.spyOn(PlanController, 'getMeal').mockResolvedValue({} as never);

    await build(pictures(false)).controller.meal(ALICE, BOB_PLAN, null);

    expect(getMeal).toHaveBeenCalledWith('usr-alice', BOB_PLAN, null);
    expect(openMeal).not.toHaveBeenCalled();
  });

  it('scopes a job to the caller', async () => {
    const getJob = jest.spyOn(PlanController, 'getJob').mockResolvedValue({} as never);

    await controller.job(ALICE, BOB_PLAN);

    expect(getJob).toHaveBeenCalledWith('usr-alice', BOB_PLAN);
  });

  it('caps the history page size however large a client asks', async () => {
    const listPlans = jest.spyOn(PlanController, 'listPlans').mockResolvedValue([]);

    await controller.history(ALICE, 5000, 0);

    expect(listPlans).toHaveBeenCalledWith('usr-alice', 50, 0);
  });

  it('refuses a negative offset rather than passing it to the database', async () => {
    const listPlans = jest.spyOn(PlanController, 'listPlans').mockResolvedValue([]);

    await controller.history(ALICE, 20, -10);

    expect(listPlans).toHaveBeenCalledWith('usr-alice', 20, 0);
  });
});

/**
 * The gate has to be exercised through the pipeline: unit-testing the guard
 * proves the rule, and unit-testing the controller proves the handler, but only
 * a real request proves the decorator is actually *on* the controller. A
 * `@RequiresOnboarding()` that was written and never applied would pass both of
 * the other two.
 */
describe('meal-plan routes behind onboarding (through the real pipeline)', () => {
  let app: INestApplication;
  const start = jest.fn(async (_userId: string) =>
    Promise.resolve({ id: 'job-1', error: null, errorDetail: null, planId: null, status: 'queued', step: null })
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MealPlansController],
      providers: [
        MealPlansService,
        { provide: DishPictureService, useValue: pictures() },
        { provide: OwnerAlertsService, useValue: { pictureFailures: jest.fn() } },
        { provide: PlanJobRunner, useValue: { start } },
        { provide: MealSwapService, useValue: { swap: jest.fn() } },
        { provide: APP_GUARD, useClass: RequiresOnboardingGuard }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    // Stands in for SessionGuard, which is global in AppModule.
    app.use((req: express.Request & { user?: unknown }, _res: express.Response, next: express.NextFunction) => {
      req.user = ALICE;
      next();
    });
    app.use(express.json());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    start.mockClear();
  });

  it('refuses generation for a half-finished profile before a job exists', async () => {
    jest.spyOn(OnboardingController, 'getState').mockResolvedValue(onboardingState({ missingSteps: ['allergies'], resumeStep: 6 }));

    const response: Response = await request(app.getHttpServer() as Server).post('/meal-plans/generate');

    expect(response.status).toBe(409);
    expect((response.body as { code: string }).code).toBe('ONBOARDING_INCOMPLETE');
    // The point of moving the check to the door: nothing was started. The
    // generator's own check would have refused too, but only after a job row,
    // a progress screen and a failure the user reads as a malfunction.
    expect(start).not.toHaveBeenCalled();
  });

  it('refuses the plan routes too, not only generation', async () => {
    jest.spyOn(OnboardingController, 'getState').mockResolvedValue(onboardingState({ missingSteps: ['allergies'], resumeStep: 6 }));
    const getActivePlan = jest.spyOn(PlanController, 'getActivePlan').mockResolvedValue(null);

    const response: Response = await request(app.getHttpServer() as Server).get('/meal-plans/active');

    expect(response.status).toBe(409);
    expect(getActivePlan).not.toHaveBeenCalled();
  });

  it('lets a finished profile generate', async () => {
    jest.spyOn(OnboardingController, 'getState').mockResolvedValue(onboardingState({ completedAt: '2026-09-07', isComplete: true, resumeStep: 9 }));

    const response: Response = await request(app.getHttpServer() as Server).post('/meal-plans/generate');

    expect(response.status).toBe(201);
    expect(start).toHaveBeenCalledWith('usr-alice');
  });
});
