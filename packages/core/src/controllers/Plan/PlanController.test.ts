import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, InputParseError, NotFoundError, ProfileConsentRequiredError, QuotaExceededError } from 'core/entities/Error';

import { PlanController, PlanJobController } from './PlanController';

type Job = { id: string; error: string | null; errorDetail: string | null; planId: string | null; status: string; step: string | null };
type ChainRow = { id: string; endDate: string; opens?: boolean; redo: boolean; replacedRedos: number; status: string; version: number };
type Row = { id: string; endDate: string; startDate: string; status: string; version: number };

const claim = vi.fn<(userId: string, startDate?: string | null) => Promise<Job | undefined>>();
const activateDue = vi.fn<(userId: string, today: string) => Promise<boolean>>(async () => false);
const findScheduledDue = vi.fn<(latest: string) => Promise<readonly { startDate: string; timezone: string | null; userId: string }[]>>();
const findScheduled = vi.fn<(userId: string) => Promise<ChainRow | undefined>>();
const timezone = vi.fn<(userId: string) => Promise<{ timezone: string } | undefined>>(async () => ({ timezone: 'Europe/Madrid' }));
const admit = vi.fn<(jobId: string, record: unknown) => Promise<void>>();
const isPublishable = vi.fn<(userId: string) => Promise<boolean>>();
const flags = vi.fn<() => Promise<{ premium: boolean; professional: boolean }>>();
const findJob = vi.fn<(userId: string, jobId: string) => Promise<(Job & { planStatus: string | null }) | undefined>>();
const findActive = vi.fn<(userId: string) => Promise<ChainRow | undefined>>();
const findPending = vi.fn<(userId: string) => Promise<ChainRow | undefined>>();
const findChain = vi.fn<(userId: string, withPending?: boolean) => Promise<readonly ChainRow[]>>();
const findHistory = vi.fn<(userId: string, limit: number, offset: number) => Promise<readonly Row[]>>();
const release = vi.fn<(jobId: string) => Promise<void>>();
const requireProfileConsent = vi.fn<(userId: string) => Promise<void>>(async () => undefined);
const mealSize = vi.fn<(userId: string) => Promise<{ largeMeals: boolean; largestMainKcal: number } | null>>(async () => null);
const setMealStatus = vi.fn<(userId: string, mealId: string, status: string) => Promise<'closed' | 'done' | 'missing'>>();

vi.mock('#repositories/Plan', () => ({
  PlanJobRepository: {
    admit: (...args: Parameters<typeof admit>) => admit(...args),
    adoptCompleted: () => Promise.resolve(0),
    claim: (...args: Parameters<typeof claim>) => claim(...args),
    failStale: () => Promise.resolve(0),
    findById: (...args: Parameters<typeof findJob>) => findJob(...args),
    release: (j: string) => release(j)
  },
  PlanRepository: {
    activateDue: (...args: Parameters<typeof activateDue>) => activateDue(...args),
    countSwaps: () => Promise.resolve(0),
    findActive: (u: string) => findActive(u),
    findChain: (...args: Parameters<typeof findChain>) => findChain(...args),
    findHistory: (u: string, l: number, o: number) => findHistory(u, l, o),
    findPending: (u: string) => findPending(u),
    findScheduled: (u: string) => findScheduled(u),
    findScheduledDue: (latest: string) => findScheduledDue(latest),
    isPublishable: (u: string) => isPublishable(u),
    setMealStatus: (u: string, m: string, s: string) => setMealStatus(u, m, s)
  }
}));

const coveredByOpenPractice = vi.fn<(userId: string) => Promise<boolean>>();
const columnTier = vi.fn<(userId: string) => Promise<'free' | 'premium'>>();

vi.mock('#repositories/Care', () => ({ CareRepository: { coveredByOpenPractice: (u: string) => coveredByOpenPractice(u) } }));
vi.mock('#repositories/User', () => ({ UserRepository: { tierOf: (u: string) => columnTier(u) } }));

