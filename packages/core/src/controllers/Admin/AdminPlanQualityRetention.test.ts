import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminPlanQualityController, MIN_PLANS_FOR_SHARES } from './AdminPlanQualityController';
import { AdminRetentionController, cohortStarts, MIN_COHORT_FOR_SHARES } from './AdminRetentionController';

import type { PlanQualityTotals } from '#repositories/Admin';

const quality = vi.hoisted(() => ({ dataStart: vi.fn(), totals: vi.fn() }));
const retention = vi.hoisted(() => ({ cohorts: vi.fn() }));

vi.mock('#repositories/Admin', () => ({ AdminPlanQualityRepository: quality, AdminRetentionRepository: retention, RETENTION_WEEKS: [1, 2, 4] }));

const NOW = new Date('2026-09-29T10:00:00Z');

function totals(overrides: Partial<PlanQualityTotals> = {}): PlanQualityTotals {
  return {
    advisoriesByKind: { variety: 2 },
    days: 140,
    daysFloorNarrowed: 20,
    daysFloorNarrowedOutOfBand: 5,
    daysInBand: 112,
    eventDays: 10,
    eventDaysInBand: 8,
    fallbackFullLibrary: 1,
    fallbackWiderRotation: 3,
    floorBase: { days: 140, daysInBand: 112, plans: 10 },
    loadsRefused: 0,
    misses: { carbs: 14, fat: 14, kcal: 14, protein: 28 },
    plans: 10,
    stretchPlans: [10, 10, 10],
    withoutQuality: 4,
    ...overrides
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  quality.dataStart.mockResolvedValue(new Date('2026-09-29T08:00:00Z'));
});

describe('AdminPlanQualityController', () => {
  it('turns the sums into shares, with the floor’s rest measured over the days it did not narrow', async () => {
    quality.totals.mockResolvedValue(totals());

    const view = await AdminPlanQualityController.quality(30, NOW);

    if (view.fewData) {
      throw new Error('expected the full view');
    }

    expect(view.fewData).toBe(false);
    expect(view.dataStart).toBe('2026-09-29');
    expect(view.shares?.inBand).toBeCloseTo(0.8);
    expect(view.shares?.inBandByMacro.protein).toBeCloseTo(0.8);
    expect(view.shares?.inBandByMacro.kcal).toBeCloseTo(0.9);
    expect(view.shares?.eventInBand).toBeCloseTo(0.8);
    expect(view.shares?.floor?.narrowedOutOfBand).toBeCloseTo(0.25);
    // (140 − 112 − 5) ÷ (140 − 20)
    expect(view.shares?.floor?.restOutOfBand).toBeCloseTo(23 / 120);
    expect(view.floor).toMatchObject({ daysNarrowed: 20, daysNarrowedOutOfBand: 5 });
  });

  it('ends the window at today’s Madrid midnight and asks for the three disjoint stretches in the same call', async () => {
    quality.totals.mockResolvedValue(totals());

    const view = await AdminPlanQualityController.quality(30, NOW);

    expect(view.window.to).toBe('2026-09-28T22:00:00.000Z');
    expect(view.window.from).toBe('2026-08-29T22:00:00.000Z');
    expect(quality.totals).toHaveBeenCalledWith(new Date('2026-08-29T22:00:00.000Z'), new Date('2026-09-28T22:00:00.000Z'), [
      expect.objectContaining({ from: new Date('2026-09-21T22:00:00.000Z'), to: new Date('2026-09-28T22:00:00.000Z') }),
      expect.objectContaining({ from: new Date('2026-08-29T22:00:00.000Z'), to: new Date('2026-09-21T22:00:00.000Z') }),
      expect.objectContaining({ from: new Date('2026-06-30T22:00:00.000Z'), to: new Date('2026-08-29T22:00:00.000Z') })
    ]);
  });

  it('below the threshold returns exactly the seven keys and nothing else', async () => {
    quality.totals.mockResolvedValue(totals({ plans: MIN_PLANS_FOR_SHARES - 1, stretchPlans: [9, 0, 0] }));

    const view = await AdminPlanQualityController.quality(7, NOW);

    expect(Object.keys(view).sort()).toEqual(['dataStart', 'fewData', 'minPlans', 'period', 'plans', 'window', 'withoutQuality']);
    expect(view).toMatchObject({ fewData: true, minPlans: MIN_PLANS_FOR_SHARES, plans: 9 });
  });

  it('withholds a period whose total is enough when a stretch inside it has some plans but fewer than ten', async () => {
    quality.totals.mockResolvedValue(totals({ plans: 25, stretchPlans: [20, 5, 0] }));

    expect((await AdminPlanQualityController.quality(30, NOW)).fewData).toBe(true);
    expect((await AdminPlanQualityController.quality(90, NOW)).fewData).toBe(true);
    // The 7-day period does not contain the thin stretch.
    expect((await AdminPlanQualityController.quality(7, NOW)).fewData).toBe(false);
  });

  it('lets a stretch with no plan at all through', async () => {
    quality.totals.mockResolvedValue(totals({ plans: 12, stretchPlans: [12, 0, 0] }));

    expect((await AdminPlanQualityController.quality(90, NOW)).fewData).toBe(false);
  });

  it('behaves with no data at all: zeros, no start, no division by zero', async () => {
    quality.dataStart.mockResolvedValue(null);
    quality.totals.mockResolvedValue(
      totals({
        advisoriesByKind: {},
        days: 0,
        daysFloorNarrowed: 0,
        daysFloorNarrowedOutOfBand: 0,
        daysInBand: 0,
        eventDays: 0,
        eventDaysInBand: 0,
        fallbackFullLibrary: 0,
        fallbackWiderRotation: 0,
        floorBase: { days: 0, daysInBand: 0, plans: 0 },
        misses: { carbs: 0, fat: 0, kcal: 0, protein: 0 },
        plans: 0,
        withoutQuality: 0
      })
    );

    const view = await AdminPlanQualityController.quality(30, NOW);

    expect(view).toMatchObject({ dataStart: null, fewData: true, plans: 0 });
    expect(view).not.toHaveProperty('days');
    expect(view).not.toHaveProperty('shares');
  });

  it('leaves a share null when its denominator is zero, and the floor null while no plan carries it', async () => {
    quality.totals.mockResolvedValue(
      totals({
        daysFloorNarrowed: 0,
        daysFloorNarrowedOutOfBand: 0,
        eventDays: 0,
        eventDaysInBand: 0,
        floorBase: { days: 0, daysInBand: 0, plans: 0 }
      })
    );

    const view = await AdminPlanQualityController.quality(30, NOW);

    if (view.fewData) {
      throw new Error('expected the full view');
    }

    expect(view.shares?.eventInBand).toBeNull();
    expect(view.shares?.floor).toBeNull();
  });
});

