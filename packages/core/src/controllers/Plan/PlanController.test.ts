import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError, QuotaExceededError } from 'core/entities/Error';

import { PlanController, PlanJobController } from './PlanController';

import type { AllowancesView } from './PlanController';

type Job = { id: string; error: string | null; errorDetail: string | null; planId: string | null; status: string; step: string | null };
type ChainRow = { id: string; endDate: string; redo: boolean; replacedRedos: number; status: string; version: number };
type Row = { id: string; endDate: string; startDate: string; status: string; version: number };

const claim = vi.fn<(userId: string, admit?: (tx: unknown) => Promise<void>) => Promise<Job | undefined>>();
const findJob = vi.fn<(userId: string, jobId: string) => Promise<(Job & { planStatus: string | null }) | undefined>>();
const findActive = vi.fn<(userId: string) => Promise<ChainRow | undefined>>();
const findChain = vi.fn<(userId: string, withPending?: boolean) => Promise<readonly ChainRow[]>>();
const findHistory = vi.fn<(userId: string, limit: number, offset: number) => Promise<readonly Row[]>>();
const release = vi.fn<(jobId: string) => Promise<void>>();
const setMealStatus = vi.fn<(userId: string, mealId: string, status: string) => Promise<'closed' | 'done' | 'missing'>>();

vi.mock('#repositories/Plan', () => ({
  PlanJobRepository: {
    adoptCompleted: () => Promise.resolve(0),
    claim: (...args: Parameters<typeof claim>) => claim(...args),
    failStale: () => Promise.resolve(0),
    findById: (...args: Parameters<typeof findJob>) => findJob(...args),
    release: (j: string) => release(j)
  },
  PlanRepository: {
    countSwaps: () => Promise.resolve(0),
    findActive: (u: string) => findActive(u),
    findChain: (...args: Parameters<typeof findChain>) => findChain(...args),
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

  describe('for a professional, through the link (0060)', () => {
    const tx = { transaction: 'the claim’s' };

    beforeEach(() => {
      // The claim runs `admit` inside its transaction, as the repository does.
      claim.mockImplementation(async (_userId, admit) => {
        await admit?.(tx);

        return job;
      });
    });

    it('checks the client’s allowance and writes the trail row inside the claim, and releases nothing', async () => {
      allowing(true);
      const record = vi.fn(async () => undefined);

      await expect(PlanJobController.start('usr-client', record)).resolves.toMatchObject({ id: 'job-1', pendingReview: false });
      expect(claim).toHaveBeenCalledWith('usr-client', expect.any(Function));
      expect(record).toHaveBeenCalledExactlyOnceWith(tx);
      expect(release).not.toHaveBeenCalled();
    });

    it('refuses a spent redo as the client’s own would be refused — before the row, so the claim rolls back with nothing written', async () => {
      allowing(false);
      const record = vi.fn(async () => undefined);

      await expect(PlanJobController.start('usr-client', record)).rejects.toBeInstanceOf(QuotaExceededError);
      expect(record).not.toHaveBeenCalled();
    });

    it('answers a conflict when a generation is already under way', async () => {
      claim.mockResolvedValue(undefined);

      await expect(
        PlanJobController.start(
          'usr-client',
          vi.fn(async () => undefined)
        )
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

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

describe('PlanController.getJob — a plan under review is kept from its client (0060)', () => {
  const done = { id: 'job-1', error: null, errorDetail: null, planId: 'plan-2', status: 'succeeded', step: 'done' };

  it('tells the client the plan is waiting, without its id', async () => {
    findJob.mockResolvedValue({ ...done, planStatus: 'pending_review' });

    await expect(PlanController.getJob('usr-1', 'job-1')).resolves.toMatchObject({ pendingReview: true, planId: null, status: 'succeeded' });
  });

  it('hands the professional the id', async () => {
    findJob.mockResolvedValue({ ...done, planStatus: 'pending_review' });

    await expect(PlanController.getJob('usr-1', 'job-1', 'professional')).resolves.toMatchObject({ pendingReview: true, planId: 'plan-2' });
  });

  it('answers everybody else as before', async () => {
    findJob.mockResolvedValue({ ...done, planStatus: 'active' });

    await expect(PlanController.getJob('usr-1', 'job-1')).resolves.toEqual({ ...done, pendingReview: false });
  });
});

describe('PlanController.allowances — a pending plan is the fortnight under way (0060)', () => {
  const active: ChainRow = { id: 'p1', endDate: '2026-12-31', redo: false, replacedRedos: 0, status: 'active', version: 1 };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(PlanController, 'tierOf').mockResolvedValue('free');
    vi.spyOn(PlanController, 'eventStanding').mockResolvedValue({ allowed: true, limit: 3, remaining: 3, used: 0 });
    findActive.mockResolvedValue(active);
  });

  it('counts the pending plan’s redo, and asks for the chain with it', async () => {
    findChain.mockResolvedValue([{ id: 'p2', endDate: '2026-12-31', redo: true, replacedRedos: 0, status: 'pending_review', version: 2 }, active]);

    const { planRedo } = await PlanController.allowances('usr-1');

    expect(findChain).toHaveBeenCalledWith('usr-1', true);
    expect(planRedo).toMatchObject({ allowed: false, kind: 'redo', used: 1 });
  });

  it('counts the redos of pending plans it replaced', async () => {
    vi.spyOn(PlanController, 'tierOf').mockResolvedValue('premium');
    findChain.mockResolvedValue([{ id: 'p4', endDate: '2026-12-31', redo: true, replacedRedos: 2, status: 'pending_review', version: 2 }, active]);

    await expect(PlanController.allowances('usr-1')).resolves.toMatchObject({ planRedo: { allowed: false, used: 3 } });
  });

  it('with no plan pending, counts from the active plan as before', async () => {
    findChain.mockResolvedValue([active]);

    await expect(PlanController.allowances('usr-1')).resolves.toMatchObject({ planRedo: { allowed: true, kind: 'redo', used: 0 } });
  });
});