// Nobody in this file is away. The pause is its own suite; here it must not be
// the reason a mark is refused, or these tests would pass for the wrong reason.
vi.mock('core/controllers/Profile', () => ({
  ProfileController: { mealSize: (u: string) => mealSize(u) },
  requireProfileConsent: (u: string) => requireProfileConsent(u)
}));
vi.mock('core/controllers/Settings', () => ({ SettingsController: { flags: () => flags() } }));
vi.mock('#repositories/Profile', () => ({ ProfileRepository: { findByUserId: (u: string) => timezone(u) } }));
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
    const record = vi.fn(async () => undefined);

    beforeEach(() => {
      admit.mockReset();
      claim.mockResolvedValue(job);
    });

    it('claims, checks the client’s allowance, then admits the job with the trail row — and keeps the claim', async () => {
      allowing(true);

      await expect(PlanJobController.start('usr-client', record)).resolves.toMatchObject({ id: 'job-1', pendingReview: false });
      expect(claim).toHaveBeenCalledWith('usr-client', null);
      expect(admit).toHaveBeenCalledExactlyOnceWith('job-1', record);
      expect(release).not.toHaveBeenCalled();
    });

    it('refuses a spent redo as the client’s own would be refused: no row, and the claim given back', async () => {
      allowing(false);

      await expect(PlanJobController.start('usr-client', record)).rejects.toBeInstanceOf(QuotaExceededError);
      expect(admit).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledWith('job-1');
    });

    it('asks the professional’s rule again under the claim: a fortnight started meanwhile is a 404, no row, the claim given back', async () => {
      const allowances = allowing(true);
      const may = vi.spyOn(PlanController, 'professionalMayGenerate').mockResolvedValue(false);

      await expect(PlanJobController.start('usr-client', record)).rejects.toBeInstanceOf(NotFoundError);
      expect(may).toHaveBeenCalledWith('usr-client');
      expect(allowances).not.toHaveBeenCalled();
      expect(admit).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledWith('job-1');
    });

    it('does not ask it for the client’s own generation', async () => {
      allowing(true);
      const may = vi.spyOn(PlanController, 'professionalMayGenerate');

      await expect(PlanJobController.start('usr-client')).resolves.toMatchObject({ id: 'job-1' });
      expect(may).not.toHaveBeenCalled();
    });

    it('gives the claim back when the row cannot be written', async () => {
      allowing(true);
      admit.mockRejectedValue(new ConflictError('The generation is no longer waiting to start'));

      await expect(PlanJobController.start('usr-client', record)).rejects.toBeInstanceOf(ConflictError);
      expect(release).toHaveBeenCalledWith('job-1');
    });
  });

  function standing(allowed: boolean) {
    return {
      meaning: { cuts: '2026-10-01', kind: 'redo' as const, scheduled: false },
      standing: { allowed, kind: 'redo' as const, limit: 1, nextAt: '2026-10-06', used: allowed ? 0 : 1 }
    };
  }

  function allowing(allowed: boolean) {
    return vi.spyOn(PlanController, 'startStanding').mockResolvedValue(standing(allowed));
  }

  beforeEach(() => {
    claim.mockReset();
    release.mockReset();
    vi.restoreAllMocks();
  });

  it('refuses without the profile consent before claiming anything: no job, no allowance read (RGPD art. 9.2.a)', async () => {
    const allowances = allowing(true);

    requireProfileConsent.mockRejectedValueOnce(new ProfileConsentRequiredError());

    await expect(PlanJobController.start('usr-1')).rejects.toBeInstanceOf(ProfileConsentRequiredError);
    expect(requireProfileConsent).toHaveBeenCalledWith('usr-1');
    expect(claim).not.toHaveBeenCalled();
    expect(allowances).not.toHaveBeenCalled();
  });

  it('asks the client’s consent, not the professional’s, when a professional starts it', async () => {
    requireProfileConsent.mockRejectedValueOnce(new ProfileConsentRequiredError());

    await expect(
      PlanJobController.start(
        'usr-client',
        vi.fn(async () => undefined)
      )
    ).rejects.toBeInstanceOf(ProfileConsentRequiredError);
    expect(requireProfileConsent).toHaveBeenCalledWith('usr-client');
    expect(claim).not.toHaveBeenCalled();
  });

  it('answers a conflict when the slot is already claimed, and starts nothing', async () => {
    const allowances = allowing(true);

    claim.mockResolvedValue(undefined);

    await expect(PlanJobController.start('usr-1')).rejects.toBeInstanceOf(ConflictError);
    // The refusal costs no pipeline: the claim is what says a generation is
    // under way, and it said so. The allowance was asked once, before it.
    expect(allowances).toHaveBeenCalledOnce();
    expect(release).not.toHaveBeenCalled();
  });

  it('refuses a spent redo before claiming anything: no job row (project 015)', async () => {
    allowing(false);
    claim.mockResolvedValue(job);

    await expect(PlanJobController.start('usr-1')).rejects.toBeInstanceOf(QuotaExceededError);
    expect(claim).not.toHaveBeenCalled();
  });

  it('gives the slot back when the redo was spent between the first question and the claim', async () => {
    vi.spyOn(PlanController, 'startStanding').mockResolvedValueOnce(standing(true)).mockResolvedValueOnce(standing(false));
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

  describe('a chosen start day (project 015)', () => {
    const today = new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Madrid', year: 'numeric' }).format(
      new Date()
    );

    function after(days: number): string {
      const date = new Date(`${today}T00:00:00Z`);

      date.setUTCDate(date.getUTCDate() + days);

      return date.toISOString().slice(0, 10);
    }

    beforeEach(() => {
      claim.mockResolvedValue(job);
      activateDue.mockReset();
      activateDue.mockResolvedValue(false);
    });

    it('refuses a day before today or more than a week ahead as invalid input, before anything is claimed', async () => {
      const allowances = allowing(true);

      for (const day of [after(-1), after(8)]) {
        await expect(PlanJobController.start('usr-1', undefined, day)).rejects.toBeInstanceOf(InputParseError);
      }

      expect(claim).not.toHaveBeenCalled();
      expect(allowances).not.toHaveBeenCalled();
    });

    it('keeps a day ahead on the job, and asks what it spends for that day, before and under the claim', async () => {
      const allowances = allowing(true);

      await expect(PlanJobController.start('usr-1', undefined, after(7))).resolves.toMatchObject({ id: 'job-1' });
      expect(claim).toHaveBeenCalledWith('usr-1', after(7));
      expect(allowances).toHaveBeenCalledTimes(2);
      expect(allowances).toHaveBeenNthCalledWith(1, 'usr-1', after(7));
      expect(allowances).toHaveBeenNthCalledWith(2, 'usr-1', after(7));
    });

    it('stores today as no choice, which is the generation it always was', async () => {
      allowing(true);

      await PlanJobController.start('usr-1', undefined, today);

      expect(claim).toHaveBeenCalledWith('usr-1', null);
    });

    it('activates a plan whose day has come before anything is counted', async () => {
      allowing(true);

      await PlanJobController.start('usr-1');

      expect(activateDue).toHaveBeenCalledWith('usr-1', today);
    });
  });
});

