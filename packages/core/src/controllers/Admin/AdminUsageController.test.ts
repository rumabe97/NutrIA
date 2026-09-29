import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminController, summariseAiCalls } from './AdminController';
import { AdminUsageController, modelsOf } from './AdminUsageController';

import type { AdminAiRepository as Ai, AiCallDayRow, AdminSeriesRepository as Series } from '#repositories/Admin';
import type { AiUsageView } from './AdminController';

const ai = vi.hoisted(() => ({ callsPerDay: vi.fn<(typeof Ai)['callsPerDay']>() }));
const series = vi.hoisted(() => ({ pictureSpendPerDay: vi.fn<(typeof Series)['pictureSpendPerDay']>() }));

vi.mock('#repositories/Admin', () => ({
  AdminAiRepository: ai,
  AdminRepository: {},
  AdminSeriesRepository: series,
  JOB_STATUSES: [],
  PLAN_STATUSES: []
}));

/** Monday 28 September 2026, noon in Madrid. */
const NOW = new Date('2026-09-28T10:00:00Z');
const WEEK = ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28'];

const TODAY: AiUsageView = {
  byModel: [],
  calls: 3,
  inputTokens: 10,
  lastRefusal: null,
  limits: { requestsPerDay: null, tokensPerMinute: null },
  model: 'm',
  outputTokens: 20,
  refused: 0,
  resetsAt: '2026-09-29T07:00:00.000Z'
};

function row(overrides: Partial<AiCallDayRow>): AiCallDayRow {
  return {
    answeredModel: null,
    calls: 1,
    costUsd: 0,
    day: '2026-09-28',
    failed: false,
    inputTokens: 0,
    model: 'asked',
    outputTokens: 0,
    provider: null,
    reasoningTokens: 0,
    timed: 0,
    totalMs: 0,
    ...overrides
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(AdminController, 'aiUsage').mockResolvedValue(TODAY);
  ai.callsPerDay.mockResolvedValue([
    // The period before: 14–21 September.
    row({ calls: 5, costUsd: 0.1, day: '2026-09-20', failed: true, timed: 5, totalMs: 5000 }),
    // This period.
    row({
      answeredModel: 'gemma',
      calls: 4,
      costUsd: 0.2,
      day: '2026-09-23',
      inputTokens: 400,
      outputTokens: 80,
      provider: 'DeepInfra',
      timed: 4,
      totalMs: 4000
    }),
    row({
      answeredModel: 'gemma',
      calls: 2,
      costUsd: 0.1,
      day: '2026-09-28',
      inputTokens: 200,
      outputTokens: 40,
      provider: 'DeepInfra',
      timed: 2,
      totalMs: 1000
    }),
    row({ calls: 1, day: '2026-09-28', failed: true, model: 'deepseek' })
  ]);
});

describe('AdminUsageController.ai', () => {
  it('keeps every field today’s page reads, and adds the period’s beside them', async () => {
    const view = await AdminUsageController.ai(7, {}, NOW);

    expect(view).toMatchObject(TODAY);
    expect(view.period).toBe(7);
    expect(view.window.from).toBe('2026-09-21T22:00:00.000Z');
  });

  it('reads the period and the one before it in one go, and tells them apart by the day', async () => {
    const view = await AdminUsageController.ai(7, {}, NOW);

    expect(ai.callsPerDay).toHaveBeenCalledWith(new Date('2026-09-14T22:00:00Z'), NOW);
    expect(view.totals).toEqual({
      averageMs: { current: 833, previous: 1000 },
      calls: { current: 7, previous: 5 },
      // Rounded to six places: 0.2 + 0.1 is 0.30000000000000004 in binary.
      costUsd: { current: 0.3, previous: 0.1 },
      failed: { current: 1, previous: 5 },
      inputTokens: { current: 600, previous: 0 },
      outputTokens: { current: 120, previous: 0 }
    });
  });

  it('lays calls and tokens on every day of the period, zeros included', async () => {
    const view = await AdminUsageController.ai(7, {}, NOW);

    expect(view.callsPerDay).toEqual({ days: WEEK, values: [0, 4, 0, 0, 0, 0, 3] });
    expect(view.spendPerDay).toEqual({ days: WEEK, values: [0, 0.2, 0, 0, 0, 0, 0.1] });
    expect(view.tokensPerDay).toEqual({
      days: WEEK,
      series: [
        { key: 'input', values: [0, 400, 0, 0, 0, 0, 200] },
        { key: 'output', values: [0, 80, 0, 0, 0, 0, 40] }
      ]
    });
  });

  it('lists the period’s calls by the model that answered, a failed call under the one asked for', async () => {
    const view = await AdminUsageController.ai(7, {}, NOW);

    expect(view.models.map(model => [model.model, model.provider, model.calls, model.failed, model.averageMs])).toEqual([
      ['gemma', 'DeepInfra', 6, 0, 833],
      ['deepseek', null, 1, 1, null]
    ]);
  });

  it('says null, not zero, for the latency of a period whose calls recorded no clock', async () => {
    ai.callsPerDay.mockResolvedValue([row({ calls: 2 })]);

    expect((await AdminUsageController.ai(7, {}, NOW)).totals.averageMs).toEqual({ current: null, previous: null });
  });
});

