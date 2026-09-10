import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from 'core/entities/Error';

import { PlanController } from './PlanController';

type Row = { id: string; endDate: string; startDate: string; status: string; version: number };

const findHistory = vi.fn<(userId: string, limit: number, offset: number) => Promise<readonly Row[]>>();
const setMealStatus = vi.fn<(userId: string, mealId: string, status: string) => Promise<'closed' | 'done' | 'missing'>>();

vi.mock('#repositories/Plan', () => ({
  PlanRepository: {
    findHistory: (u: string, l: number, o: number) => findHistory(u, l, o),
    setMealStatus: (u: string, m: string, s: string) => setMealStatus(u, m, s)
  }
}));

// Nobody in this file is away. The pause is its own suite; here it must not be
// the reason a mark is refused, or these tests would pass for the wrong reason.
vi.mock('#repositories/Vacation', () => ({ VacationRepository: { findUpcoming: () => Promise.resolve([]) } }));

function row(overrides: Partial<Row> & { id: string; version: number }): Row {
  return { endDate: '2026-09-22', startDate: '2026-09-09', status: 'completed', ...overrides };
}

describe('PlanController.listPlans — the history', () => {
  beforeEach(() => {
    findHistory.mockReset();
  });

  it('marks a plan replaced when the next lived plan began before it ended', async () => {
    findHistory.mockResolvedValue([
      row({ id: 'p4', status: 'generating', version: 4 }),
      row({ id: 'p3', startDate: '2026-09-09', status: 'active', version: 3 }),
      row({ id: 'p2', endDate: '2026-09-20', startDate: '2026-09-07', version: 2 }),
      row({ id: 'p1', endDate: '2026-09-06', startDate: '2026-08-24', version: 1 })
    ]);

    const plans = await PlanController.listPlans('usr-1');

    expect(plans.map(plan => [plan.version, plan.replaced])).toEqual([
      [4, false],
      [3, false],
      [2, true],
      [1, false]
    ]);
  });

  it('ignores a plan that was never lived when looking for a successor', async () => {
    // A failed generation between two plans is not what replaced the older one.
    findHistory.mockResolvedValue([
      row({ id: 'p2', status: 'failed', version: 2 }),
      row({ id: 'p1', endDate: '2026-09-20', startDate: '2026-09-07', status: 'active', version: 1 })
    ]);

    const plans = await PlanController.listPlans('usr-1');

    expect(plans[1]?.replaced).toBe(false);
  });
});

describe('PlanController.setMealStatus — the past is read-only', () => {
  beforeEach(() => {
    setMealStatus.mockReset();
  });

  it('passes a mark on the active plan through', async () => {
    setMealStatus.mockResolvedValue('done');

    await expect(PlanController.setMealStatus('usr-1', 'meal-1', 'completed')).resolves.toBeUndefined();
    expect(setMealStatus).toHaveBeenCalledWith('usr-1', 'meal-1', 'completed');
  });

  it('answers not-found for a meal that is not theirs', async () => {
    setMealStatus.mockResolvedValue('missing');

    await expect(PlanController.setMealStatus('usr-1', 'meal-1', 'completed')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses, as a conflict, a mark on a plan that is no longer active', async () => {
    setMealStatus.mockResolvedValue('closed');

    await expect(PlanController.setMealStatus('usr-1', 'meal-1', 'completed')).rejects.toBeInstanceOf(ConflictError);
  });
});