describe('PlanController.professionalMayGenerate — never over a fortnight still running (0060, 2026-09-24)', () => {
  const TODAY = '2026-09-24';

  function active(endDate: string): ChainRow {
    return { id: 'plan-1', endDate, redo: false, replacedRedos: 0, status: 'active', version: 1 };
  }

  beforeEach(() => {
    findActive.mockReset();
    findPending.mockReset();
  });

  it('allows a client with no plan', async () => {
    await expect(PlanController.professionalMayGenerate('usr-client', TODAY)).resolves.toBe(true);
  });

  it('allows the next fortnight once the active one has ended — the day the client’s allowance offers a new one', async () => {
    findActive.mockResolvedValue(active('2026-09-23'));

    await expect(PlanController.professionalMayGenerate('usr-client', TODAY)).resolves.toBe(true);
  });

  it('refuses while the fortnight still runs, its last day included', async () => {
    findActive.mockResolvedValue(active(TODAY));
    await expect(PlanController.professionalMayGenerate('usr-client', TODAY)).resolves.toBe(false);

    findActive.mockResolvedValue(active('2026-10-01'));
    await expect(PlanController.professionalMayGenerate('usr-client', TODAY)).resolves.toBe(false);
  });

  it('allows regenerating a pending plan, whatever the active one says', async () => {
    findActive.mockResolvedValue(active('2026-10-01'));
    findPending.mockResolvedValue({ ...active('2026-10-08'), id: 'plan-2', status: 'pending_review', version: 2 });

    await expect(PlanController.professionalMayGenerate('usr-client', TODAY)).resolves.toBe(true);
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
    flags.mockResolvedValue({ premium: false, professional: true });
    isPublishable.mockResolvedValue(true);
    mealSize.mockResolvedValue(null);
  });

  it('carries the size of the largest main meal, for the note before generating (016)', async () => {
    findChain.mockResolvedValue([active]);
    mealSize.mockResolvedValue({ largeMeals: true, largestMainKcal: 1100 });

    await expect(PlanController.allowances('usr-1')).resolves.toMatchObject({ mealSize: { largeMeals: true, largestMainKcal: 1100 } });
    expect(mealSize).toHaveBeenCalledWith('usr-1');
  });

  it('costs the client nothing for a pending plan nobody can publish any more — the link ended, paused or lost its grant', async () => {
    isPublishable.mockResolvedValue(false);
    findChain.mockResolvedValue([{ id: 'p2', endDate: '2026-12-31', redo: true, replacedRedos: 1, status: 'pending_review', version: 2 }, active]);

    await expect(PlanController.allowances('usr-1')).resolves.toMatchObject({ planRedo: { allowed: true, used: 0 } });
  });

  it('costs nothing either while the switch is off', async () => {
    flags.mockResolvedValue({ premium: false, professional: false });
    findChain.mockResolvedValue([{ id: 'p2', endDate: '2026-12-31', redo: true, replacedRedos: 0, status: 'pending_review', version: 2 }, active]);

    await expect(PlanController.allowances('usr-1')).resolves.toMatchObject({ planRedo: { allowed: true, used: 0 } });
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

  it('never shows the client when a plan they cannot see ends — a generation is still judged against it', async () => {
    findActive.mockResolvedValue(undefined);
    findChain.mockResolvedValue([{ id: 'p2', endDate: '2026-12-31', redo: true, replacedRedos: 0, status: 'pending_review', version: 2 }]);

    await expect(PlanController.allowances('usr-1')).resolves.toMatchObject({ planRedo: { kind: 'new_fortnight', nextAt: null } });
    await expect(PlanController.allowances('usr-1', true)).resolves.toMatchObject({
      planRedo: { allowed: false, kind: 'redo', nextAt: '2027-01-01', used: 1 }
    });
  });

  it('with no plan pending, counts from the active plan as before', async () => {
    findChain.mockResolvedValue([active]);

    await expect(PlanController.allowances('usr-1')).resolves.toMatchObject({ planRedo: { allowed: true, kind: 'redo', used: 0 } });
  });
});

/*
 * `0061`: a client of a practice paid for has the paid allowances — behind
 * the `professional` switch, before the `premium` switch or the column. The
 * repository's question is the link (`active`) and the practice (`practiceOpen`).
 */
describe('PlanController.tierOf — a client of a practice', () => {
  beforeEach(() => {
    // The allowance suites above spy on `tierOf` itself.
    vi.restoreAllMocks();
    coveredByOpenPractice.mockReset();
    columnTier.mockReset();
    columnTier.mockResolvedValue('free');
  });

  it('is premium with an active link to an open practice, whatever the premium switch and the column say', async () => {
    flags.mockResolvedValue({ premium: false, professional: true });
    coveredByOpenPractice.mockResolvedValue(true);

    await expect(PlanController.tierOf('usr-client')).resolves.toBe('premium');
    expect(coveredByOpenPractice).toHaveBeenCalledWith('usr-client');
    expect(columnTier).not.toHaveBeenCalled();
  });

  it('goes back to the ordinary rule when the link is paused or ended, or the practice closed', async () => {
    flags.mockResolvedValue({ premium: false, professional: true });
    coveredByOpenPractice.mockResolvedValue(false);

    await expect(PlanController.tierOf('usr-client')).resolves.toBe('free');

    flags.mockResolvedValue({ premium: true, professional: true });
    columnTier.mockResolvedValue('premium');

    await expect(PlanController.tierOf('usr-client')).resolves.toBe('premium');
  });

  it('asks nothing about a link while the professional switch is off', async () => {
    flags.mockResolvedValue({ premium: false, professional: false });
    coveredByOpenPractice.mockResolvedValue(true);

    await expect(PlanController.tierOf('usr-client')).resolves.toBe('free');
    expect(coveredByOpenPractice).not.toHaveBeenCalled();
  });
});

describe('the chooser of first days (project 015)', () => {
  const today = new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Madrid', year: 'numeric' }).format(new Date());

  function after(days: number): string {
    const date = new Date(`${today}T00:00:00Z`);

    date.setUTCDate(date.getUTCDate() + days);

    return date.toISOString().slice(0, 10);
  }

  function plan(overrides: Partial<ChainRow> & { id: string; version: number }): ChainRow {
    return { endDate: after(2), redo: false, replacedRedos: 0, status: 'active', ...overrides };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(PlanController, 'tierOf').mockResolvedValue('free');
    vi.spyOn(PlanController, 'eventStanding').mockResolvedValue({ allowed: true, limit: 3, remaining: 3, used: 0 });
    flags.mockResolvedValue({ premium: false, professional: false });
    mealSize.mockResolvedValue(null);
    activateDue.mockReset();
    activateDue.mockResolvedValue(false);
  });

  it('offers today to a week ahead; inside the fortnight under way is a redo, after it free, and the day after it first', async () => {
    const active = plan({ id: 'p1', version: 1 });

    findActive.mockResolvedValue(active);
    findChain.mockResolvedValue([active]);

    const view = await PlanController.allowances('usr-1');

    expect(view.defaultStart).toBe(after(3));
    expect(view.startOptions.map(option => option.date)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map(after));
    expect(view.startOptions.slice(0, 3).every(option => option.kind === 'redo' && option.allowed)).toBe(true);
    expect(view.startOptions.slice(3).every(option => option.kind === 'new_fortnight' && option.allowed)).toBe(true);
    expect(activateDue).toHaveBeenCalledWith('usr-1', today);
  });

  it('refuses every redo day once the redo is spent, and leaves the next fortnight open', async () => {
    const active = plan({ id: 'p2', redo: true, version: 2 });

    findActive.mockResolvedValue(active);
    findChain.mockResolvedValue([active, plan({ id: 'p1', status: 'completed', version: 1 })]);

    const view = await PlanController.allowances('usr-1');

    expect(view.startOptions.filter(option => !option.allowed).map(option => option.date)).toEqual([0, 1, 2].map(after));
  });

  it('defaults to today with no plan, or one ending beyond the week', async () => {
    findActive.mockResolvedValue(undefined);
    findChain.mockResolvedValue([]);
    await expect(PlanController.allowances('usr-1')).resolves.toMatchObject({ defaultStart: today });

    const long = plan({ id: 'p1', endDate: after(10), version: 1 });

    findActive.mockResolvedValue(long);
    findChain.mockResolvedValue([long]);
    await expect(PlanController.allowances('usr-1')).resolves.toMatchObject({ defaultStart: today });
  });

  it('makes every day a redo while a plan waits for its day, counted in the fortnight it opens', async () => {
    const active = plan({ id: 'p1', redo: true, version: 1 });
    const waiting = plan({ id: 'p2', endDate: after(16), status: 'scheduled', version: 2 });

    findActive.mockResolvedValue(active);
    findChain.mockResolvedValue([waiting, active]);

    const free = await PlanController.allowances('usr-1');

    // The plan under way spent its redo: cutting it is refused; replacing the waiting one is not.
    expect(free.startOptions.map(option => [option.kind, option.allowed])).toEqual([
      ['redo', false],
      ['redo', false],
      ['redo', false],
      ...Array.from({ length: 5 }, () => ['redo', true])
    ]);

    findChain.mockResolvedValue([plan({ ...waiting, opens: true, redo: true }), active]);

    const spent = await PlanController.startStanding('usr-1', after(5));

    expect(spent.standing).toMatchObject({ allowed: false, kind: 'redo', used: 1 });
  });
});

describe('PlanController — reading a plan activates one whose day has come (project 015)', () => {
  beforeEach(() => {
    activateDue.mockReset();
    activateDue.mockResolvedValue(false);
  });

  it('asks before reading the active plan', async () => {
    findActive.mockResolvedValue(undefined);

    await expect(PlanController.getActivePlan('usr-1')).resolves.toBeNull();
    expect(activateDue).toHaveBeenCalledOnce();
  });

  it('answers not found when nothing waits', async () => {
    findScheduled.mockResolvedValue(undefined);

    await expect(PlanController.getScheduledPlan('usr-1')).rejects.toBeInstanceOf(NotFoundError);
    await expect(PlanController.getScheduledShoppingList('usr-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('activates, in the cron, each owner whose day has come in their own zone, and carries on past a failure', async () => {
    // 22:30 UTC: already the 3rd in Madrid, still the 2nd in New York.
    const now = new Date('2026-10-02T22:30:00Z');

    findScheduledDue.mockResolvedValue([
      { startDate: '2026-10-03', timezone: 'Europe/Madrid', userId: 'usr-madrid' },
      { startDate: '2026-10-03', timezone: 'America/New_York', userId: 'usr-ny' },
      { startDate: '2026-10-02', timezone: null, userId: 'usr-broken' }
    ]);
    activateDue.mockImplementation(async userId => {
      if (userId === 'usr-broken') {
        throw new Error('down');
      }

      return true;
    });

    await expect(PlanController.activateAllDue(now)).resolves.toEqual({ activated: 1, failed: 1 });
    expect(findScheduledDue).toHaveBeenCalledWith('2026-10-03');
    expect(activateDue).toHaveBeenCalledWith('usr-madrid', '2026-10-03');
    expect(activateDue).not.toHaveBeenCalledWith('usr-ny', expect.anything());
  });
});

describe('PlanController.cutComposition — what a plan cut short keeps (project 015)', () => {
  const meal = (id: string, date: string) => ({ id, date }) as unknown as Awaited<ReturnType<typeof PlanController.composition>>[number];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the active plan’s meals before the start, with its id', async () => {
    findActive.mockResolvedValue({ id: 'plan-a', endDate: '2026-10-04', redo: false, replacedRedos: 0, status: 'active', version: 1 });
    vi.spyOn(PlanController, 'composition').mockResolvedValue([meal('m1', '2026-10-02'), meal('m2', '2026-10-03'), meal('m3', '2026-10-04')]);

    const kept = await PlanController.cutComposition('usr-1', '2026-10-04');

    expect(kept?.planId).toBe('plan-a');
    expect(kept?.meals.map(entry => entry.id)).toEqual(['m1', 'm2']);
  });

  it('is null when nothing is cut: no plan, or one that ends before the start', async () => {
    findActive.mockResolvedValue(undefined);
    await expect(PlanController.cutComposition('usr-1', '2026-10-05')).resolves.toBeNull();

    findActive.mockResolvedValue({ id: 'plan-a', endDate: '2026-10-04', redo: false, replacedRedos: 0, status: 'active', version: 1 });
    await expect(PlanController.cutComposition('usr-1', '2026-10-05')).resolves.toBeNull();
  });
});
