import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generationQuerySchema } from 'core/entities/AdminQuery';

import { AdminLogController, generationFilter } from './AdminLogController';

import type { GenerationRow, AdminGenerationsRepository as Generations, AdminSeriesRepository as Series } from '#repositories/Admin';

const generations = vi.hoisted(() => ({
  durationsPerDay: vi.fn<(typeof Generations)['durationsPerDay']>(),
  failuresByCode: vi.fn<(typeof Generations)['failuresByCode']>(),
  page: vi.fn<(typeof Generations)['page']>(),
  rejectionsByReason: vi.fn<(typeof Generations)['rejectionsByReason']>()
}));
const series = vi.hoisted(() => ({ generationsPerDay: vi.fn<(typeof Series)['generationsPerDay']>() }));

vi.mock('#repositories/Admin', () => ({
  AdminGenerationsRepository: generations,
  AdminRepository: {},
  AdminSeriesRepository: series,
  JOB_STATUSES: ['queued', 'running', 'succeeded', 'failed'],
  PLAN_STATUSES: []
}));

/** Monday 28 September 2026, noon in Madrid (summer time, UTC+2). */
const NOW = new Date('2026-09-28T10:00:00Z');

const ROW: GenerationRow = {
  id: 'job-1',
  aiCalls: [{ model: 'm', round: 1 }],
  attempts: 1,
  email: 'ana@example.invalid',
  error: null,
  errorDetail: null,
  finishedAt: new Date('2026-09-28T09:01:39Z'),
  metadata: { model: 'm', promptVersion: '4.3.0', reused: 3 },
  name: 'Ana',
  planVersion: 2,
  startedAt: new Date('2026-09-28T09:00:00Z'),
  status: 'succeeded',
  step: 'done'
};

function query(raw: Record<string, string> = {}) {
  return generationQuerySchema.parse(raw);
}

beforeEach(() => {
  vi.clearAllMocks();
  generations.page.mockResolvedValue({ rows: [ROW], total: 41 });
  generations.durationsPerDay.mockResolvedValue([{ day: '2026-09-24', p50: 52.14, p95: 118.66 }]);
  generations.failuresByCode.mockResolvedValue([
    { code: 'GENERATION_AI_UNAVAILABLE', n: 4 },
    { code: null, n: 1 }
  ]);
  generations.rejectionsByReason.mockResolvedValue([
    { n: 9, reason: 'allergen' },
    { n: 2, reason: 'duplicate' }
  ]);
  series.generationsPerDay.mockResolvedValue([{ day: '2026-09-24', key: 'failed', n: 2 }]);
});

describe('generationFilter', () => {
  it('asks nothing of time when the query asks nothing', () => {
    expect(generationFilter(query(), NOW)).toEqual({ after: undefined, before: undefined, code: undefined, q: undefined, status: undefined });
  });

  it('reads `24h` as the 24 hours before now, and a period as its first Madrid midnight', () => {
    expect(generationFilter(query({ since: '24h' }), NOW).after).toEqual(new Date('2026-09-27T10:00:00Z'));
    expect(generationFilter(query({ since: '7' }), NOW).after).toEqual(new Date('2026-09-21T22:00:00Z'));
  });

  it('reads a range as whole Madrid days, both included, across the change of clocks', () => {
    // 25 October 2026 is the night Madrid goes back to UTC+1.
    const filter = generationFilter(query({ from: '2026-09-01', to: '2026-10-25' }), NOW);

    expect(filter.after).toEqual(new Date('2026-08-31T22:00:00Z'));
    expect(filter.before).toEqual(new Date('2026-10-25T23:00:00Z'));
  });

  it('lets the narrowest start win when `since` and `from` are both given', () => {
    expect(generationFilter(query({ from: '2026-09-01', since: '7' }), NOW).after).toEqual(new Date('2026-09-21T22:00:00Z'));
    expect(generationFilter(query({ from: '2026-09-27', since: '30' }), NOW).after).toEqual(new Date('2026-09-26T22:00:00Z'));
  });

  it('passes the outcome, the code and the search through as they were validated', () => {
    expect(generationFilter(query({ code: 'GENERATION_INVALID_PLAN', q: 'ana', status: 'failed' }), NOW)).toMatchObject({
      code: 'GENERATION_INVALID_PLAN',
      q: 'ana',
      status: 'failed'
    });
  });
});

