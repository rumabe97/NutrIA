import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgressController } from './ProgressController';

import type { CheckInRow } from '#repositories/CheckIn';
import type { Goal } from 'core/entities/Profile';
import type { MealMark } from '#repositories/Progress';
import type { ProgressEntry } from 'core/entities/Progress';

type Plan = { id: string; completedAt: string | null; endDate: string; redo: boolean; startDate: string; status: string; version: number };

const findRecent = vi.fn<(userId: string, limit: number) => Promise<readonly ProgressEntry[]>>();
const mealMarksByDay = vi.fn<(userId: string, upTo: string) => Promise<readonly MealMark[]>>();
const findActiveGoal = vi.fn<(userId: string) => Promise<Goal | undefined>>();
const findChain = vi.fn<(userId: string) => Promise<readonly Plan[]>>();
const findAll = vi.fn<(userId: string) => Promise<readonly CheckInRow[]>>();

vi.mock('#repositories/Progress', () => ({ ProgressRepository: { findRecent: (u: string, l: number) => findRecent(u, l), mealMarksByDay: (u: string, d: string) => mealMarksByDay(u, d), upsertWeight: vi.fn() } }));
vi.mock('#repositories/Profile', () => ({ ProfileRepository: { findActiveGoal: (u: string) => findActiveGoal(u) } }));
vi.mock('#repositories/Plan', () => ({ PlanRepository: { findChain: (u: string) => findChain(u) } }));
vi.mock('#repositories/CheckIn', () => ({ CheckInRepository: { findAll: (u: string) => findAll(u) } }));

const USER = 'usr-1';
const TODAY = '2026-09-09';

function entry(loggedOn: string, weightKg: number | null): ProgressEntry {
  return { id: `11111111-2222-4333-8444-${loggedOn.replaceAll('-', '')}0000`.slice(0, 36), loggedOn, weightKg };
}

function plan(overrides: Partial<Plan> & { id: string; version: number }): Plan {
  return { completedAt: null, endDate: '2026-09-14', redo: false, startDate: '2026-09-01', status: 'active', ...overrides };
}

/** `n` meals a day with the given status, one row per day in the range. */
function days(planId: string, status: MealMark['status'], from: string, to: string, n: number): MealMark[] {
  const marks: MealMark[] = [];

  for (let date = from; date <= to; date = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
    marks.push({ date, n, planId, status });
  }

  return marks;
}

const goal: Goal = { id: '11111111-2222-4333-8444-555555555555', paceKgPerWeek: 0.5, startingWeightKg: 90, targetWeightKg: 80, type: 'weight_loss' } as Goal;

describe('ProgressController.summary — weight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findChain.mockResolvedValue([]);
    mealMarksByDay.mockResolvedValue([]);
    findAll.mockResolvedValue([]);
    findActiveGoal.mockResolvedValue(goal);
  });

  it('reads oldest to newest, and measures change against the goal it started from', async () => {
    // The repository hands back newest first; a chart reads the other way.
    findRecent.mockResolvedValue([entry('2026-09-09', 86.2), entry('2026-08-20', 88.4), entry('2026-08-01', 89.7)]);

    const { weight } = await ProgressController.summary(USER, TODAY);

    expect(weight.entries.map(point => point.loggedOn)).toEqual(['2026-08-01', '2026-08-20', '2026-09-09']);
    expect(weight).toMatchObject({ changeKg: -3.8, goalType: 'weight_loss', latestKg: 86.2, startingWeightKg: 90, targetWeightKg: 80, toTargetKg: -6.2 });
  });

  it('falls back to the first reading as the baseline when the goal has no starting weight', async () => {
    findActiveGoal.mockResolvedValue({ ...goal, startingWeightKg: null, targetWeightKg: null });
    findRecent.mockResolvedValue([entry('2026-09-09', 86.2), entry('2026-08-01', 89.7)]);

    const { weight } = await ProgressController.summary(USER, TODAY);

    expect(weight).toMatchObject({ changeKg: -3.5, toTargetKg: null });
  });

  it('calls one reading a number, not a change', async () => {
    findActiveGoal.mockResolvedValue(undefined);
    findRecent.mockResolvedValue([entry('2026-09-09', 86.2)]);

    const { weight } = await ProgressController.summary(USER, TODAY);

    expect(weight).toMatchObject({ changeKg: null, fortnightChangeKg: null, goalType: null, latestKg: 86.2, toTargetKg: null });
  });

  it('compares with the reading on or before a fortnight earlier, skipping days with no weight', async () => {
    findRecent.mockResolvedValue([entry('2026-09-09', 86), entry('2026-09-01', 87), entry('2026-08-24', 88), entry('2026-08-10', 89.5), entry('2026-08-11', null)]);

    const { weight } = await ProgressController.summary(USER, TODAY);

    // 14 days before the 9th is the 26th of August; the reading on or before it is the 24th.
    expect(weight.fortnightChangeKg).toBe(-2);
    expect(weight.entries).toHaveLength(4);
  });
});