describe('modelsOf', () => {
  it('groups exactly as today’s summariseAiCalls does, event for event', () => {
    const at = new Date(NOW);
    const events = [
      {
        answeredModel: 'gemma',
        costUsd: 0.25,
        inputTokens: 100,
        model: 'NutrIA',
        ms: 900,
        ok: true,
        outputTokens: 10,
        provider: 'DeepInfra',
        reasoningTokens: 5
      },
      {
        answeredModel: 'gemma',
        costUsd: 0.5,
        inputTokens: 50,
        model: 'NutrIA',
        ms: 100,
        ok: true,
        outputTokens: 5,
        provider: 'DeepInfra',
        reasoningTokens: 0
      },
      { costUsd: null, model: 'NutrIA', ms: 2000, ok: false, provider: null },
      { answeredModel: '', model: '', ok: false },
      { answeredModel: 'gemma', inputTokens: 7, model: 'NutrIA', ok: true, outputTokens: 1, provider: 'Together' }
    ];
    // What the grouped SQL answers for those events: one row per (names, outcome), sums inside.
    const grouped: AiCallDayRow[] = [
      row({
        answeredModel: 'gemma',
        calls: 2,
        costUsd: 0.75,
        inputTokens: 150,
        model: 'NutrIA',
        outputTokens: 15,
        provider: 'DeepInfra',
        reasoningTokens: 5,
        timed: 2,
        totalMs: 1000
      }),
      row({ calls: 1, failed: true, model: 'NutrIA', timed: 1, totalMs: 2000 }),
      row({ answeredModel: '', calls: 1, failed: true, model: '' }),
      row({ answeredModel: 'gemma', calls: 1, inputTokens: 7, model: 'NutrIA', outputTokens: 1, provider: 'Together' })
    ];

    expect(modelsOf(grouped)).toEqual(summariseAiCalls(events.map(properties => ({ at, properties }))).byModel);
  });
});

describe('AdminUsageController.pictures', () => {
  it('keeps the month against the cap, and lays the spend on every day of the period', async () => {
    const month = { capUsd: 10, drawing: 1, enabled: true, failed: 2, ready: 30, released: 1, since: '2026-09-01T00:00:00.000Z', spentUsd: 3.2 };

    vi.spyOn(AdminController, 'pictures').mockResolvedValue(month);
    series.pictureSpendPerDay.mockResolvedValue([
      { day: '2026-09-24', n: 0.1 + 0.2 },
      { day: '2026-09-28', n: 1.25 }
    ]);

    const view = await AdminUsageController.pictures(7, 10, NOW);

    expect(AdminController.pictures).toHaveBeenCalledWith(10, NOW);
    expect(series.pictureSpendPerDay).toHaveBeenCalledWith(new Date('2026-09-21T22:00:00Z'), NOW);
    expect(view).toMatchObject(month);
    expect(view.spendPerDay).toEqual({ days: WEEK, values: [0, 0, 0.3, 0, 0, 0, 1.25] });
    expect(view.period).toBe(7);
  });
});