describe('AdminLogController.page', () => {
  it('answers the paged shape with every row exactly as the log has always shown it', async () => {
    const page = await AdminLogController.page(query({ offset: '25', size: '25', status: 'succeeded' }), NOW);

    expect(generations.page).toHaveBeenCalledWith(expect.objectContaining({ status: 'succeeded' }), 25, 25);
    expect(page).toEqual({
      offset: 25,
      rows: [
        {
          id: 'job-1',
          account: { email: 'ana@example.invalid', name: 'Ana' },
          attempts: 1,
          calls: [{ model: 'm', round: 1 }],
          code: null,
          detail: null,
          finishedAt: '2026-09-28T09:01:39.000Z',
          plan: { backfilled: null, fallback: null, model: 'm', promptVersion: '4.3.0', rejected: null, reused: 3, version: 2 },
          seconds: 99,
          startedAt: '2026-09-28T09:00:00.000Z',
          status: 'succeeded',
          step: 'done'
        }
      ],
      size: 25,
      total: 41
    });
  });
});

describe('the addressed log never describes the person (0028, 0068)', () => {
  it('drops the allergen and unwanted rejections from a row that names its account, keeping the others', async () => {
    generations.page.mockResolvedValue({
      rows: [{ ...ROW, aiCalls: [{ model: 'm', rejected: { allergen: 3, duplicate: 1, unwanted: 2, wrong_meal: 1 }, round: 1 }] }],
      total: 1
    });

    const page = await AdminLogController.page(query(), NOW);
    const [row] = page.rows;

    expect(row?.account.email).toBe('ana@example.invalid');
    expect(row?.calls).toEqual([{ model: 'm', rejected: { duplicate: 1, wrong_meal: 1 }, round: 1 }]);
    expect(JSON.stringify(page)).not.toMatch(/allergen|unwanted/);
  });
});

describe('an invalid plan on the addressed log keeps its kind and days, never the person’s figures (0028)', () => {
  it('drops every example that quotes their day against their target, floor or ceiling', async () => {
    generations.page.mockResolvedValue({
      rows: [
        {
          ...ROW,
          error: 'GENERATION_INVALID_PLAN',
          errorDetail:
            'below_minimum_kcal (2 días, p. ej. 1180 bajo un mínimo de 1500); protein_off (3 días, p. ej. 92 frente a 140); kcal_over (1 días, p. ej. 3200 sobre un techo de 3000)',
          status: 'failed'
        }
      ],
      total: 1
    });

    const [row] = (await AdminLogController.page(query(), NOW)).rows;

    expect(row?.detail).toBe('below_minimum_kcal (2 días); protein_off (3 días); kcal_over (1 días)');
  });

  it('leaves any other failure’s detail as it was', async () => {
    generations.page.mockResolvedValue({
      rows: [{ ...ROW, error: 'GENERATION_AI_UNAVAILABLE', errorDetail: 'Provider returned error — provider: DeepInfra', status: 'failed' }],
      total: 1
    });

    const [row] = (await AdminLogController.page(query(), NOW)).rows;

    expect(row?.detail).toBe('Provider returned error — provider: DeepInfra');
  });
});

describe('AdminLogController.stats', () => {
  it('lays the outcomes and durations on every day of the period, a day with no finished job being null, not zero', async () => {
    const stats = await AdminLogController.stats(7, NOW);

    expect(stats.outcomes.days).toEqual(['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28']);
    expect(stats.outcomes.series.map(entry => entry.key)).toEqual(['queued', 'running', 'succeeded', 'failed']);
    expect(stats.outcomes.series[3]?.values).toEqual([0, 0, 2, 0, 0, 0, 0]);
    expect(stats.durations.days).toEqual(stats.outcomes.days);
    expect(stats.durations.p50).toEqual([null, null, 52.1, null, null, null, null]);
    expect(stats.durations.p95).toEqual([null, null, 118.7, null, null, null, null]);
    expect(stats.failuresByCode).toEqual([
      { code: 'GENERATION_AI_UNAVAILABLE', n: 4 },
      { code: null, n: 1 }
    ]);
    // Totals over everybody, so the person's own reasons may be counted here (0028).
    expect(stats.rejectionsByReason).toEqual([
      { n: 9, reason: 'allergen' },
      { n: 2, reason: 'duplicate' }
    ]);
    expect(JSON.stringify(stats)).not.toMatch(/@|email|account/);
    expect(stats.period).toBe(7);
    expect(stats.window).toEqual({ from: '2026-09-21T22:00:00.000Z', previousFrom: '2026-09-14T22:00:00.000Z', to: NOW.toISOString() });
  });

  it('asks every read for the same window', async () => {
    await AdminLogController.stats(30, NOW);

    const from = new Date('2026-08-29T22:00:00Z');

    expect(series.generationsPerDay).toHaveBeenCalledWith(from, NOW);
    expect(generations.durationsPerDay).toHaveBeenCalledWith(from, NOW);
    expect(generations.failuresByCode).toHaveBeenCalledWith(from, NOW);
    expect(generations.rejectionsByReason).toHaveBeenCalledWith(from, NOW);
  });

  it('names nobody: no address reaches the charts', async () => {
    expect(JSON.stringify(await AdminLogController.stats(90, NOW))).not.toContain('@');
  });
});