describe('cohortStarts', () => {
  it('gives the last six months, the current one last', () => {
    expect(cohortStarts('2026-09-29')).toEqual(['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01']);
    expect(cohortStarts('2026-02-10')[0]).toBe('2025-09-01');
  });
});

describe('AdminRetentionController', () => {
  it('hides the active count of a cell with fewer than twenty eligible people, size and eligible staying', async () => {
    retention.cohorts.mockImplementation(async ({ source }: { source: string }) =>
      source === 'did_something' ? [{ active: 1, cohort: '2026-08-01', eligible: 1, size: 1, weeks: 1 }] : []
    );

    const view = await AdminRetentionController.retention(NOW);
    const cohort = view.didSomething.find(candidate => candidate.start === '2026-08-01');

    expect(cohort?.size).toBe(1);
    expect(cohort?.cells[0]).toEqual({ active: null, eligible: 1, enough: false, weeks: 1 });
    expect(cohort?.cells[0]).not.toHaveProperty('grouping');
  });

  it('lays the rows on every cohort, an empty cohort at zero, and marks a cell enough only from the threshold', async () => {
    retention.cohorts.mockImplementation(async ({ source }: { source: string }) =>
      source === 'did_something'
        ? [
            { active: 6, cohort: '2026-08-01', eligible: MIN_COHORT_FOR_SHARES, size: 25, weeks: 1 },
            { active: 1, cohort: '2026-08-01', eligible: 4, size: 25, weeks: 4 }
          ]
        : []
    );

    const view = await AdminRetentionController.retention(NOW);
    const august = view.didSomething.find(cohort => cohort.start === '2026-08-01');

    expect(view.didSomething).toHaveLength(6);
    expect(august?.size).toBe(25);
    expect(august?.cells.map(cell => [cell.weeks, cell.active, cell.eligible, cell.enough])).toEqual([
      [1, 6, 20, true],
      [2, null, 0, false],
      [4, null, 4, false]
    ]);
    expect(view.usedTheApp.every(cohort => cohort.size === 0)).toBe(true);
    expect(view.eventsSince).toBe('2026-09-29');
    expect(retention.cohorts).toHaveBeenCalledWith(expect.objectContaining({ since: '2026-09-29', source: 'events', today: '2026-09-29' }));
    expect(JSON.stringify(view)).not.toMatch(/user|email|"id"/);
  });
});