describe('ProgressController.summary — fortnights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findRecent.mockResolvedValue([]);
    findActiveGoal.mockResolvedValue(undefined);
    findAll.mockResolvedValue([]);
  });

  it('lists the plans that were lived, newest first, with the check-in that closed them', async () => {
    findChain.mockResolvedValue([
      plan({ id: 'p3', status: 'generating', version: 3 }),
      plan({ id: 'p2', startDate: '2026-09-01', status: 'active', version: 2 }),
      plan({ id: 'p1', endDate: '2026-08-31', startDate: '2026-08-18', status: 'completed', version: 1 }),
      plan({ id: 'p0', status: 'failed', version: 0 })
    ]);
    mealMarksByDay.mockResolvedValue([
      ...days('p1', 'completed', '2026-08-18', '2026-08-27', 2),
      ...days('p1', 'skipped', '2026-08-28', '2026-08-31', 1),
      ...days('p1', 'planned', '2026-08-28', '2026-08-31', 1),
      ...days('p2', 'completed', '2026-09-01', '2026-09-09', 1),
      { date: '2026-09-09', n: 1, planId: 'p2', status: 'skipped' },
      ...days('p2', 'planned', '2026-09-08', '2026-09-09', 1)
    ]);
    findAll.mockResolvedValue([
      { id: 'c1', comments: null, completedAt: '2026-08-31', difficultyRating: 2, hungerRating: 1, planId: 'p1', satisfactionRating: 4, weightKg: 88.4 }
    ]);

    const { fortnights, overall } = await ProgressController.summary(USER, TODAY);

    expect(mealMarksByDay).toHaveBeenCalledWith(USER, TODAY);
    expect(fortnights.map(fortnight => fortnight.version)).toEqual([2, 1]);
    expect(fortnights[0]).toMatchObject({ adherence: 90, checkIn: null, endDate: '2026-09-14', meals: { eaten: 9, skipped: 1, soFar: 12 }, replaced: false });
    expect(fortnights[1]).toMatchObject({
      adherence: 83,
      checkIn: { difficulty: 'ok', hunger: 'hungry', satisfaction: 4, weightKg: 88.4 },
      meals: { eaten: 20, skipped: 4, soFar: 28 },
      replaced: false
    });
    expect(overall).toEqual({ adherence: 85, eaten: 29, marked: 34 });
  });

  it('drops a plan that was replaced before a single meal was marked', async () => {
    // The owner's own history: a plan, a regeneration the same day, a redo two days later.
    findChain.mockResolvedValue([
      plan({ id: 'p3', endDate: '2026-09-22', startDate: '2026-09-09', status: 'active', version: 3 }),
      plan({ id: 'p2', endDate: '2026-09-20', startDate: '2026-09-07', status: 'completed', version: 2 }),
      plan({ id: 'p1', endDate: '2026-09-20', startDate: '2026-09-07', status: 'completed', version: 1 })
    ]);
    mealMarksByDay.mockResolvedValue([
      ...days('p1', 'planned', '2026-09-07', '2026-09-09', 4),
      ...days('p2', 'planned', '2026-09-07', '2026-09-09', 4),
      ...days('p3', 'planned', '2026-09-09', '2026-09-09', 4)
    ]);

    const { fortnights } = await ProgressController.summary(USER, TODAY);

    expect(fortnights.map(fortnight => fortnight.version)).toEqual([3]);
    expect(fortnights[0]).toMatchObject({ meals: { eaten: 0, skipped: 0, soFar: 4 }, replaced: false });
  });

  it('keeps a replaced plan that was lived, counting only the days before its successor', async () => {
    findChain.mockResolvedValue([
      plan({ id: 'p2', endDate: '2026-09-22', startDate: '2026-09-09', status: 'active', version: 2 }),
      plan({ id: 'p1', endDate: '2026-09-20', startDate: '2026-09-07', status: 'completed', version: 1 })
    ]);
    mealMarksByDay.mockResolvedValue([
      ...days('p1', 'completed', '2026-09-07', '2026-09-08', 3),
      ...days('p1', 'planned', '2026-09-07', '2026-09-09', 1),
      // A mark on the day of the redo belongs to the plan that replaced it.
      { date: '2026-09-09', n: 4, planId: 'p1', status: 'completed' },
      ...days('p2', 'completed', '2026-09-09', '2026-09-09', 2)
    ]);

    const { fortnights } = await ProgressController.summary(USER, TODAY);

    expect(fortnights.map(fortnight => fortnight.version)).toEqual([2, 1]);
    expect(fortnights[1]).toMatchObject({ adherence: 100, endDate: '2026-09-08', meals: { eaten: 6, skipped: 0, soFar: 8 }, replaced: true, startDate: '2026-09-07' });
  });

  it('reports no adherence rather than zero when nothing was marked', async () => {
    findChain.mockResolvedValue([plan({ id: 'p1', version: 1 })]);
    mealMarksByDay.mockResolvedValue(days('p1', 'planned', '2026-09-01', '2026-09-02', 3));

    const { fortnights, overall } = await ProgressController.summary(USER, TODAY);

    expect(fortnights[0]).toMatchObject({ adherence: null, meals: { eaten: 0, skipped: 0, soFar: 6 } });
    expect(overall.adherence).toBeNull();
  });

  it('is empty, not broken, for someone with no plan yet', async () => {
    findChain.mockResolvedValue([]);
    mealMarksByDay.mockResolvedValue([]);

    await expect(ProgressController.summary(USER, TODAY)).resolves.toMatchObject({ fortnights: [], overall: { adherence: null, eaten: 0, marked: 0 } });
  });
});
