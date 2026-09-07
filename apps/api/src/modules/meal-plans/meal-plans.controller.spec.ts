import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { PlanController } from 'core/controllers/Plan';

import { MealPlansController } from './meal-plans.controller.js';

import type { PlanJobRunner } from './PlanJobRunner.service.js';
import type { SessionUser } from '../../shared/decorators/index.js';

const ALICE: SessionUser = { id: 'usr-alice', email: 'alice@example.invalid', emailVerified: true, name: 'Alice', role: 'user' };
const BOB_PLAN = '11111111-2222-4333-8444-555555555555';

function build() {
  const start = jest.fn(async (_userId: string) => Promise.resolve({ id: 'job-1', error: null, errorDetail: null, planId: null, status: 'queued', step: null }));

  return { controller: new MealPlansController({ start } as unknown as PlanJobRunner), start };
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

  it('scopes the active plan to the session user', async () => {
    const getActivePlan = jest.spyOn(PlanController, 'getActivePlan').mockResolvedValue(null);

    await controller.active(ALICE);

    expect(getActivePlan).toHaveBeenCalledWith('usr-alice');
  });

  it("passes the caller's id alongside a plan id, so another account's plan is not found", async () => {
    const getPlan = jest.spyOn(PlanController, 'getPlan').mockRejectedValue(new Error('not found'));

    await expect(controller.plan(ALICE, BOB_PLAN)).rejects.toThrow();
    // The path id is never used alone — ownership is resolved in the same query.
    expect(getPlan).toHaveBeenCalledWith('usr-alice', BOB_PLAN);
  });

  it('scopes a meal to the caller', async () => {
    const getMeal = jest.spyOn(PlanController, 'getMeal').mockResolvedValue({} as never);

    await controller.meal(ALICE, BOB_PLAN);

    expect(getMeal).toHaveBeenCalledWith('usr-alice', BOB_PLAN);
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
