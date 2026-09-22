import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError, QuotaExceededError } from 'core/entities/Error';

import { PlanController, PlanJobController } from './PlanController';

import type { AllowancesView } from './PlanController';

type Job = { id: string; error: string | null; errorDetail: string | null; planId: string | null; status: string; step: string | null };
type Row = { id: string; endDate: string; startDate: string; status: string; version: number };

const claim = vi.fn<(userId: string) => Promise<Job | undefined>>();
const findHistory = vi.fn<(userId: string, limit: number, offset: number) => Promise<readonly Row[]>>();
const release = vi.fn<(jobId: string) => Promise<void>>();
const setMealStatus = vi.fn<(userId: string, mealId: string, status: string) => Promise<'closed' | 'done' | 'missing'>>();

vi.mock('#repositories/Plan', () => ({
  PlanJobRepository: {
    adoptCompleted: () => Promise.resolve(0),
    claim: (u: string) => claim(u),
    failStale: () => Promise.resolve(0),
    release: (j: string) => release(j)
  },
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

describe('PlanJobController.start — one generation at a time', () => {
  const job: Job = { id: 'job-1', error: null, errorDetail: null, planId: null, status: 'queued', step: null };

  function allowing(allowed: boolean) {
    return vi
      .spyOn(PlanController, 'allowances')
      .mockResolvedValue({ planRedo: { allowed, kind: 'redo', limit: 1, nextAt: '2026-10-06', used: allowed ? 0 : 1 } } as AllowancesView);
  }

  beforeEach(() => {
    claim.mockReset();
    release.mockReset();
    vi.restoreAllMocks();
  });

  it('answers a conflict when the slot is already claimed, and starts nothing', async () => {
    const allowances = allowing(true);

    claim.mockResolvedValue(undefined);

    await expect(PlanJobController.start('usr-1')).rejects.toBeInstanceOf(ConflictError);
    // The refusal costs no reads and, above all, no pipeline: the claim is what
    // says a generation is under way, and it said so.
    expect(allowances).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it('gives the slot back when the redo is not allowed', async () => {
    allowing(false);
    claim.mockResolvedValue(job);

    await expect(PlanJobController.start('usr-1')).rejects.toBeInstanceOf(QuotaExceededError);
    // Claimed to make the count honest, released because nothing was started —
    // otherwise a refused press would block the next fifteen minutes.
    expect(release).toHaveBeenCalledWith('job-1');
  });

  it('keeps the claim when the generation may go ahead', async () => {
    allowing(true);
    claim.mockResolvedValue(job);

    await expect(PlanJobController.start('usr-1')).resolves.toMatchObject({ id: 'job-1', status: 'queued' });
    expect(release).not.toHaveBeenCalled();
  });
});
